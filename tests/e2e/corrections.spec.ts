import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import pg from "pg";
import {
  addInventoryRoll,
  captureApi,
  createDeviceToken,
  createRoll,
  finishRoll,
  inspectorApi,
  managerApi,
  postScan,
} from "./cv-helpers";
import { removeCheckIns } from "./db-cleanup";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * Corrections to past records (Phase 35B, D-133; the panel's revision 3), by the Floor Manager only,
 * always with a reason and an audit row: a batch from any past day, a roll's details (the area only
 * before Finish roll) and a repair's inspection (while the pairs it sent back are still at their stage).
 *
 * The demo plans weekdays only, so the suite plans two days of its own, both 22 to 28 days back (the
 * Saturday and the Sunday there), older than the queue's 7 days so the Day picker is needed. Each has one
 * batch (once a day, 08:00 to 17:00), already inspected, and the rows are removed afterwards.
 */
test.describe.configure({ mode: "serial" });

const manilaDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
  );
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const codeOf = (day: string, n = 1) =>
  `B-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-${n}`;

function dayBack(weekday: number, from: number): string {
  for (let i = from; i < from + 14; i++)
    if (weekdayOf(manilaDay(-i)) === weekday) return manilaDay(-i);
  throw new Error("no such day");
}

const OLD = dayBack(6, 22); // a Saturday, 22 to 28 days back: the batch the Floor Manager corrects
const REPAIR_DAY = dayBack(0, 22); // a Sunday there: a batch with a repair that was inspected
const DAYS = [OLD, REPAIR_DAY];
const OLD_CODE = codeOf(OLD);
const REPAIR_BATCH = codeOf(REPAIR_DAY);
const PARENT = `RP-${REPAIR_BATCH.slice(2)}-1`;
const CHILD = `RP-${REPAIR_BATCH.slice(2)}-2`;

/**
 * A `timestamp` column (stored in UTC, no zone) as an ISO string. `pg` would read it as the laptop's local
 * time, 8 hours off in Manila or Shanghai, and the stale guard would refuse the request.
 */
