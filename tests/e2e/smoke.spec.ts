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
  page,
}) => {
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/batches/new");
  await page.getByLabel("Roll code").fill(`SMOKE-${Date.now()}`);
  await page.getByLabel("Shoe type").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Start production" }).click();
  await expect(page.locator("header").getByText("In progress", { exact: true })).toBeVisible();
  await expectAccessible(page);

  await page.goto("/inventory");
  await page
    .getByRole("link", { name: /Contact cement/ })
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

test("Quality Inspector journey: settle a review-queue scan, then repair a section", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  await postScan(request, token, batch.id, [{ classKey: "smoke-unknown", confidence: 0.9 }]);
  await postScan(request, token, batch.id, [{ classKey: "hole", confidence: 0.7 }]);

  await signInAs(page, ACCOUNTS.inspector);
  await page.goto("/review");
  await expectAccessible(page);
  await page.goto(`/scans?batch=${batch.code}`);
  await page.locator("tbody a").first().click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);
  await expectAccessible(page);
  await page.goto(`/rework?batch=${batch.code}`);
  await page.getByRole("button", { name: "Start repair" }).click();
  await page
    .getByRole("region", { name: "Being repaired" })
    .getByRole("button", { name: "Mark repaired" })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Repaired, last 7 days" })
      .getByRole("listitem", { name: `${batch.code} · #2` }),
  ).toBeVisible();
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

test("Shoe Constructor: a coming-soon home and nothing else", async ({ page }) => {
  await signInAs(page, ACCOUNTS.constructor);
  await expect(page.getByRole("heading", { name: "Your tasks are coming soon" })).toBeVisible();
  await expectAccessible(page);
  await page.goto("/batches");
  await expect(page).toHaveURL("/forbidden");
});
