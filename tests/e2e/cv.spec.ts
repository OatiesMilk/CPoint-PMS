import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  createBatch,
  createDeviceToken,
  inspectorApi,
  managerApi,
  postScan,
  withDb,
} from "./cv-helpers";

test.describe("camera ingestion API", () => {
  test("gives Pass or Reject at once and rejects unknown classes (D-093)", async ({
    browser,
    request,
  }) => {
    const api = await managerApi(browser);
    const batch = await createBatch(api);
    const { token } = await createDeviceToken();

    const cases = [
      { dets: [{ classKey: "cut", confidence: 0.95 }], verdict: "REJECT" },
      { dets: [{ classKey: "hole", confidence: 0.3 }], verdict: "PASS" }, // below found-at
      { dets: [{ classKey: "abrasion", confidence: 0.9 }], verdict: "PASS" }, // Usable
      { dets: [], verdict: "PASS" },
      { dets: [{ classKey: "sim-unknown", confidence: 0.8 }], verdict: "REJECT" },
    ];
    for (const [i, c] of cases.entries()) {
      const res = await postScan(request, token, batch.id, c.dets);
      expect(res.status()).toBe(201);
      const data = (await res.json()).data;
      expect(data).toMatchObject({ batchCode: batch.code, sequence: i + 1, verdict: c.verdict });
      expect(data).not.toHaveProperty("status");
    }

    const stored = await withDb(async (db) => ({
      final: (
        await db.query(
          `SELECT "finalVerdict"::text v FROM scans WHERE "batchId" = $1 ORDER BY sequence`,
          [batch.id],
        )
      ).rows.map((r) => r.v),
      unknown: (
        await db.query(
          `SELECT count(*)::int n FROM detections d JOIN scans s ON s.id = d."scanId" WHERE s."batchId" = $1 AND d."isUnknownClass"`,
          [batch.id],
        )
      ).rows[0].n,
    }));
    expect(stored).toEqual({
      final: ["REJECT", "PASS", "PASS", "PASS", "REJECT"],
      unknown: 1,
    });
  });

  test("refuses missing or revoked tokens, non-images, and batches not at Preparation", async ({
    browser,
    request,
  }) => {
    const api = await managerApi(browser);
    const planned = await createBatch(api, false);
    const active = await createBatch(api);
    const { token, id } = await createDeviceToken();

    expect((await request.post("/api/v1/scans")).status()).toBe(401);
    expect((await postScan(request, "cpt_not-a-real-token", active.id, [])).status()).toBe(401);

    const notImage = await postScan(
      request,
      token,
      active.id,
      [],
      Buffer.from("<svg onload=alert(1)>"),
    );
    expect(notImage.status()).toBe(422);

    const notAtPrep = await postScan(request, token, planned.id, []);
    expect(notAtPrep.status()).toBe(409);

    await withDb((db) => db.query(`UPDATE api_tokens SET "revokedAt" = now() WHERE id = $1`, [id]));
    expect((await postScan(request, token, active.id, [])).status()).toBe(401);
  });
});

test("a section's page draws the boxes, explains the verdict and offers no change (D-093)", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  const res = await postScan(request, token, batch.id, [
    { classKey: "cut", confidence: 0.94 },
    { classKey: "dirt", confidence: 0.4 },
  ]);
  const { scanId } = (await res.json()).data;

  for (const account of [ACCOUNTS.inspector, ACCOUNTS.manager]) {
    await page.goto("/login");
    await signIn(page, account.email);
    await expect(page).toHaveURL(account.home);
    await page.goto(`/scans/${scanId}`);
    await expect(page.getByTestId("detection-box")).toHaveCount(2);
    await expect(page.getByText("The camera’s verdict is final.")).toBeVisible();
    await expect(page.getByTestId("rules-used")).toContainText("Not accepted");
    await expect(page.getByRole("cell", { name: "Not accepted" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Override|Pass|Fixable|Reject/ })).toHaveCount(0);
    await page.context().clearCookies();
  }

  // The old decision endpoint is gone.
  const gone = await (
    await inspectorApi(browser)
  ).post(`/api/v1/scans/${scanId}/decision`, {
    data: { verdict: "PASS", expectedFinalVerdict: "REJECT" },
  });
  expect(gone.status()).toBe(404);
});

test("the removed pages answer 404 (D-094)", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.inspector.email);
  await expect(page).toHaveURL(ACCOUNTS.inspector.home);
  for (const path of ["/review", "/rework", "/salvage"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  const nav = page.getByRole("navigation");
  for (const label of ["Review queue", "Repair Station", "Salvage"])
    await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
});

test("the Floor Manager chooses which batch the camera feeds", async ({ browser, page }) => {
  const api = await managerApi(browser);
  await createBatch(api);
  const chosen = await createBatch(api);

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto("/camera");
  await page.getByLabel("Batch the camera feeds").selectOption({ value: chosen.id });
  await page.getByRole("button", { name: "Use this batch" }).click();
  await expect(page.getByText("Chosen on this page.")).toBeVisible();

  const current = await page.request.get("/api/v1/batches/current");
  expect((await current.json()).data).toMatchObject({ batchId: chosen.id, selection: "selected" });

  // Back to automatic so other tests aren't affected.
  await page.getByLabel("Batch the camera feeds").selectOption({ value: "" });
  await page.getByRole("button", { name: "Use this batch" }).click();
  await expect(
    page.getByText("Automatic: the batch that has been at Preparation the longest."),
  ).toBeVisible();
});

test("an admin creates a device token, sees it once, and revokes it", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const name = `E2E camera ${Date.now()}`;

  await page.goto("/login");
  await signIn(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(ACCOUNTS.admin.home);
  await page.goto("/admin/tokens");
  await page.getByRole("button", { name: "New token" }).click();
  await page.getByLabel("Device name").fill(name);
  await page.getByRole("button", { name: "Create token" }).click();
  const tokenField = page.getByRole("textbox", { name: "New device token" });
  await expect(tokenField).toHaveValue(/^cpt_/);
  const token = await tokenField.inputValue();
  await expect(page.getByText("You won’t see it again.")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  expect((await postScan(request, token, batch.id, [])).status()).toBe(201);

  const row = page.getByRole("row", { name: new RegExp(name) });
  await row.getByRole("button", { name: "Revoke…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke token" }).click();
  // Revoked tokens sort after the active ones, so with more than 15 tokens this row moves past
  // page 1 (D-047): the toast confirms it, and the camera API refusing it is the real check.
  await expect(page.getByText(`“${name}” revoked.`)).toBeVisible();
  expect((await postScan(request, token, batch.id, [])).status()).toBe(401);
});

test("the live feed on the inspector's home shows a new scan within seconds", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();

  await page.goto("/login");
  await signIn(page, ACCOUNTS.inspector.email);
  await expect(page.getByText(/Updated \d+s ago/)).toBeVisible();

  await postScan(request, token, batch.id, [{ classKey: "hole", confidence: 0.66 }]);
  await expect(page.getByRole("link", { name: new RegExp(`${batch.code} · #1`) })).toBeVisible({
    timeout: 8_000,
  });
});
