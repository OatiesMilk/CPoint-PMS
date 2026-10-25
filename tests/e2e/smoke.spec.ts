import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { captureApi, createRoll, createDeviceToken, managerApi, postScan } from "./cv-helpers";

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

test("Floor Manager journey: read the rolls, update stock, read the report", async ({
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

  // A constructor starts a roll at Capture; the Floor Manager reads it in Reports → Rolls.
  const roll = await createRoll(await captureApi(browser));
  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/reports/rolls?q=${roll.code}`);
  await expect(page.getByTestId("roll-row").filter({ hasText: roll.code })).toContainText("Open");
  await expectAccessible(page);

  // Searched, not browsed: earlier e2e runs add items that push it past page 1.
  await page.goto(`/inventory?q=${sku}`);
  await page
    .getByRole("link", { name: new RegExp(sku) })
    .first()
    .click();
  // Stock changes on the Update stock sheet (Phase 29, D-102).
  await page.getByRole("link", { name: "Update stock" }).click();
  await page.getByLabel(`Added to Smoke cement ${sku}`).fill("1");
  await page.getByRole("button", { name: "Save update (1 item)" }).click();
  await expect(page.getByText("Stock updated: 1 item.")).toBeVisible();
  await expectAccessible(page);
  await page.goto("/reports/materials");
  await expectAccessible(page);

  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByTestId("report-range")).toBeVisible();
});

test("QI lands on Batches; the FM opens a rejected section from its roll", async ({
  browser,
  page,
  request,
}) => {
  const roll = await createRoll(await captureApi(browser));
  const { token } = await createDeviceToken();
  await postScan(request, token, roll.id, [{ classKey: "smoke-unknown", confidence: 0.9 }]);
  await postScan(request, token, roll.id, [{ classKey: "abrasion", confidence: 0.7 }]);

  // The QI's one page is Batches (Phase 28, D-100).
  await signInAs(page, ACCOUNTS.inspector);
  await expect(page).toHaveURL("/batches");
  await expectAccessible(page);

  // A section's page is the Floor Manager's, reached from its roll (A-26).
  // A context of its own: axe needs one made by browser.newContext() (QA Phase 28 F2).
  const fmContext = await browser.newContext();
  const fm = await fmContext.newPage();
  await signInAs(fm, ACCOUNTS.manager);
  await fm.goto(`/reports/rolls/${roll.id}`);
  await expect(fm.getByTestId("shot-row")).toHaveCount(2);
  await expectAccessible(fm);
  await fm.getByTestId("shot-row").filter({ hasText: "Reject" }).getByRole("link").first().click();
  await expect(fm).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);
  await expect(fm.getByText(/so this section is rejected/)).toBeVisible();
  await expect(fm.getByRole("link", { name: `Roll ${roll.code}` })).toBeVisible();
  await expectAccessible(fm);
  await fmContext.close();
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

test("Shoe Constructor: Capture is their only page (Phase 26)", async ({ page }) => {
  await signInAs(page, ACCOUNTS.constructor);
  await expectRendered(page);
  // Capture when the demo data gives this constructor camera access, otherwise who to ask.
  await expect(
    page
      .getByRole("button", { name: "Capture", exact: true })
      .or(page.getByText("Ask the System Admin for camera access.")),
  ).toBeVisible();
  await expectAccessible(page);
  for (const path of ["/reports/rolls", "/inventory", "/batches"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/forbidden");
  }
});
