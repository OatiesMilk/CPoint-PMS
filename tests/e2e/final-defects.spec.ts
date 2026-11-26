import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { makeConstructor } from "./cv-helpers";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * Final defects and repairs (Phase 34, D-130): the QI says what was wrong with the failed pairs of
 * a batch (Fixable or Not fixable, and the stage a fixable one goes back to), each fixable line
 * starts a repair job, the Floor Manager moves one and calls another not fixable after all, the
 * stage marks one back for inspection, it waits in the Queue under its code and the QI inspects
 * it. The suggestion appears after 5 findings of a type in 4 weeks and is never filled in.
 *
 * The demo plans weekdays only, so the suite plans three of its own days, all 2 to 3 weeks back
 * (the Saturday and Sunday before last weekend's, and the Saturday before that), each with one
 * batch (once a day, 08:00 to 17:00), and removes only those rows afterwards. It never touches
 * another spec's check-ins (the Phase 33 run 4 clash).
 */
test.describe.configure({ mode: "serial" });

const manilaDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
  );
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const codeOf = (day: string, n = 1) =>
  `B-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-${n}`;

/** The first day from `from` days back, going back, that falls on `weekday` (0 = Sunday). */
function dayBack(weekday: number, from: number): string {
  for (let i = from; i < from + 14; i++)
    if (weekdayOf(manilaDay(-i)) === weekday) return manilaDay(-i);
  throw new Error("no such day");
}

// Last week's weekend belongs to inspection-queue.spec.ts: these are the ones before it.
const MAIN = dayBack(6, 8); // Saturday 8 to 14 days back
const SEEDED = dayBack(0, 8); // Sunday 8 to 14 days back: holds the five earlier findings
const SUGGEST = dayBack(6, 15); // Saturday 15 to 21 days back: the suggestion is checked here
const DAYS = [MAIN, SEEDED, SUGGEST];
const MARKER = "E2E_MARKER";
const MAIN_CODE = codeOf(MAIN);
const SUGGEST_CODE = codeOf(SUGGEST);
const repairCode = (n: number) => `RP-${MAIN_CODE.slice(2)}-${n}`;

async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** The constructors the route-matrix test makes, so the clean-up can remove them. */
const people: { id: string; email: string }[] = [];

async function cleanUp(db: pg.Client) {
  const days = [DAYS];
  await db.query(
    `DELETE FROM repair_jobs WHERE "findingId" IN (
       SELECT f.id FROM inspection_findings f
       JOIN production_check_ins c ON c.id = f."checkInId" WHERE c.day = ANY($1::date[]))`,
    days,
  );
  await db.query(
    `DELETE FROM inspection_findings WHERE "checkInId" IN (
       SELECT id FROM production_check_ins WHERE day = ANY($1::date[]))`,
    days,
  );
  await db.query(`DELETE FROM production_check_ins WHERE day = ANY($1::date[])`, days);
  await db.query(`DELETE FROM production_batches WHERE day = ANY($1::date[])`, days);
  await db.query(`DELETE FROM day_plans WHERE day = ANY($1::date[])`, days);
  await db.query(`DELETE FROM final_defect_types WHERE key = $1`, [MARKER]);
  if (people.length) {
    const ids = people.map((p) => p.id);
    await db.query(`DELETE FROM stage_assignments WHERE "userId" = ANY($1::uuid[])`, [ids]);
    // Audit rows keep their place; if a user can't go, they are switched off.
    try {
      await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    } catch {
      await db.query(`UPDATE users SET "isActive" = false WHERE id = ANY($1::uuid[])`, [ids]);
    }
  }
}

