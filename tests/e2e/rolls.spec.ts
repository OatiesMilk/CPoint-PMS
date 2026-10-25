import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  captureApi,
  createDeviceToken,
  createRoll,
  finishRoll,
  postScan,
  withDb,
} from "./cv-helpers";

// Rolls in Reports (Phase 26, D-095): constructors start and finish rolls at Capture; the Floor
// Manager reads every roll here and may cancel an open one with a reason. No person is named.

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

const unique = () => `E2E-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

test.describe("Reports → Rolls (Floor Manager)", () => {
  test.beforeEach(async ({ page }) => signInAs(page, ACCOUNTS.manager));

  test("lists a finished roll with its shots, passed and rejected, and finds it by tag", async ({
    browser,
    page,
    request,
  }) => {
    const sc = await captureApi(browser);
    const tag = unique();
    const roll = await createRoll(sc, { tagCode: tag });
    const { token } = await createDeviceToken();
    expect((await postScan(request, token, roll.id, [])).status()).toBe(201);
    expect(
      (await postScan(request, token, roll.id, [{ classKey: "hole", confidence: 0.9 }])).status(),
    ).toBe(201);
    await finishRoll(sc, roll.id);

    await page.goto("/reports");
    await page
      .getByRole("navigation", { name: "Report" })
      .getByRole("link", { name: "Rolls" })
      .click();
    await expect(page).toHaveURL(/\/reports\/rolls$/);
    await page.getByLabel("Find").fill(tag);
    // Wait for the Find box's own navigation, so it can't land after the click on the roll below.
    await expect(page).toHaveURL(new RegExp(`[?&]q=${tag}`));
    const row = page.getByTestId("roll-row").filter({ hasText: roll.code });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Finished");
    // Shots 2, passed 1, rejected (for salvage) 1.
    await expect(row.getByRole("cell").nth(4)).toHaveText("2");
    await expect(row.getByRole("cell").nth(5)).toHaveText("1");
    await expect(row.getByRole("cell").nth(6)).toHaveText("1");
    // No person anywhere on the list (D-008).
    await expect(page.getByRole("columnheader", { name: /by|person|constructor/i })).toHaveCount(0);

    await row.getByRole("link", { name: roll.code }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(roll.code);
    await expect(page.getByText("2 shots · 1 passed · 1 rejected (for salvage)")).toBeVisible();
    const shots = page.getByTestId("shot-row");
    await expect(shots).toHaveCount(2);
    await expect(shots.nth(1)).toContainText("Reject");
    await expect(page.getByRole("link", { name: "Claim sheet" })).toBeVisible();
    // A finished roll can't be cancelled.
    await expect(page.getByRole("button", { name: "Cancel roll…" })).toHaveCount(0);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("cancels an open roll with a reason; its shots stay but leave the reports", async ({
    browser,
    page,
    request,
  }) => {
    const sc = await captureApi(browser);
    const roll = await createRoll(sc);
    const { token } = await createDeviceToken();
    expect((await postScan(request, token, roll.id, [])).status()).toBe(201);

    await page.goto(`/reports/rolls/${roll.id}`);
    await expect(page.getByText("Open", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel roll…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Cancel ${roll.code}?`);
    await dialog.getByRole("button", { name: "Cancel roll", exact: true }).click();
    await expect(dialog.getByText("Write why this roll is cancelled.")).toBeVisible();
    await dialog.getByLabel("Reason").fill("Started with the wrong supplier");
    await dialog.getByRole("button", { name: "Cancel roll", exact: true }).click();

    await expect(page.getByText("Cancelled: Started with the wrong supplier")).toBeVisible();
    await expect(page.getByTestId("shot-row")).toHaveCount(1);
    const stored = await withDb(async (db) => {
      const r = await db.query(
        `SELECT status::text, "cancelledReason", (SELECT count(*)::int FROM scans WHERE "batchId" = b.id) AS shots FROM batches b WHERE id = $1`,
        [roll.id],
      );
      const audit = await db.query(
        `SELECT count(*)::int n FROM audit_logs WHERE "entityId" = $1 AND action = 'roll.cancel'`,
        [roll.id],
      );
      return { ...r.rows[0], audits: audit.rows[0].n };
    });
    expect(stored).toEqual({
      status: "CANCELLED",
      cancelledReason: "Started with the wrong supplier",
      shots: 1,
      audits: 1,
    });

    // The constructor's phone can no longer send shots to it.
    const late = await postScan(request, token, roll.id, []);
    expect(late.status()).toBe(409);
  });

  test("filters by status and clears", async ({ page }) => {
    await page.goto("/reports/rolls?status=CANCELLED&q=NO-SUCH-ROLL");
    await expect(page.getByText("No rolls match these filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/reports\/rolls$/);
  });
});

test.describe("who sees rolls", () => {
  test("only the Floor Manager has Reports → Rolls", async ({ page }) => {
    for (const account of [ACCOUNTS.inspector, ACCOUNTS.admin]) {
      await signInAs(page, account);
      await page.goto("/reports/rolls");
      await expect(page).toHaveURL(/\/forbidden/);
      expect((await page.request.get("/api/v1/rolls")).status()).toBe(403);
      // Leave the app first: a request still in flight (the QI's batch notices, Phase 27) could
      // set the session cookie again after it's cleared, and /login would then redirect home.
      await page.goto("about:blank");
      await page.context().clearCookies();
    }
  });

  test("the old roll pages and stage moves are gone", async ({ page }) => {
    await signInAs(page, ACCOUNTS.manager);
    // /batches is the check-in batches since Phase 27; the old roll pages stay gone.
    for (const path of ["/batches/new", "/constructor", "/production"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
    expect((await page.request.get("/api/v1/batches")).status()).toBe(404);
    const stages = await page.request.post(
      "/api/v1/rolls/0199a000-0000-7000-8000-000000000001/stages",
      { data: { action: "start" } },
    );
    expect(stages.status()).toBe(404);
  });

  test("the API needs a session", async ({ request }) => {
    expect((await request.get("/api/v1/rolls")).status()).toBe(401);
  });
});
