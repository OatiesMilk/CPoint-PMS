import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  captureApi,
  createRoll,
  createDeviceToken,
  finishRoll,
  inspectorApi,
  postScan,
  withDb,
} from "./cv-helpers";

test.describe("camera ingestion API", () => {
  test("gives Pass or Reject at once and rejects unknown classes (D-093)", async ({
    browser,
    request,
  }) => {
    const roll = await createRoll(await captureApi(browser));
    const { token } = await createDeviceToken();

    const cases = [
      { dets: [{ classKey: "cut", confidence: 0.95 }], verdict: "REJECT" },
      { dets: [{ classKey: "hole", confidence: 0.3 }], verdict: "PASS" }, // below found-at
      { dets: [{ classKey: "abrasion", confidence: 0.9 }], verdict: "PASS" }, // Usable
      { dets: [], verdict: "PASS" },
      { dets: [{ classKey: "sim-unknown", confidence: 0.8 }], verdict: "REJECT" },
    ];
    for (const [i, c] of cases.entries()) {
      const res = await postScan(request, token, roll.id, c.dets);
      expect(res.status()).toBe(201);
      const data = (await res.json()).data;
      expect(data).toMatchObject({ rollCode: roll.code, sequence: i + 1, verdict: c.verdict });
      expect(data).not.toHaveProperty("status");
    }

    const stored = await withDb(async (db) => ({
      final: (
        await db.query(
          `SELECT "finalVerdict"::text v FROM scans WHERE "batchId" = $1 ORDER BY sequence`,
          [roll.id],
        )
      ).rows.map((r) => r.v),
      unknown: (
        await db.query(
          `SELECT count(*)::int n FROM detections d JOIN scans s ON s.id = d."scanId" WHERE s."batchId" = $1 AND d."isUnknownClass"`,
          [roll.id],
        )
      ).rows[0].n,
    }));
    expect(stored).toEqual({
      final: ["REJECT", "PASS", "PASS", "PASS", "REJECT"],
      unknown: 1,
    });
  });

  test("refuses missing or revoked tokens, non-images, and finished rolls", async ({
    browser,
    request,
  }) => {
    const api = await captureApi(browser);
    const finished = await createRoll(api);
    const active = await createRoll(api);
    const { token, id } = await createDeviceToken();
    expect((await postScan(request, token, finished.id, [])).status()).toBe(201);
    await finishRoll(api, finished.id);

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

    const closed = await postScan(request, token, finished.id, []);
    expect(closed.status()).toBe(409);
    expect((await closed.json()).error.code).toBe("ROLL_CLOSED");

    await withDb((db) => db.query(`UPDATE api_tokens SET "revokedAt" = now() WHERE id = $1`, [id]));
    expect((await postScan(request, token, active.id, [])).status()).toBe(401);
  });
});

test("a section's page draws the boxes, explains the verdict and offers no change (D-093)", async ({
  browser,
  request,
}) => {
  const roll = await createRoll(await captureApi(browser));
  const { token } = await createDeviceToken();
  const res = await postScan(request, token, roll.id, [
    { classKey: "cut", confidence: 0.94 },
    { classKey: "dirt", confidence: 0.4 },
  ]);
  const { scanId } = (await res.json()).data;

  // A section's page is the Floor Manager's (Phase 28, D-100), reached from its roll.
  for (const account of [ACCOUNTS.manager]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await signIn(page, account.email);
    await expect(page).toHaveURL(account.home);
    await page.goto(`/scans/${scanId}`);
    await expect(page.getByTestId("detection-box")).toHaveCount(2);
    await expect(page.getByText("The camera’s verdict is final.")).toBeVisible();
    await expect(page.getByTestId("rules-used")).toContainText("Not accepted");
    await expect(page.getByRole("cell", { name: "Not accepted" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Override|Pass|Fixable|Reject/ })).toHaveCount(0);
    await context.close();
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

test("a device token without a roll is told the roll open the longest (D-020's fallback)", async ({
  browser,
  request,
}) => {
  await createRoll(await captureApi(browser));
  const { token } = await createDeviceToken();
  expect((await request.get("/api/v1/rolls/current")).status()).toBe(401);
  const current = await request.get("/api/v1/rolls/current", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(current.status()).toBe(200);
  const data = (await current.json()).data;
  expect(data).toMatchObject({ rollId: expect.any(String), code: expect.stringMatching(/^[RB]-/) });
  // No person is named, not even "mine" (D-008).
  expect(data).not.toHaveProperty("mine");
});

test("an admin creates a device token, sees it once, and revokes it", async ({
  browser,
  page,
  request,
}) => {
  const roll = await createRoll(await captureApi(browser));
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

  expect((await postScan(request, token, roll.id, [])).status()).toBe(201);

  const row = page.getByRole("row", { name: new RegExp(name) });
  await row.getByRole("button", { name: "Revoke…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke token" }).click();
  // Revoked tokens sort after the active ones, so with more than 15 tokens this row moves past
  // page 1 (D-047): the toast confirms it, and the camera API refusing it is the real check.
  await expect(page.getByText(`“${name}” revoked.`)).toBeVisible();
  expect((await postScan(request, token, roll.id, [])).status()).toBe(401);
});

test("the live feed and the Scans list are gone (Phase 28, A-26)", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await expect(page.getByText("Latest scans")).toHaveCount(0);
  expect((await page.request.get("/api/v1/scans?limit=8")).status()).toBe(405);
  expect((await page.goto("/scans"))?.status()).toBe(404);
});