const UTC = (column: string) => `to_char("${column}", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

async function cleanUp(db: pg.Client) {
  await removeCheckIns(db, "day = ANY($1::date[])", [DAYS]);
  await db.query(`DELETE FROM production_batches WHERE day = ANY($1::date[])`, [DAYS]);
  await db.query(`DELETE FROM day_plans WHERE day = ANY($1::date[])`, [DAYS]);
}

/**
 * A click that lands before React has hydrated does nothing (it showed in a full, loaded run), so click
 * until the dialog is there. The assertions after it are unchanged.
 */
async function openDialog(page: Page, button: Locator) {
  await expect(async () => {
    await button.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

async function signedIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await signIn(page, email);
  await page.waitForURL((url) => url.pathname !== "/login");
  return page;
}

type Done = {
  code: string;
  finished: { checkInId: string; updatedAt: string; correctable: boolean } | null;
};
async function doneOn(page: Page, day: string): Promise<Done[]> {
  const res = await page.request.get(`/api/v1/production/batches?doneDay=${day}`);
  expect(res.status()).toBe(200);
  return (await res.json()).data.done;
}

test.beforeAll(async () => {
  await withDb(async (db) => {
    await cleanUp(db);
    const qi = (await db.query(`SELECT id FROM users WHERE email = $1`, [ACCOUNTS.inspector.email]))
      .rows[0].id as string;
    for (const day of DAYS) {
      await db.query(
        `INSERT INTO day_plans (id, day, kind, "rollsPlanned", quota, "intervalMinutes", "shiftStart", "shiftEnd", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1::date, 'PLANNED', 2, 50, NULL, '08:00', '17:00', now(), now())`,
        [day],
      );
      // 08:00–17:00 Manila is 00:00Z–09:00Z. Both batches were inspected on their own day, 17:10.
      await db.query(
        `INSERT INTO production_batches (id, code, day, number, "startAt", "slotAt", status, priority, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::date, 1, $3::timestamp, $4::timestamp, 'INSPECTED', 'NORMAL', now(), now())`,
        [codeOf(day), day, `${day} 00:00:00`, `${day} 09:00:00`],
      );
    }
    // The batch to correct: 20 pairs, none failed.
    await db.query(
      `INSERT INTO production_check_ins (id, day, "slotAt", "enteredAt", "enteredById", pairs, "failedPairs", "batchId", "updatedAt")
       SELECT gen_random_uuid(), $1::date, $2::timestamp, $3::timestamp, $4::uuid, 20, 0, b.id, now()
       FROM production_batches b WHERE b.code = $5`,
      [OLD, `${OLD} 09:00:00`, `${OLD} 09:10:00`, qi, OLD_CODE],
    );
    // The batch with a repair: 5 failed pairs (Fixable at Sole-ing); the repair came back and was
    // inspected (3 passed, 2 sent back again to Finishing, still at their stage).
    const type = (
      await db.query(`SELECT id FROM final_defect_types ORDER BY "sortOrder", label LIMIT 1`)
    ).rows[0].id as string;
    const checkIn = (
      await db.query(
        `INSERT INTO production_check_ins (id, day, "slotAt", "enteredAt", "enteredById", pairs, "failedPairs", "batchId", "updatedAt")
         SELECT gen_random_uuid(), $1::date, $2::timestamp, $3::timestamp, $4::uuid, 20, 5, b.id, now()
         FROM production_batches b WHERE b.code = $5 RETURNING id`,
        [REPAIR_DAY, `${REPAIR_DAY} 09:00:00`, `${REPAIR_DAY} 09:10:00`, qi, REPAIR_BATCH],
      )
    ).rows[0].id as string;
    const finding = (
      await db.query(
        `INSERT INTO inspection_findings (id, "checkInId", "finalDefectTypeId", pairs, remedy, "returnStage", "createdAt")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 5, 'FIXABLE', 'SOLE_ING', now()) RETURNING id`,
        [checkIn, type],
      )
    ).rows[0].id as string;
    const parent = (
      await db.query(
        `INSERT INTO repair_jobs (id, code, "findingId", pairs, stage, status, "sentAt", "backAt", "inspectedAt", "inspectedById", "passedPairs", "scrappedPairs", "resentPairs", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::uuid, 5, 'SOLE_ING', 'DONE', $3::timestamp, $3::timestamp, $4::timestamp, $5::uuid, 3, 0, 2, now()) RETURNING id`,
        [PARENT, finding, `${REPAIR_DAY} 09:15:00`, `${REPAIR_DAY} 09:40:00`, qi],
      )
    ).rows[0].id as string;
    await db.query(
      `INSERT INTO repair_jobs (id, code, "findingId", "parentId", pairs, stage, status, "sentAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2::uuid, $3::uuid, 2, 'FINISHING', 'AT_STAGE', $4::timestamp, now())`,
      [CHILD, finding, parent, `${REPAIR_DAY} 09:40:00`],
    );
  });
});

test.afterAll(async () => {
  await withDb(cleanUp);
});

