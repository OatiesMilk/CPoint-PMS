import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { createBatch, createDeviceToken, managerApi, postScan, withDb } from "./cv-helpers";

/**
 * Phase 20 (D-070): a Fixable section is cleaned or cut around, by its defect type's "When Fixable"
 * setting. The test posts its own two types, so Settings elsewhere don't matter.
 */
const CLEAN_KEY = "e2e-clean-only";
const CUT_KEY = "e2e-cut-around";

async function ensureHandlingTypes() {
  await withDb(async (db) => {
    const types = [
      [CLEAN_KEY, "E2E stain", "CLEAN", 950],
      [CUT_KEY, "E2E nick", "CUT_AROUND", 951],
    ] as const;
    for (const [key, label, handling, order] of types)
      await db.query(
        `INSERT INTO defect_types (id, key, label, "isActive", action, handling, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NULL, $4, $5, now(), now())
         ON CONFLICT (key) DO UPDATE SET "isActive" = true, action = NULL, handling = $4`,
        [randomUUID(), key, label, handling, order],
      );
  });
}

test("the board says what each Fixable section needs, and how it ended", async ({
  browser,
  page,
  request,
}) => {
  await ensureHandlingTypes();
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  // 72% and 81% are Fixable by the confidence rule (60 to 89%, D-011).
  expect(
    (
      await postScan(request, token, batch.id, [{ classKey: CLEAN_KEY, confidence: 0.72 }])
    ).status(),
  ).toBe(201);
  expect(
    (await postScan(request, token, batch.id, [{ classKey: CUT_KEY, confidence: 0.81 }])).status(),
  ).toBe(201);

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/rework?batch=${batch.code}`);
  await expect(page.getByRole("heading", { name: "Repair Station", level: 1 })).toBeVisible();
  const toHandle = page.getByRole("region", { name: "To handle" });
  const clean = toHandle.getByRole("listitem", { name: `${batch.code} · section #1` });
  const cut = toHandle.getByRole("listitem", { name: `${batch.code} · section #2` });
  await expect(clean).toContainText("E2E stain, 72%");
  await expect(clean.getByTestId("rework-handling")).toHaveText("Clean before cutting");
  await expect(cut.getByTestId("rework-handling")).toHaveText("Cut around the marked area");

  await clean.getByRole("button", { name: "Start", exact: true }).click();
  const handling = page.getByRole("region", { name: "Being handled" });
  await handling.getByRole("button", { name: "Mark done" }).click();
  const done = page.getByRole("region", { name: "Done, usable" });
  await expect(done.getByTestId("rework-done")).toHaveText("Cleaned, usable");
});

test("Settings sets how a Fixable section of a type is handled; components are gone", async ({
  page,
}) => {
  await ensureHandlingTypes();
  await page.goto("/login");
  await signIn(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(ACCOUNTS.admin.home);
  await page.goto("/admin/settings?tab=defects");
  // Found, not browsed: other runs add defect types that push these past page 1 (D-047). A row is
  // named by its label, so match the key in its text.
  const find = page.getByLabel("Find defect type");
  await find.fill(CLEAN_KEY);
  await expect(page.getByRole("row").filter({ hasText: CLEAN_KEY })).toContainText(
    "Clean before cutting",
  );
  await find.fill(CUT_KEY);
  await expect(page.getByRole("row").filter({ hasText: CUT_KEY })).toContainText(
    "Cut around the marked area",
  );
  // Component tracking is out of scope (D-071): no Components tab, no page, no API.
  await expect(page.getByRole("link", { name: "Components" })).toHaveCount(0);
  expect((await page.request.get("/api/v1/component-types")).status()).toBe(404);
  expect((await page.goto("/components"))?.status()).toBe(404);
});