async function signedIn(
  browser: Browser,
  email: string,
  viewport?: { width: number; height: number },
): Promise<Page> {
  const page = await (await browser.newContext(viewport ? { viewport } : {})).newPage();
  await page.goto("/login");
  await signIn(page, email);
  await page.waitForURL((url) => url.pathname !== "/login");
  return page;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

type Scope = Pick<Page, "getByLabel" | "getByRole">;

/** The line's controls by their labels (every one names its line). */
const line = (page: Scope, n: number) => ({
  defect: page.getByLabel(`Defect, line ${n}`),
  pairs: page.getByLabel(`Pairs, line ${n}`, { exact: true }),
  fixable: page
    .getByRole("radiogroup", { name: `Can line ${n} be fixed?` })
    .getByLabel("Fixable", { exact: true }),
  notFixable: page
    .getByRole("radiogroup", { name: `Can line ${n} be fixed?` })
    .getByLabel("Not fixable", { exact: true }),
  stage: page.getByLabel(`Goes back to, line ${n}`),
  note: page.getByLabel(new RegExp(`(Note|Describe the defect), line ${n}`)),
});

async function openInspect(page: Page, code: string) {
  await page.goto("/batches?tab=queue");
  await page
    .getByTestId(`queue-${code}`)
    .getByRole("button", { name: /^Inspect/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeAll(async () => {
  await withDb(async (db) => {
    await cleanUp(db);
    for (const day of DAYS) {
      await db.query(
        `INSERT INTO day_plans (id, day, kind, "rollsPlanned", quota, "intervalMinutes", "shiftStart", "shiftEnd", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1::date, 'PLANNED', 2, 50, NULL, '08:00', '17:00', now(), now())`,
        [day],
      );
      // 08:00–17:00 Manila is 00:00Z–09:00Z. The seeded day's batch is already inspected.
      await db.query(
        `INSERT INTO production_batches (id, code, day, number, "startAt", "slotAt", status, priority, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::date, 1, $3::timestamp, $4::timestamp, $5::"BatchStatus", 'NORMAL', now(), now())`,
        [
          codeOf(day),
          day,
          `${day} 00:00:00`,
          `${day} 09:00:00`,
          day === SEEDED ? "INSPECTED" : "OPEN",
        ],
      );
    }
    // A defect type of the suite's own, with five Fixable findings at Sole-ing from the seeded
    // day's batch, so the suggestion shows without relying on the demo data.
    const type = await db.query(
      `INSERT INTO final_defect_types (id, key, label, "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'E2E marker defect', true, 90, now(), now()) RETURNING id`,
      [MARKER],
    );
    const qi = await db.query(`SELECT id FROM users WHERE email = $1`, [ACCOUNTS.inspector.email]);
    const checkIn = await db.query(
      `INSERT INTO production_check_ins (id, day, "slotAt", "enteredAt", "enteredById", pairs, "failedPairs", "batchId", "updatedAt")
       SELECT gen_random_uuid(), $1::date, $2::timestamp, now(), $3::uuid, 20, 5, b.id, now()
       FROM production_batches b WHERE b.code = $4 RETURNING id`,
      [SEEDED, `${SEEDED} 09:00:00`, qi.rows[0].id, codeOf(SEEDED)],
    );
    for (let i = 0; i < 5; i++)
      await db.query(
        `INSERT INTO inspection_findings (id, "checkInId", "finalDefectTypeId", pairs, remedy, "returnStage", "createdAt")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 1, 'FIXABLE', 'SOLE_ING', now())`,
        [checkIn.rows[0].id, type.rows[0].id],
      );
  });
});

test.afterAll(async () => {
  await withDb(cleanUp);
});

test("the QI lists what was wrong, and each fixable line starts a repair at its stage", async ({
  browser,
}) => {
  const page = await signedIn(browser, ACCOUNTS.inspector.email);
  const dialog = await openInspect(page, MAIN_CODE);
  await dialog.getByLabel(/Pairs finished in/).fill("20");
  // With nothing failed there is no "What was wrong" section.
  await expect(dialog.getByText("What was wrong")).toHaveCount(0);
  await dialog.getByLabel("Of these, failed inspection").fill("6");
  await expect(dialog.getByText("What was wrong")).toBeVisible();
  await expect(dialog.getByText("0 of 6 failed pairs have a reason.")).toBeVisible();

  // Line 1 and 2: Fixable at a stage; line 3: Other, which needs a note; line 4: Not fixable.
  const l1 = line(dialog, 1);
  await l1.defect.selectOption({ label: "Lifted sole" });
  await l1.pairs.fill("2");
  await l1.fixable.check();
  await l1.stage.selectOption({ label: "Sole-ing" });
  await dialog.getByRole("button", { name: "Add another defect" }).click();
  const l2 = line(dialog, 2);
  await l2.defect.selectOption({ label: "Glue marks" });
  await l2.pairs.fill("2");
  await l2.fixable.check();
  await l2.stage.selectOption({ label: "Finishing" });
  await dialog.getByRole("button", { name: "Add another defect" }).click();
  const l3 = line(dialog, 3);
  await l3.defect.selectOption({ label: "Other" });
  await l3.pairs.fill("1");
  await l3.notFixable.check();
  await dialog.getByRole("button", { name: "Add another defect" }).click();
  const l4 = line(dialog, 4);
  await l4.defect.selectOption({ label: "Loose stitching" });
  await l4.pairs.fill("2");
  await l4.fixable.check();
  // Only after Fixable is chosen does a stage appear, and none appears for Not fixable.
  await expect(l3.stage).toHaveCount(0);
  // No repair goes back to Preparation (D-136): the camera already checked the leather.
  await expect(l4.stage.getByRole("option", { name: "Preparation" })).toHaveCount(0);
  await expect(l4.stage.getByRole("option", { name: "Construction" })).toHaveCount(1);

  // The messages name the line and the fix, and clear as it is fixed.
  const finish = dialog.getByRole("button", { name: `Finish ${MAIN_CODE}` });
  // Three errors at once (line 2's pairs, line 3's description, line 4's stage) make the summary
  // appear: each of its links points at the field it is about (F1 of the run 1 triage).
  await l2.pairs.fill("");
  await finish.click();
  await expect(dialog.getByText("Describe the defect on line 3.").first()).toBeVisible();
  await expect(dialog.getByText("Choose the stage line 4 goes back to.").first()).toBeVisible();
  const summary = dialog.getByTestId("form-error-summary");
  await expect(
    summary.getByRole("link", { name: "Describe the defect on line 3." }),
  ).toHaveAttribute("href", "#finding-2-note");
  await expect(
    summary.getByRole("link", { name: "Enter how many pairs on line 2 (1 or more)." }),
  ).toHaveAttribute("href", "#finding-1-pairs");
  await l2.pairs.fill("2");
  await l3.note.fill("Torn lining");
  await l4.stage.selectOption({ label: "Construction" });
  // 2 + 2 + 1 + 2 = 7 for 6 failed pairs.
  await expect(dialog.getByText("You listed 7 for 6 failed pairs. Remove 1.")).toBeVisible();
  await finish.click();
  await expect(
    dialog.getByText(
      "The lines add up to 7 pairs, but 6 failed. Change the lines or the failed count.",
    ),
  ).toBeVisible();
  await expect(l4.pairs).toBeVisible();
  // Two lines of one defect and remedy are one line.
  await dialog.getByRole("button", { name: "Add another defect" }).click();
  const l5 = line(dialog, 5);
  await l5.defect.selectOption({ label: "Glue marks" });
  await l5.pairs.fill("1");
  await l5.fixable.check();
  await l5.stage.selectOption({ label: "Finishing" });
  await finish.click();
  await expect(
    dialog.getByText("Glue marks is listed twice. Combine them into one line."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Remove line 5" }).click();
  await l4.pairs.fill("1");
  await expect(dialog.getByText(/failed pairs/).filter({ hasText: "You listed" })).toHaveCount(0);

  expect(await axe(page)).toEqual([]);
  await finish.click();
  await expect(page.getByText(`${MAIN_CODE} finished.`)).toBeVisible();

  // Each fixable line is a job at its stage: -1 Lifted sole at Sole-ing, -2 Glue marks at
  // Finishing, -3 Loose stitching at Construction. The Not fixable line has none.
  const jobs = await withDb(
    async (db) =>
      (
        await db.query(
          `SELECT j.code, j.stage, j.status, j.pairs, t.label FROM repair_jobs j
         JOIN inspection_findings f ON f.id = j."findingId"
         JOIN final_defect_types t ON t.id = f."finalDefectTypeId"
         JOIN production_check_ins c ON c.id = f."checkInId" WHERE c.day = $1::date ORDER BY j.code`,
          [MAIN],
        )
      ).rows,
  );
  expect(jobs).toEqual([
    { code: repairCode(1), stage: "SOLE_ING", status: "AT_STAGE", pairs: 2, label: "Lifted sole" },
    { code: repairCode(2), stage: "FINISHING", status: "AT_STAGE", pairs: 2, label: "Glue marks" },
    {
      code: repairCode(3),
      stage: "CONSTRUCTION",
      status: "AT_STAGE",
      pairs: 1,
      label: "Loose stitching",
    },
  ]);
  await page.context().close();
});

test("the Floor Manager moves one repair and calls another not fixable; the stage marks one back; the QI inspects it", async ({
  browser,
}) => {
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  await fm.goto("/batches?tab=wip");
  await expect(fm.getByTestId("wip-board")).toBeVisible();
  const card = (stage: string) => fm.getByTestId(`wip-${stage}`);
  await expect(card("SOLE_ING")).toContainText(repairCode(1));
  await expect(card("FINISHING")).toContainText(repairCode(2));
  await expect(card("CONSTRUCTION")).toContainText(repairCode(3));
  expect(await axe(fm)).toEqual([]);

  // Move -1 from Sole-ing to Construction (a reason is needed).
  await card("SOLE_ING")
    .getByRole("button", { name: `Change ${repairCode(1)}` })
    .click();
  const change = fm.getByRole("dialog");
  await change.getByLabel("Move to").selectOption({ label: "Construction" });
  await change.getByRole("button", { name: "Save change" }).click();
  await expect(change.getByText("Say why, at least 5 characters.")).toBeVisible();
  await change.getByLabel("Why?").fill("The upper needs re-stitching first");
  await change.getByRole("button", { name: "Save change" }).click();
  await expect(fm.getByText(`${repairCode(1)} moved to Construction.`)).toBeVisible();
  await expect(card("CONSTRUCTION")).toContainText(repairCode(1));
  await expect(card("SOLE_ING")).not.toContainText(repairCode(1));

  // -2 is not fixable after all: its pairs are scrapped and it leaves the board.
  await card("FINISHING")
    .getByRole("button", { name: `Change ${repairCode(2)}` })
    .click();
  await fm.getByRole("dialog").getByLabel("What do you want to do?").selectOption("notFixable");
  await fm.getByRole("dialog").getByLabel("Why?").fill("The glue ate through the leather");
  await fm.getByRole("dialog").getByRole("button", { name: "Save change" }).click();
  await expect(fm.getByText(`${repairCode(2)} marked not fixable after all.`)).toBeVisible();
  await expect(card("FINISHING")).not.toContainText(repairCode(2));
  const states = await withDb(
    async (db) =>
      (
        await db.query(
          `SELECT code, status, stage FROM repair_jobs WHERE code LIKE $1 ORDER BY code`,
          [`RP-${MAIN_CODE.slice(2)}-%`],
        )
      ).rows,
  );
  expect(states).toEqual([
    { code: repairCode(1), status: "AT_STAGE", stage: "CONSTRUCTION" },
    { code: repairCode(2), status: "CANCELLED", stage: "FINISHING" },
    { code: repairCode(3), status: "AT_STAGE", stage: "CONSTRUCTION" },
  ]);

  // The Floor Manager marks -1 Back for inspection (the stage's constructor does the same on
  // Capture); once it is back it can't be moved or changed any more.
  const before = await (await fm.request.get("/api/v1/production/today")).json();
  await card("CONSTRUCTION")
    .getByRole("button", { name: `Back for inspection ${repairCode(1)}` })
    .click();
  await expect(fm.getByText(`${repairCode(1)} is back for inspection.`)).toBeVisible();
  await expect(card("CONSTRUCTION")).not.toContainText(repairCode(1));
  const late = await fm.request.patch(
    `/api/v1/production/repairs/${await repairId(repairCode(1))}`,
    { data: { action: "notFixable", reason: "Too late to change it" } },
  );
  expect(late.status()).toBe(409);
  await fm.context().close();

  // The QI finds it in the Queue under its code and inspects it.
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  await qi.goto("/batches?tab=queue");
  const row = qi.getByTestId(`repair-${repairCode(1)}`);
  await expect(row).toContainText(MAIN_CODE);
  await expect(row).toContainText("Lifted sole, 2 pairs");
  await expect(row).toContainText("back from Construction");
  await row.getByRole("button", { name: /^Inspect repair/ }).click();
  const dialog = qi.getByRole("dialog");
  await dialog.getByLabel("Passed").fill("1");
  await expect(dialog.getByText("1 of 2 pairs accounted for.")).toBeVisible();
  await dialog.getByRole("button", { name: "Save inspection" }).click();
  await expect(
    dialog.getByText(
      "Passed, scrapped and sent back again add up to 1, but this repair has 2 pairs. Change the numbers.",
    ),
  ).toBeVisible();
  // One passes; the other fails again and goes back, to Finishing (no limit on this).
  await dialog.getByRole("button", { name: "Send some back again" }).click();
  await dialog.getByLabel("Goes back to, line 1").selectOption({ label: "Finishing" });
  await dialog.getByLabel("Pairs, line 1").fill("1");
  expect(await axe(qi)).toEqual([]);
  await dialog.getByRole("button", { name: "Save inspection" }).click();
  await expect(
    qi.getByText(`${repairCode(1)} inspected. Sent back again as ${repairCode(4)}.`),
  ).toBeVisible();
  await expect(qi.getByTestId(`repair-${repairCode(1)}`)).toHaveCount(0);
  await expect(qi.getByTestId(`done-${repairCode(1)}`)).toContainText(
    "1 passed, 0 scrapped, 1 sent back again",
  );

  // Today's passed count moved by the repaired pair (A-64), and the repair isn't in the tab's due count.
  const after = await (await qi.request.get("/api/v1/production/today")).json();
  expect(after.data.progress.repairedPassed).toBe(before.data.progress.repairedPassed + 1);
  // No `before.passed + 1`: `passed` is the whole line's total for today and other specs finish and
  // delete batches today while this runs. The identity inside one response is exact (A-64).
  const p = after.data.progress;
  expect(p.passed).toBe(Math.max(0, p.finished - p.failed) + p.repairedPassed);
  await qi.context().close();
});

test("who may do what with a repair: a constructor can't read the board, move or inspect one; Back is the stage's own (A3)", async ({
  browser,
}) => {
  // A is at Sole-ing and B at Construction today, neither with Capture access. -3 (Loose stitching)
  // is At stage at Construction. Bodies are valid, because a body is parsed before the second
  // permission check, so a bad one would answer 422 instead of 403.
  const a = await makeConstructor({ canCapture: false });
  const b = await makeConstructor({ canCapture: false });
  people.push(a, b);
  await withDb(async (db) => {
    const fm = (await db.query(`SELECT id FROM users WHERE email = $1`, [ACCOUNTS.manager.email]))
      .rows[0].id;
    await db.query(
      `INSERT INTO stage_assignments (id, day, stage, "userId", "assignedById") VALUES
        (gen_random_uuid(), $1::date, 'SOLE_ING', $2::uuid, $4::uuid),
        (gen_random_uuid(), $1::date, 'CONSTRUCTION', $3::uuid, $4::uuid)`,
      [manilaDay(), a.id, b.id, fm],
    );
  });
  const id = await repairId(repairCode(3));
  const repair = `/api/v1/production/repairs/${id}`;
  const move = { action: "move", stage: "FINISHING", reason: "Needs gluing first" };
  const notFixable = { action: "notFixable", reason: "Cannot be saved" };

  const asA = await signedIn(browser, a.email);
  expect((await asA.request.get("/api/v1/production/wip")).status()).toBe(403);
  const wrongStage = await asA.request.patch(repair, { data: { action: "back" } });
  expect(wrongStage.status()).toBe(403);
  expect((await wrongStage.json()).error.message).toContain("Construction");
  expect((await asA.request.patch(repair, { data: move })).status()).toBe(403);
  expect((await asA.request.patch(repair, { data: notFixable })).status()).toBe(403);
  expect((await asA.request.post(`${repair}/inspect`, { data: { passedPairs: 1 } })).status()).toBe(
    403,
  );
  expect((await asA.request.get("/api/v1/production/defect-suggestions")).status()).toBe(403);
  expect(
    (
      await asA.request.put(`/api/v1/production/stages/${manilaDay(30)}`, {
        data: { assignments: [] },
      })
    ).status(),
  ).toBe(403);
  await asA.context().close();

  // Moving a repair is the Floor Manager's alone, even for the stage's own constructor.
  const asB = await signedIn(browser, b.email);
  expect((await asB.request.patch(repair, { data: move })).status()).toBe(403);

  // Role by role: the QI reads the board and changes nothing; the System Admin has no board.
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  expect((await qi.request.get("/api/v1/production/wip")).status()).toBe(200);
  expect((await qi.request.patch(repair, { data: { action: "back" } })).status()).toBe(403);
  await qi.context().close();
  const admin = await signedIn(browser, ACCOUNTS.admin.email);
  expect((await admin.request.get("/api/v1/production/wip")).status()).toBe(403);
  await admin.context().close();
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  expect((await fm.request.get("/api/v1/production/wip")).status()).toBe(200);
  await fm.context().close();

  // Last: B marks -3 back (their own stage), and a second Back is refused as already done.
  const back = await asB.request.patch(repair, { data: { action: "back" } });
  expect(back.status()).toBe(200);
  const again = await asB.request.patch(repair, { data: { action: "back" } });
  expect(again.status()).toBe(409);
  expect((await again.json()).error.message).toContain("already back for inspection");
  await asB.context().close();
});

async function repairId(code: string): Promise<string> {
  return withDb(
    async (db) => (await db.query(`SELECT id FROM repair_jobs WHERE code = $1`, [code])).rows[0].id,
  );
}

test("a correction can't change the failed pairs once a repair from the batch is back (A-93)", async ({
  browser,
}) => {
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  // -1 is Done, so the batch's failed pairs and lines are locked; the other counts can change.
  const saved = await withDb(
    async (db) =>
      (
        await db.query(
          `SELECT id, to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated
         FROM production_check_ins WHERE day = $1::date`,
          [MAIN],
        )
      ).rows[0],
  );
  const lines = [
    { finalDefectTypeId: await typeId("OTHER"), pairs: 5, remedy: "NOT_FIXABLE", note: "Torn" },
  ];
  const locked = await qi.request.patch(`/api/v1/production/check-ins/${saved.id}`, {
    data: {
      expectedUpdatedAt: saved.updated,
      pairs: 20,
      failedPairs: 5,
      findings: lines,
      reason: "Counted one failed pair twice",
    },
  });
  expect(locked.status()).toBe(409);
  expect((await locked.json()).error.message).toBe(
    "A repair from this batch is already back for inspection, so its failed pairs can't change. You can still correct the other counts.",
  );
  const allowed = await qi.request.patch(`/api/v1/production/check-ins/${saved.id}`, {
    data: {
      expectedUpdatedAt: saved.updated,
      pairs: 21,
      failedPairs: 6,
      reason: "Counted one more finished pair",
    },
  });
  expect(allowed.status()).toBe(200);
  await qi.context().close();
});

async function typeId(key: string): Promise<string> {
  return withDb(
    async (db) =>
      (await db.query(`SELECT id FROM final_defect_types WHERE key = $1`, [key])).rows[0].id,
  );
}

test("the reports show the final defects, where they come from and the repairs", async ({
  browser,
}) => {
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  // Only MAIN, a Saturday the demo seed never writes to, so the range holds this spec's own batch.
  await fm.goto(`/reports?view=operations&from=${MAIN}&to=${MAIN}`);
  const defects = fm.getByTestId("final-defects-table");
  const pairsOf = (name: string) => defects.getByRole("row", { name }).getByRole("cell").nth(1);
  await expect(pairsOf("Lifted sole")).toHaveText("2");
  await expect(pairsOf("Glue marks")).toHaveText("2");
  await expect(pairsOf("Loose stitching")).toHaveText("1");
  await expect(pairsOf("Other")).toHaveText("1");
  await expect(defects.getByRole("row", { name: "Reason not recorded" })).toHaveCount(0);
  const origins = fm.getByTestId("defect-origins-table");
  // Where a defect came from is the stage the QI chose; a later move by the Floor Manager doesn't change it.
  // Cells: defect, Construction, Sole-ing, Finishing, scrapped. No Preparation column: a repair never
  // goes back to Preparation (D-136).
  await expect(origins.getByRole("columnheader", { name: /Preparation/ })).toHaveCount(0);
  await expect(
    origins.getByRole("row", { name: "Loose stitching" }).getByRole("cell").nth(1),
  ).toContainText("1");
  await expect(fm.getByTestId("repairs-section")).toContainText("Sent");
  expect(await axe(fm)).toEqual([]);
  await fm.context().close();
});

test("the suggestion shows after five findings, is never filled in, and Use this applies it", async ({
  browser,
}) => {
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  const api = await qi.request.get("/api/v1/production/defect-suggestions");
  const suggestions = (await api.json()).data as Record<string, { text: string; remedy: string }>;
  const markerId = await typeId(MARKER);
  expect(suggestions[markerId]).toMatchObject({
    text: "Usually fixable at Sole-ing, 5 of 5",
    remedy: "FIXABLE",
  });

  const dialog = await openInspect(qi, SUGGEST_CODE);
  await dialog.getByLabel(/Pairs finished in/).fill("10");
  await dialog.getByLabel("Of these, failed inspection").fill("1");
  const l1 = line(dialog, 1);
  await l1.defect.selectOption({ label: "E2E marker defect" });
  await expect(dialog.getByText("Usually fixable at Sole-ing, 5 of 5.")).toBeVisible();
  // Never filled in: nothing is chosen until the QI says so.
  await expect(l1.fixable).not.toBeChecked();
  await expect(l1.stage).toHaveCount(0);
  await dialog.getByRole("button", { name: "Use this for line 1" }).click();
  await expect(l1.fixable).toBeChecked();
  await expect(l1.stage).toHaveValue("SOLE_ING");
  // The suggestion can be ignored: choose Not fixable instead, and the hint offers itself again.
  await l1.notFixable.check();
  await expect(dialog.getByRole("button", { name: "Use this for line 1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Not now" }).click();
  await qi.context().close();
});

test("the System Admin manages the final defect types, and Other can't be switched off", async ({
  browser,
}) => {
  const admin = await signedIn(browser, ACCOUNTS.admin.email);
  await admin.goto("/admin/settings?tab=final");
  await expect(admin.getByText("Final defect types are for finished shoes")).toBeVisible();
  for (const label of ["Lifted sole", "Glue marks", "Loose stitching", "Scuffs", "Other"])
    await expect(admin.getByRole("row", { name: new RegExp(label) }).first()).toBeVisible();
  // A separate list from the leather defect types the camera checks.
  await admin.goto("/admin/settings?tab=defects");
  await expect(
    admin.getByText("Defects on finished shoes are under Final defect types."),
  ).toBeVisible();
  const types = (await (await admin.request.get("/api/v1/final-defect-types")).json()).data as {
    id: string;
    key: string;
  }[];
  const other = types.find((t) => t.key === "OTHER")!;
  const off = await admin.request.patch(`/api/v1/final-defect-types/${other.id}`, {
    data: { isActive: false },
  });
  expect(off.status()).toBe(409);
  expect((await off.json()).error.message).toContain("Other can't be switched off");
  expect(await axe(admin)).toEqual([]);
  await admin.context().close();
});

test("no name sits beside a figure on the board or in the reports", async ({ browser }) => {
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  const board = (await (await fm.request.get("/api/v1/production/wip")).json()).data;
  for (const c of board.cards)
    expect(Object.keys(c).sort()).toEqual(
      [
        "asOf",
        "assigned",
        "label",
        "pairs",
        "repairDefects",
        "repairPairs",
        "repairs",
        "stage",
        "unit",
      ].sort(),
    );
  const report = JSON.stringify(
    (await (await fm.request.get(`/api/v1/reports/operations?from=${MAIN}&to=${MAIN}`)).json())
      .data,
  );
  for (const key of ["enteredBy", "backBy", "inspectedBy", "userId", "assignedBy"])
    expect(report).not.toContain(`"${key}"`);
  await fm.context().close();
});
