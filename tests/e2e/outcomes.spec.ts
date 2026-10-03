import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { createBatch, createDeviceToken, managerApi, postScan, withDb } from "./cv-helpers";

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

async function advanceTo(api: APIRequestContext, batchId: string, stages: string[]) {
  let current = "PREPARATION";
  for (const next of stages) {
    const res = await api.post(`/api/v1/batches/${batchId}/stages`, {
      data: { action: "advance", expectedStage: current },
    });
    expect(res.status()).toBe(200);
    current = next;
  }
}

test("a batch completes with a repair open, is tagged In repair, and counts the section once repaired", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  await postScan(request, token, batch.id, [{ classKey: "hole", confidence: 0.7 }]); // #1 REWORK
  await postScan(request, token, batch.id, [{ classKey: "cut", confidence: 0.3 }]); // #2 PASS
  await advanceTo(api, batch.id, ["UPPER_MAKING", "SOLEING", "FINISHING"]);

  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/batches/${batch.id}`);
  await expect(page.getByTestId("yield-usable")).toHaveText("1");
  await expect(page.getByTestId("yield-repair")).toHaveText("1");
  await expect(page.getByText("In repair · 1")).toBeVisible();

  await page.getByRole("button", { name: "Complete batch" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 section is still at the repair station");
  await dialog.getByRole("button", { name: "Complete batch" }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("In repair · 1")).toBeVisible();

  await page.goto(`/batches?q=${batch.code}`);
  await expect(page.getByRole("row", { name: new RegExp(batch.code) })).toContainText(
    "In repair · 1",
  );

  // The repair stays workable on the board after the batch is completed.
  await page.goto(`/rework?batch=${batch.code}`);
  const card = page.getByRole("listitem", { name: `${batch.code} · #1` });
  await card.getByRole("button", { name: "Start repair" }).click();
  await expect(
    page
      .getByRole("region", { name: "Being repaired" })
      .getByRole("listitem", { name: `${batch.code} · #1` }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Being repaired" })
    .getByRole("button", { name: "Mark repaired" })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Repaired, last 7 days" })
      .getByRole("listitem", { name: `${batch.code} · #1` }),
  ).toBeVisible();

  await page.goto(`/batches/${batch.id}`);
  await expect(page.getByTestId("yield-usable")).toHaveText("2");
  await expect(page.getByTestId("yield-repair")).toHaveText("0");
  await expect(page.getByText(/In repair ·/)).toHaveCount(0);
});

test("Undo in the toast puts a repair back where it was", async ({ browser, page, request }) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  await postScan(request, token, batch.id, [{ classKey: "dirt", confidence: 0.65 }]);

  await signInAs(page, ACCOUNTS.inspector); // the QI can work the board too
  await page.goto(`/rework?batch=${batch.code}`);
  await page.getByRole("button", { name: "Start repair" }).click();
  await expect(
    page.getByRole("region", { name: "Being repaired" }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page
      .getByRole("region", { name: "Waiting" })
      .getByRole("listitem", { name: `${batch.code} · #1` }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Being repaired" }).getByRole("listitem"),
  ).toHaveCount(0);
});

test("the Floor Manager reuses rejected leather in another batch, takes it back, and discards another piece", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const origin = await createBatch(api);
  const receiver = await createBatch(api, false);
  const { token } = await createDeviceToken();
  await postScan(request, token, origin.id, [{ classKey: "cut", confidence: 0.95 }]); // #1 REJECT
  await postScan(request, token, origin.id, [{ classKey: "hole", confidence: 0.97 }]); // #2 REJECT

  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/salvage?batch=${origin.code}`);
  const first = page.getByRole("row", { name: `${origin.code} · #1` });
  await first.getByRole("button", { name: "Use in batch…" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("option", { name: new RegExp(origin.code) })).toHaveCount(0); // never its own batch
  await dialog.getByRole("button", { name: "Use in this batch" }).click();
  await expect(dialog.getByText("Choose the batch that will use this section.")).toBeVisible();
  const option = dialog.getByRole("option", { name: new RegExp(receiver.code) });
  await dialog.getByLabel("Batch").selectOption((await option.getAttribute("value"))!);
  await dialog.getByRole("button", { name: "Use in this batch" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/batches/${receiver.id}`);
  await expect(page.getByTestId("yield-salvage-in")).toHaveText("1");

  await page.goto(`/salvage?status=ASSIGNED&batch=${origin.code}`);
  const reused = page.getByRole("row", { name: `${origin.code} · #1` });
  await expect(reused).toContainText(receiver.code);
  await reused.getByRole("button", { name: "Unassign" }).click();
  await expect(page.getByRole("row", { name: `${origin.code} · #1` })).toHaveCount(0);

  await page.goto(`/salvage?batch=${origin.code}`);
  await page
    .getByRole("row", { name: `${origin.code} · #2` })
    .getByRole("button", { name: "Discard…" })
    .click();
  await page.getByRole("dialog").getByLabel("Reason").fill("Too small to cut any component");
  await page.getByRole("dialog").getByRole("button", { name: "Discard section" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto(`/salvage?status=DISCARDED&batch=${origin.code}`);
  await expect(page.getByRole("row", { name: `${origin.code} · #2` })).toContainText(
    "Too small to cut any component",
  );
});

test("the Quality Inspector sees salvage read-only", async ({ browser, page, request }) => {
  const api = await managerApi(browser);
  const origin = await createBatch(api);
  const other = await createBatch(api);
  const { token } = await createDeviceToken();
  await postScan(request, token, origin.id, [{ classKey: "cut", confidence: 0.92 }]);

  await signInAs(page, ACCOUNTS.inspector);
  await page.goto(`/salvage?batch=${origin.code}`);
  await expect(page.getByRole("row", { name: `${origin.code} · #1` })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use in batch|Discard/ })).toHaveCount(0);
  await expect(
    page.getByText("The Floor Manager decides where it is reused or discarded."),
  ).toBeVisible();

  const list = await page.request.get(`/api/v1/salvage?batch=${origin.code}`);
  const itemId = (await list.json()).data.rows[0].id;
  const res = await page.request.post(`/api/v1/salvage/${itemId}/assign`, {
    data: { batchId: other.id, expectedStatus: "AVAILABLE" },
  });
  expect(res.status()).toBe(403);
});

test("cancelling a batch cancels its unfinished repairs", async ({ browser, request }) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  await postScan(request, token, batch.id, [{ classKey: "abrasion", confidence: 0.75 }]);

  const res = await api.post(`/api/v1/batches/${batch.id}/cancel`, {
    data: { reason: "Roll returned to supplier" },
  });
  expect(res.status()).toBe(200);
  const statuses = await withDb(async (db) =>
    (
      await db.query(
        `SELECT r.status FROM rework_tickets r JOIN scans s ON s.id = r."scanId" WHERE s."batchId" = $1`,
        [batch.id],
      )
    ).rows.map((r) => r.status),
  );
  expect(statuses).toEqual(["CANCELLED"]);
  const board = await api.get(`/api/v1/rework?batch=${batch.code}`);
  expect((await board.json()).data.waiting).toHaveLength(0);
});