test("the Floor Manager corrects a batch from a past day; the Quality Inspector can't", async ({
  browser,
}) => {
  const manager = await signedIn(browser, ACCOUNTS.manager.email);
  await manager.goto("/batches?tab=queue");
  // The last 7 days don't reach it, so the Day picker is how the Floor Manager gets there.
  await expect(manager.getByTestId(`done-${OLD_CODE}`)).toHaveCount(0);
  await manager.getByLabel("Batch date").fill(OLD);
  await manager.getByRole("button", { name: "Show this date" }).click();
  await expect(manager).toHaveURL(new RegExp(`doneDay=${OLD}`));
  await expect(manager.getByTestId("done-description")).toContainText("Batches of");
  const row = manager.getByTestId(`done-${OLD_CODE}`);
  await expect(row).toContainText("20 pairs, 0 failed");

  await openDialog(manager, row.getByRole("button", { name: /^Correct/ }));
  const dialog = manager.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // No reason, no save.
  await dialog.getByLabel(new RegExp(`^Pairs finished in ${OLD_CODE}`)).fill("18");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByText(/at least 5 characters|Say why/i).first()).toBeVisible();
  await dialog.getByLabel("Why are you correcting it?").fill("Counted a rack twice");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog).toBeHidden();

  // The batch keeps showing who corrected it, when and why.
  await expect(row).toContainText("18 pairs, 0 failed");
  await expect(row.getByTestId("batch-correction")).toContainText("Counted a rack twice");
  await expect(row.getByTestId("batch-correction")).toContainText(/Corrected by .+, .+:/);

  // Both counts and the reason are in the audit log, marked as a correction made on a later day.
  await withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT a.before, a.after FROM audit_logs a
       JOIN production_check_ins c ON c.id::text = a."entityId"
       WHERE a.action = 'production.checkin.correct' AND c.day = $1::date`,
      [OLD],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].before).toMatchObject({ pairs: 20, failedPairs: 0 });
    expect(rows[0].after).toMatchObject({
      pairs: 18,
      reason: "Counted a rack twice",
      correctedOnLaterDay: true,
    });
  });

  // Operations marks the day Corrected and links to the Floor Manager's list of its batches.
  await manager.goto(`/reports?from=${OLD}&to=${OLD}`);
  const table = manager.getByTestId("ops-production-table");
  await expect(table.getByTestId("day-corrected")).toBeVisible();
  await table.getByTestId(`see-batches-${OLD}`).click();
  await expect(manager).toHaveURL(new RegExp(`doneDay=${OLD}`));
  await expect(manager.getByTestId(`done-${OLD_CODE}`)).toBeVisible();

  // The Quality Inspector sees the batch on that day but has no Correct, and the API says why.
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  await qi.goto(`/batches?tab=queue&doneDay=${OLD}`);
  const qiRow = qi.getByTestId(`done-${OLD_CODE}`);
  await expect(qiRow).toBeVisible();
  await expect(qiRow.getByRole("button", { name: /^Correct/ })).toHaveCount(0);
  const [item] = (await doneOn(qi, OLD)).filter((d) => d.code === OLD_CODE);
  expect(item.finished?.correctable).toBe(false);
  const refused = await (
    await inspectorApi(browser)
  ).patch(`/api/v1/production/check-ins/${item.finished!.checkInId}`, {
    data: {
      expectedUpdatedAt: item.finished!.updatedAt,
      pairs: "17",
      failedPairs: "0",
      reason: "Trying a past day",
    },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error.message).toContain("Ask the Floor Manager to correct it");
});

test("a past batch whose repair is back keeps its failed pairs, and still takes the other counts", async ({
  browser,
}) => {
  const manager = await managerApi(browser);
  const { checkInId, updatedAt } = await withDb(async (db) => {
    // The parent repair is Done and its child is At stage, so nothing is locked yet; put the child Back.
    await db.query(
      `UPDATE repair_jobs SET status = 'BACK_FOR_INSPECTION', "backAt" = now() WHERE code = $1`,
      [CHILD],
    );
    const { rows } = await db.query(
      `SELECT id, ${UTC("updatedAt")} AS "updatedAt" FROM production_check_ins WHERE day = $1::date`,
      [REPAIR_DAY],
    );
    return {
      checkInId: rows[0].id as string,
      updatedAt: rows[0].updatedAt as string,
    };
  });
  const changeFailed = await manager.patch(`/api/v1/production/check-ins/${checkInId}`, {
    data: {
      expectedUpdatedAt: updatedAt,
      pairs: "20",
      failedPairs: "4",
      reason: "One pair was fine",
    },
  });
  expect(changeFailed.status()).toBe(409);
  expect((await changeFailed.json()).error.message).toContain("already back for inspection");
  // The pairs finished can still change; the failed count and lines stay as they were.
  const changePairs = await manager.patch(`/api/v1/production/check-ins/${checkInId}`, {
    data: {
      expectedUpdatedAt: updatedAt,
      pairs: "21",
      failedPairs: "5",
      reason: "Miscounted a rack",
    },
  });
  expect(changePairs.status()).toBe(200);
  await withDb(async (db) => {
    await db.query(`UPDATE repair_jobs SET status = 'AT_STAGE', "backAt" = NULL WHERE code = $1`, [
      CHILD,
    ]);
  });
});

test("the Floor Manager corrects a roll's details; the area is fixed after Finish roll", async ({
  browser,
}) => {
  const tag = `E2E-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const roll = await addInventoryRoll({ tagCode: tag, areaSqFt: 24.5 });
  const manager = await signedIn(browser, ACCOUNTS.manager.email);
  await manager.goto(`/reports/rolls/${roll.id}`);
  await openDialog(manager, manager.getByRole("button", { name: "Edit details" }));
  const dialog = manager.getByRole("dialog");
  await expect(dialog.getByLabel("Area (sq ft)")).toBeEnabled();

  // Nothing changed, and then a change without a reason, each answered in the dialog.
  await dialog.getByLabel("Why are you correcting it?").fill("Checking the stamp again");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(
    dialog.getByText("Nothing changed. Change a field, or close this window."),
  ).toBeVisible();
  await dialog.getByLabel("Tag number").fill(`${tag}-B`);
  await dialog.getByLabel("Area (sq ft)").fill("30.25");
  await dialog.getByLabel("Why are you correcting it?").fill("");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByText(/at least 5 characters/)).toBeVisible();
  await dialog.getByLabel("Why are you correcting it?").fill("Read the tag and stamp wrongly");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog).toBeHidden();
  const details = manager.getByLabel("Roll details");
  await expect(details).toContainText(`${tag}-B`);
  await expect(details).toContainText("30.25 sq ft");

  // Only what changed is in the audit log, with the old and the new value and the reason.
  await withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT before, after FROM audit_logs WHERE "entityId" = $1 AND action = 'roll.update'`,
      [roll.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].before).toEqual({ tagCode: tag, areaSqFt: 24.5 });
    expect(rows[0].after).toMatchObject({
      tagCode: `${tag}-B`,
      areaSqFt: 30.25,
      reason: "Read the tag and stamp wrongly",
    });
  });

  // A finished roll: the tag still changes, the area is shown but fixed, and the API refuses it.
  const sc = await captureApi(browser);
  const finished = await createRoll(sc, { tagCode: `${tag}-F` });
  const { token } = await createDeviceToken();
  expect((await postScan(manager.context().request, token, finished.id, [])).status()).toBe(201);
  await finishRoll(sc, finished.id);
  await manager.goto(`/reports/rolls/${finished.id}`);
  await openDialog(manager, manager.getByRole("button", { name: "Edit details" }));
  const after = manager.getByRole("dialog");
  await expect(after.getByLabel("Area (sq ft)")).toBeDisabled();
  await expect(after.getByText(/Fixed after Finish roll/)).toBeVisible();
  const api = await managerApi(browser);
  const detail = await (await api.get(`/api/v1/rolls/${finished.id}`)).json();
  const refused = await api.patch(`/api/v1/rolls/${finished.id}`, {
    data: {
      expectedUpdatedAt: detail.data.updatedAt,
      areaSqFt: "40",
      reason: "Trying to change the area",
    },
  });
  expect(refused.status()).toBe(422);
  expect(JSON.stringify(await refused.json())).toContain("The area can't change after Finish roll");
  const tagOnly = await api.patch(`/api/v1/rolls/${finished.id}`, {
    data: {
      expectedUpdatedAt: detail.data.updatedAt,
      tagCode: `${tag}-G`,
      reason: "Tag typed wrongly",
    },
  });
  expect(tagOnly.status()).toBe(200);

  // Nobody else may: the Quality Inspector and a constructor are refused.
  for (const other of [await inspectorApi(browser), sc]) {
    const res = await other.patch(`/api/v1/rolls/${finished.id}`, {
      data: { expectedUpdatedAt: detail.data.updatedAt, tagCode: "X", reason: "Not allowed" },
    });
    expect(res.status()).toBe(403);
  }
});

test("the Floor Manager corrects a repair's inspection until a job it sent back moves on", async ({
  browser,
}) => {
  const manager = await signedIn(browser, ACCOUNTS.manager.email);
  await manager.goto(`/batches?tab=queue&doneDay=${REPAIR_DAY}`);
  const row = manager.getByTestId(`done-${PARENT}`);
  await expect(row).toContainText("3 passed, 0 scrapped, 2 sent back again");

  await openDialog(manager, row.getByRole("button", { name: /^Correct/ }));
  const dialog = manager.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The total stays 5: one more passes, one fewer is sent back.
  await dialog.getByLabel("Passed").fill("4");
  await dialog.getByLabel("Pairs, line 1").fill("1");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByText(/at least 5 characters/)).toBeVisible();
  await dialog.getByLabel("Why are you correcting it?").fill("One pair passed after all");
  await dialog.getByLabel("Passed").fill("5");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByText(/add up to 6, but this repair has 5/)).toBeVisible();
  await dialog.getByLabel("Passed").fill("4");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("4 passed, 0 scrapped, 1 sent back again");

  await withDb(async (db) => {
    const jobs = await db.query(
      `SELECT code, pairs, "passedPairs", "resentPairs" FROM repair_jobs WHERE code = ANY($1::text[]) ORDER BY code`,
      [[PARENT, CHILD]],
    );
    expect(jobs.rows).toEqual([
      { code: PARENT, pairs: 5, passedPairs: 4, resentPairs: 1 },
      { code: CHILD, pairs: 1, passedPairs: null, resentPairs: null },
    ]);
    const audit = await db.query(
      `SELECT a.before, a.after FROM audit_logs a JOIN repair_jobs j ON j.id::text = a."entityId"
       WHERE a.action = 'repair.inspect.correct' AND j.code = $1`,
      [PARENT],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].before).toMatchObject({ passedPairs: 3, resentPairs: 2 });
    expect(audit.rows[0].after).toMatchObject({
      passedPairs: 4,
      resentPairs: 1,
      reason: "One pair passed after all",
    });
  });

  // Once the pair it sent back is Back for inspection, the inspection is locked, in the page and the API.
  await withDb(async (db) => {
    await db.query(
      `UPDATE repair_jobs SET status = 'BACK_FOR_INSPECTION', "backAt" = now() WHERE code = $1`,
      [CHILD],
    );
  });
  await manager.reload();
  await expect(manager.getByTestId(`done-${PARENT}`)).toContainText(
    "is already back for inspection, so this inspection can't change",
  );
  await expect(
    manager.getByTestId(`done-${PARENT}`).getByRole("button", { name: /^Correct/ }),
  ).toHaveCount(0);
  const api = await managerApi(browser);
  const parentId = await withDb(
    async (db) =>
      (
        await db.query(
          `SELECT id, ${UTC("updatedAt")} AS "updatedAt" FROM repair_jobs WHERE code = $1`,
          [PARENT],
        )
      ).rows[0],
  );
  const body = {
    expectedUpdatedAt: parentId.updatedAt as string,
    passedPairs: "5",
    scrappedPairs: "0",
    resend: [],
    reason: "Trying after it moved on",
  };
  const locked = await api.patch(`/api/v1/production/repairs/${parentId.id}/inspect`, {
    data: body,
  });
  expect(locked.status()).toBe(409);
  expect((await locked.json()).error.message).toContain("so this inspection can't change");

  // The Quality Inspector may not correct one at all.
  const forbidden = await (
    await inspectorApi(browser)
  ).patch(`/api/v1/production/repairs/${parentId.id}/inspect`, { data: body });
  expect(forbidden.status()).toBe(403);
});
