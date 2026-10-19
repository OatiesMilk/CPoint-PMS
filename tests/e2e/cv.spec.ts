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
  test("applies the confidence rule and flags unknown classes", async ({ browser, request }) => {
    const api = await managerApi(browser);
    const batch = await createBatch(api);
    const { token } = await createDeviceToken();

    const cases = [
      { dets: [{ classKey: "cut", confidence: 0.95 }], verdict: "REJECT", status: "DECIDED" },
      { dets: [{ classKey: "hole", confidence: 0.7 }], verdict: "REWORK", status: "DECIDED" },
      { dets: [{ classKey: "abrasion", confidence: 0.3 }], verdict: "PASS", status: "DECIDED" },
      { dets: [], verdict: "PASS", status: "DECIDED" },
      {
        dets: [{ classKey: "sim-unknown", confidence: 0.8 }],
        verdict: "NEEDS_REVIEW",
        status: "PENDING_REVIEW",
      },
    ];
    for (const [i, c] of cases.entries()) {
      const res = await postScan(request, token, batch.id, c.dets);
      expect(res.status()).toBe(201);
      expect((await res.json()).data).toMatchObject({
        batchCode: batch.code,
        sequence: i + 1,
        verdict: c.verdict,
        status: c.status,
      });
    }

    const outcomes = await withDb(async (db) => ({
      rework: (
        await db.query(
          `SELECT count(*)::int n FROM rework_tickets r JOIN scans s ON s.id = r."scanId" WHERE s."batchId" = $1`,
          [batch.id],
        )
      ).rows[0].n,
      salvage: (
        await db.query(`SELECT count(*)::int n FROM salvage_items WHERE "originBatchId" = $1`, [
          batch.id,
        ])
      ).rows[0].n,
      unknown: (
        await db.query(
          `SELECT count(*)::int n FROM detections d JOIN scans s ON s.id = d."scanId" WHERE s."batchId" = $1 AND d."isUnknownClass"`,
          [batch.id],
        )
      ).rows[0].n,
    }));
    expect(outcomes).toEqual({ rework: 1, salvage: 1, unknown: 1 });
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

test.describe("people deciding", () => {
  test("scan detail draws the boxes; the inspector overrides a Reject to Rework with a reason", async ({
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

    await page.goto("/login");
    await signIn(page, ACCOUNTS.inspector.email);
    await expect(page).toHaveURL(ACCOUNTS.inspector.home);
    await page.goto(`/scans/${scanId}`);
    await expect(page.getByTestId("detection-box")).toHaveCount(2);
    await expect(page.getByText("Automatically by the camera")).toBeVisible();

    await page.getByRole("button", { name: "Override decision…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Rework/ }).check();
    await dialog.getByRole("button", { name: "Override" }).click();
    await expect(
      dialog.getByText(
        "Enter a reason for changing the camera's decision (at least 3 characters).",
      ),
    ).toBeVisible();
    await dialog.getByLabel("Reason").fill("Surface cut only, can be skived");
    await dialog.getByRole("button", { name: "Override" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("img", { name: "Overridden by a person" })).toBeVisible();
    await expect(page.getByText("Surface cut only, can be skived")).toBeVisible();
    await expect(page.getByText("Cancelled (decision changed)")).toBeVisible();
    await expect(page.getByText("Waiting at repair station")).toBeVisible();
  });

  test("the review queue settles an unknown-class scan in one click", async ({
    browser,
    page,
    request,
  }) => {
    const api = await managerApi(browser);
    const batch = await createBatch(api);
    const { token } = await createDeviceToken();
    await postScan(request, token, batch.id, [{ classKey: "wrinkle", confidence: 0.77 }]);

    await page.goto("/login");
    await signIn(page, ACCOUNTS.inspector.email);
    await expect(page).toHaveURL(ACCOUNTS.inspector.home);
    await page.goto(`/review?batch=${batch.code}`);
    const group = page.getByRole("group", { name: `Decide ${batch.code} · #1` });
    await expect(group).toBeVisible();
    await group.getByRole("button", { name: "Pass" }).click();
    await expect(group).toBeHidden();

    await page.goto(`/scans?batch=${batch.code}`);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("Pass");
  });
});

test("only a Quality Inspector decides a flagged scan; the Floor Manager only sees it (D-028)", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  const res = await postScan(request, token, batch.id, [
    { classKey: "sim-unknown", confidence: 0.8 },
  ]);
  const { scanId } = (await res.json()).data;

  // The Floor Manager: no controls on the scan or in the queue, and the API refuses.
  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/scans/${scanId}`);
  await expect(page.getByText(/Waiting for a Quality Inspector/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Override decision|Pass|Rework|Reject/ }),
  ).toHaveCount(0);
  await page.goto(`/review?batch=${batch.code}`);
  await expect(page.getByRole("group", { name: `Decide ${batch.code} · #1` })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Waiting for a Quality Inspector" })).toBeVisible();
  const refused = await page.request.post(`/api/v1/scans/${scanId}/decision`, {
    data: { verdict: "PASS", expectedFinalVerdict: null },
  });
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error.code).toBe("FORBIDDEN");

  // The Quality Inspector decides it.
  const decided = await (
    await inspectorApi(browser)
  ).post(`/api/v1/scans/${scanId}/decision`, {
    data: { verdict: "PASS", expectedFinalVerdict: null },
  });
  expect(decided.status()).toBe(200);
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
