import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { createBatch, createDeviceToken, managerApi, postScan } from "./cv-helpers";

/**
 * Smoke per role (Phase 8): every page in the role's sidebar renders (a heading, no error
 * boundary, no 403) and passes axe's WCAG 2 A/AA rules with no serious or critical violation;
 * then one short journey through the role's main job.
 */

type Account = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

async function signInAs(page: Page, account: Account) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

async function sidebarLinks(page: Page): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  return nav.getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
}

async function expectAccessible(page: Page) {
  // After a client-side navigation the title lands a moment after the URL changes.
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
  expect.soft(serious, `axe on ${page.url()}`).toEqual([]);
}

async function expectRendered(page: Page) {
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByText(/This page couldn’t load|Couldn’t load/)).toHaveCount(0);
  expect(new URL(page.url()).pathname).not.toBe("/forbidden");
}

test("the sign-in page passes axe in light and dark", async ({ browser }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    await page.goto("/login");
    await expectAccessible(page);
    await context.close();
  }
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });
  test("every page in the manager's sidebar passes axe in dark mode", async ({ page }) => {
    test.setTimeout(90_000); // every sidebar page, each scanned by axe
    await signInAs(page, ACCOUNTS.manager);
    for (const href of await sidebarLinks(page)) {
      await page.goto(href);
      await expectRendered(page);
      await expectAccessible(page);
    }
  });
});

for (const [role, account] of Object.entries(ACCOUNTS)) {
  test(`every page in the ${role}'s sidebar renders and passes axe`, async ({ page }) => {
    test.setTimeout(90_000); // up to ten pages, each scanned by axe
    await signInAs(page, account);
    const links = await sidebarLinks(page);
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      await page.goto(href);
      await expectRendered(page);
      await expectAccessible(page);
    }
  });
}

test("Floor Manager journey: register a roll as a batch, start it, receive stock, read the report", async ({
  browser,
  page,
}) => {
  // Its own stock item, so the journey doesn't depend on the demo inventory being there.
  const api = await managerApi(browser);
  // Item codes are at most 20 characters, and the reorder level is required.
  const sku = `SMK-${String(Date.now()).slice(-8)}`;
  const created = await api.post("/api/v1/inventory", {
    data: {
      sku,
      name: `Smoke cement ${sku}`,
      category: "ADHESIVE",
      unit: "can",
      reorderLevel: 0,
      openingStock: 2,
    },
  });
  expect(created.status()).toBe(201);

  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/batches/new");
  await page.getByLabel("Roll code").fill(`SMOKE-${Date.now()}`);
  await page.getByLabel("Shoe type").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Start roll" }).click();
  await expect(page.locator("header").getByText("At Preparation", { exact: true })).toBeVisible();
  await expectAccessible(page);

  // Searched, not browsed: earlier e2e runs add items that push it past page 1.
  await page.goto(`/inventory?q=${sku}`);
  await page
    .getByRole("link", { name: new RegExp(sku) })
    .first()
    .click();
  await page.getByRole("button", { name: "Receive stock" }).click();
  await page.getByRole("dialog").getByLabel("Quantity").fill("1");
  await page.getByRole("dialog").getByRole("button", { name: "Record delivery" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByTestId("report-range")).toBeVisible();
});

test("Quality Inspector journey: a rejected and a passed section, explained on their pages", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  await postScan(request, token, batch.id, [{ classKey: "smoke-unknown", confidence: 0.9 }]);
  await postScan(request, token, batch.id, [{ classKey: "abrasion", confidence: 0.7 }]);

  await signInAs(page, ACCOUNTS.inspector);
  await expectAccessible(page);
  await page.goto(`/scans?batch=${batch.code}`);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expectAccessible(page);
  await page.goto(`/scans?batch=${batch.code}&verdict=REJECT`);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody a").first().click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/so this section is rejected/)).toBeVisible();
  await expectAccessible(page);
});

test("System Admin journey: thresholds, unknown classes and the audit trail", async ({ page }) => {
  await signInAs(page, ACCOUNTS.admin);
  await page.goto("/admin/settings");
  await expect(page.getByText("What the camera will decide")).toBeVisible();
  await page.goto("/admin/settings?tab=defects");
  await expectAccessible(page);
  await page.goto("/admin/audit");
  await page.getByTestId("audit-entry").first().locator("summary").click();
  await expect(
    page
      .getByTestId("audit-entry")
      .first()
      .getByText(/Record id|No specific record/),
  ).toBeVisible();
});

test("Shoe Constructor: a home that leads to the camera, and nothing else (D-091)", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.constructor);
  await expectRendered(page);
  // The Capture card when the demo data allows this constructor to capture, otherwise who to ask.
  await expect(
    page
      .getByRole("link", { name: "Open Capture" })
      .or(page.getByText("Ask the System Admin for camera access.")),
  ).toBeVisible();
  await expectAccessible(page);
  await page.goto("/batches");
  await expect(page).toHaveURL("/forbidden");
  await page.goto("/inventory");
  await expect(page).toHaveURL("/forbidden");
});
