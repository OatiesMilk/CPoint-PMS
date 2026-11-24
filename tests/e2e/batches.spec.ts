import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { removeCheckIns } from "./db-cleanup";
import { ACCOUNTS, signIn } from "./helpers";
import { captureApi, createDeviceToken, createRoll, finishRoll, postScan } from "./cv-helpers";

/**
 * Batches (Phase 27, D-097 to D-099; Phase 30E-2, D-114): a batch is a check-in interval of a
 * planned day, finished by the Quality Inspector with the pairs finished and the pairs that failed
 * inspection.
 *
 * Finish batch opens 10 minutes before a batch's end, so the test can't rely on the default
 * 08:00–13:00 and 13:00–17:00. It puts its own plan for today and "no lunch" straight in the
 * database and puts today's own plan back afterwards. The plan is hourly from 00:00 to 23:59,
 * so a batch is due at any hour from 01:00 Manila; in the first hour (00:00 to 01:00) it is
 * 5-minute batches from 00:00 to 02:00 instead, and before 00:05 the hook waits until the first
 * one has ended. The
 * Floor Manager test changes today's attendance (QI present, then absent) and puts it back; don't
 * run it beside attendance.spec.ts.
 */
test.describe.configure({ mode: "serial" });

// As a UTC string: the timestamp columns have no time zone, and node-pg would send a Date in the
// machine's own zone (Manila on the laptop), so the clean-up below would miss this run's rows.
const STARTED = new Date().toISOString();
let lunchId: string | null = null;
/** Today's plan before the suite replaced it, put back afterwards. */
let savedToday: Record<string, unknown> | null = null;
/** The weekday the Floor Manager test plans: the first one after today with nothing saved. */
let planDay = "";

const manilaDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
  );

async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

async function signedIn(
  browser: Browser,
  email: string,
  home: string,
  viewport?: { width: number; height: number },
): Promise<Page> {
  const page = await (await browser.newContext(viewport ? { viewport } : {})).newPage();
  await page.goto("/login");
  await signIn(page, email);
  await expect(page).toHaveURL(home);
  return page;
}

async function axe(page: Page) {
  // A toast fading in or out is half transparent, which axe reads as low contrast, so the toast
  // area is left out of the scan; each toast's text is checked where the test expects it.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

type Row = {
  number: number;
  /** "B-261119-3" (Phase 33) */
  code: string;
  slotAt: string;
  time: string;
  state: string;
  canFinishNow: boolean;
  finishOpensAt: string;
  checkIn: { notes: string | null } | null;
};

async function today(page: Page): Promise<{ rows: Row[]; canEnter: boolean }> {
  return (await (await page.request.get("/api/v1/production/today")).json()).data;
}

test.beforeAll(async () => {
  // A batch is due only after its end, and the first hourly batch ends at 01:00: in the first
  // Manila hour use 5-minute batches, and wait until the first has ended (the hook may wait ~5 min).
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const secondsIntoDay = part("hour") * 3600 + part("minute") * 60 + part("second");
  const firstHour = secondsIntoDay < 3600;
  const [interval, shiftEnd] = firstHour ? [5, "02:00"] : [60, "23:59"];
  if (firstHour && secondsIntoDay < 305) {
    test.setTimeout(6 * 60_000);
    await new Promise((r) => setTimeout(r, (305 - secondsIntoDay) * 1000));
  }
  lunchId = await withDb(async (db) => {
    const today = manilaDay();
    const before = await db.query(`SELECT * FROM day_plans WHERE day = $1::date`, [today]);
    savedToday = before.rows[0] ?? null;
    await db.query(`DELETE FROM day_plans WHERE day = $1::date`, [today]);
    // Today's queued batches follow the plan (Phase 33): drop them so the hourly plan's are made.
    await db.query(`DELETE FROM production_batches WHERE day = $1::date`, [today]);
    // An hourly plan for today (an old interval the form no longer offers, D-115).
    await db.query(
      `INSERT INTO day_plans (id, day, kind, "rollsPlanned", quota, "intervalMinutes", "shiftStart", "shiftEnd", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1::date, 'PLANNED', 3, 100, $2, '00:00', $3, now(), now())`,
      [today, interval, shiftEnd],
    );
    for (let i = 1; i < 40; i++) {
      const day = manilaDay(i);
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      const taken = await db.query(`SELECT 1 FROM day_plans WHERE day = $1::date`, [day]);
      if (taken.rowCount === 0) {
        planDay = day;
        break;
      }
    }
    const lunch = await db.query<{ id: string }>(
      `INSERT INTO lunch_breaks (id, "startTime", "endTime", "effectiveFrom", "createdAt")
       VALUES (gen_random_uuid(), NULL, NULL, $1::date, now())
       RETURNING id`,
      [today],
    );
    return lunch.rows[0].id;
  });
});

test.afterAll(async () => {
  await withDb(async (db) => {
    const today = manilaDay();
    // Only today's batches: other specs running alongside finish batches on other days.
    // Their findings and repairs go first (the finish dialog saves a finding line, Phase 34).
    await removeCheckIns(db, '"enteredAt" >= $1 AND day = $2::date', [STARTED, today]);
    await db.query(`DELETE FROM day_plans WHERE day = $1::date`, [today]);
    // The hourly plan's batches go too; the app makes today's again from the plan put back.
    await db.query(`DELETE FROM production_batches WHERE day = $1::date`, [today]);
    if (savedToday) {
      const cols = Object.keys(savedToday);
      await db.query(
        `INSERT INTO day_plans (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
        cols.map((c) => savedToday![c]),
      );
    }
    if (planDay) await db.query(`DELETE FROM day_plans WHERE day = $1::date`, [planDay]);
    await db.query(
      `DELETE FROM lunch_breaks WHERE id = $1 OR ("createdAt" >= $2 AND "createdById" IS NOT NULL)`,
      [lunchId, STARTED],
    );
  });
});

test("the Floor Manager plans a day on the calendar, marks a holiday and undoes it (D-114)", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  expect(planDay).not.toBe("");
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await page.goto("/batches");
  await page.getByRole("link", { name: "Plan days" }).click();
  await expect(page).toHaveURL("/batches/plan");
  await expect(page.getByTestId("plan-calendar")).toBeVisible();
  // Weekends and past days are not buttons; no working-days ticks (D-105, D-114).
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  const sat = (await page
    .locator("[data-testid^='plan-day-']")
    .evaluateAll((els) =>
      els
        .map((e) => e.getAttribute("data-testid")!.slice(9))
        .find((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 6),
    )) as string;
  expect(await page.getByTestId(`plan-day-${sat}`).evaluate((e) => e.tagName)).toBe("DIV");
  // Today has the suite's plan and finished batches may lock it later; it reads 3 rolls.
  await expect(page.getByTestId(`plan-day-${manilaDay()}`)).toContainText("3 rolls");

  // The first free weekday after today: its dialog opens from ?day=.
  await page.goto(`/batches/plan?day=${planDay}`);
  const form = page.getByTestId("day-plan-form");
  await expect(form).toBeVisible();
  await form.getByLabel("Rolls to be used").fill("x");
  await form.getByLabel("Quota (pairs that pass)").fill("0");
  await form.getByLabel("Shift start").fill("07:00");
  await form.getByLabel("Shift end").fill("18:00");
  await form.getByRole("button", { name: "Save plan" }).click();
  // Each message shows under its field and again in the summary, so read the field's own error.
  await expect(form.locator("#plan-rolls-error")).toHaveText(
    "Enter the rolls to be used as a whole number, like 5. Enter 0 if none.",
  );
  await expect(form.locator("#plan-quota-error")).toHaveText(
    "Enter the daily quota as a whole number of pairs, at least 1.",
  );
  await expect(form.locator("#plan-shift-start-error")).toHaveText(
    "Shift start must be 08:00 or later.",
  );
  await expect(form.locator("#plan-shift-end-error")).toHaveText(
    "Shift end must be 17:00 or earlier.",
  );
  await expect(form.getByLabel("Rolls to be used")).toBeFocused();

  // Only every 4 hours or once at the end of the day (D-115).
  const interval = form.getByLabel("Check-in interval");
  await expect(interval.locator("option")).toHaveText([
    "Every 4 hours",
    "Once at the end of the day",
  ]);
  await form.getByLabel("Rolls to be used").fill("4");
  await form.getByLabel("Quota (pairs that pass)").fill("4321");
  await form.getByLabel("Shift start").fill("08:00");
  await form.getByLabel("Shift end").fill("17:00");
  await interval.selectOption({ label: "Once at the end of the day" });
  await expect(form).toContainText(/B-\d{6}-1 08:00–17:00/);
  await expect(form).not.toContainText(/B-\d{6}-2 /);
  await expect(form.getByText(/Suggested: \d+ pairs|No quota suggestion yet/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await form.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByText(/Plan saved for /)).toBeVisible();
  const cell = page.getByTestId(`plan-day-${planDay}`);
  await expect(cell).toContainText("4 rolls");
  await expect(cell).toContainText("4,321 pairs");
  await expect(cell).toContainText("once a day");

  // Non-working / Holiday, then undo: the day is a working day again with no plan.
  await cell.click();
  await page.getByRole("button", { name: "Mark Non-working / Holiday" }).click();
  await expect(
    page.getByText(/is marked Non-working \/ Holiday\. It has no batches\./),
  ).toBeVisible();
  await expect(cell).toContainText("Non-working / Holiday");
  await cell.click();
  await page.getByRole("button", { name: "Undo, make it a working day" }).click();
  await expect(
    page.getByText(/is a working day again\. Plan it so it has batches\./),
  ).toBeVisible();
  await expect(page.getByTestId("day-plan-form")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cell).toContainText("Not planned");

  // The API refuses a weekend and a past day; the old schedule and quota APIs are gone.
  const weekend = await page.request.put(`/api/v1/production/plans/${sat}`, {
    data: {
      rollsPlanned: 1,
      quota: 10,
      intervalMinutes: 240,
      shiftStart: "08:00",
      shiftEnd: "17:00",
    },
  });
  expect(weekend.status()).toBe(409);
  expect((await weekend.json()).error.message).toBe(
    "Saturdays and Sundays can't be planned. The factory works Monday to Friday.",
  );
  expect((await page.request.put("/api/v1/production/schedule", { data: {} })).status()).toBe(404);
  expect((await page.request.put("/api/v1/production/quotas", { data: {} })).status()).toBe(404);
  // No shoe types anywhere on the plan (C-8).
  await expect(page.getByText(/shoe type/i)).toHaveCount(0);
});

test("a weekday with no plan has no batches and the Floor Manager is told to plan it (A-37)", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const today = manilaDay();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  test.skip(weekday === 0 || weekday === 6, "The notice only shows on a weekday.");
  const plan = await withDb(async (db) => {
    const row = (await db.query(`SELECT * FROM day_plans WHERE day = $1::date`, [today])).rows[0];
    await db.query(`DELETE FROM day_plans WHERE day = $1::date`, [today]);
    return row;
  });
  try {
    const fm = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
    // On the Overview the Plan today row is the only prompt: the banner is hidden there (D-131).
    await expect(fm.getByTestId("plan-today-card")).toBeVisible();
    await expect(fm.getByTestId("plan-notice")).toHaveCount(0);
    await fm.goto("/batches");
    await expect(fm.getByTestId("plan-notice")).toContainText("Today has no plan yet");
    await expect(fm.getByTestId("no-batches")).toContainText("Today has no plan yet");
    // The bell sits in both the desktop sidebar and the phone bar; click the one on screen.
    await fm.getByTestId("batch-bell").filter({ visible: true }).click();
    await expect(fm.getByTestId("plan-today-notice")).toBeVisible();
    await fm.keyboard.press("Escape");
    // Scan once the menu has closed: while it closes, the page behind it is still aria-hidden.
    await expect(fm.getByTestId("plan-today-notice")).toBeHidden();
    expect(await axe(fm)).toEqual([]);

    const qi = await signedIn(browser, ACCOUNTS.inspector.email, ACCOUNTS.inspector.home);
    // The QI lands on the Queue tab (Phase 33); the day's message is on Today.
    await qi.getByTestId("tab-today").click();
    await expect(qi.getByTestId("no-batches")).toContainText(
      "No batches yet today. The Floor Manager plans them first.",
    );
    await expect(qi.getByTestId("plan-notice")).toHaveCount(0);
  } finally {
    await withDb(async (db) => {
      await db.query(`DELETE FROM day_plans WHERE day = $1::date`, [today]);
      const cols = Object.keys(plan);
      await db.query(
        `INSERT INTO day_plans (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
        cols.map((c) => plan[c]),
      );
    });
  }
});

test("the System Admin sets the lunch break, from tomorrow, with specific messages (C-3)", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const page = await signedIn(browser, ACCOUNTS.admin.email, ACCOUNTS.admin.home);
  await page.goto("/admin/settings?tab=lunch");
  const form = page.getByTestId("lunch-break-form");
  // The suite's own "no lunch" row for today starts the form on No lunch break.
  await form.getByLabel("No lunch break").setChecked(false);
  await form.getByLabel("Lunch starts").fill("12:00");
  await form.getByLabel("Lunch ends").fill("11:00");
  await form.getByRole("button", { name: "Save lunch break" }).click();
  await expect(form.getByText("Lunch must end after it starts.")).toBeVisible();

  // Outside the factory's hours (08:00 to 17:00; each day plans its own shift, D-114).
  await form.getByLabel("Lunch starts").fill("06:00");
  await form.getByLabel("Lunch ends").fill("07:00");
  await form.getByRole("button", { name: "Save lunch break" }).click();
  await expect(
    form.getByText(/Lunch must be inside the shift \(\d\d:\d\d to \d\d:\d\d\)\./),
  ).toBeVisible();

  await form.getByLabel("Lunch starts").fill("11:30");
  await form.getByLabel("Lunch ends").fill("12:30");
  await form.getByRole("button", { name: "Save lunch break" }).click();
  await expect(
    page.getByText(
      /Lunch 11:30 to 12:30 saved\. It applies from|Nothing changed: this lunch break already applies/,
    ),
  ).toBeVisible();
  await expect(page.getByTestId("lunch-history")).toContainText("11:30 to 12:30");
  // Saving the same lunch again adds nothing (team QA, 2026-11-02).
  await form.getByRole("button", { name: "Save lunch break" }).click();
  await expect(
    page.getByText(
      /Nothing changed: this lunch break already applies from .+, so nothing was saved\./,
    ),
  ).toBeVisible();

  // The Floor Manager can't set it.
  const fm = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  const refused = await fm.request.put("/api/v1/settings/lunch-break", {
    data: { startTime: "11:00", endTime: "12:00" },
  });
  expect(refused.status()).toBe(403);

  expect(await axe(page)).toEqual([]);
});

test("the Quality Inspector on a phone gets the notice and finishes the batch with failed pairs", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  // Phase 30E (D-111): a roll scanned at Capture is already off stock; Finish batch never asks
  // about rolls, and finishing the batch doesn't change the roll.
  const sc = await captureApi(browser);
  const scanned = await createRoll(sc);
  const { token } = await createDeviceToken();
  expect((await postScan(sc, token, scanned.id, [])).status()).toBe(201);
  await finishRoll(sc, scanned.id);
  const rollState = () =>
    withDb(async (db) => {
      const { rows } = await db.query(
        `SELECT b.status::text AS status, i."quantityOnHand"::float AS "onHand"
         FROM batches b JOIN inventory_items i ON i.id = b."itemId" WHERE b.id = $1`,
        [scanned.id],
      );
      return rows[0] as { status: string; onHand: number };
    });
  const before = await rollState();
  expect(before).toEqual({ status: "FINISHED", onHand: 0 });

  const page = await signedIn(browser, ACCOUNTS.inspector.email, ACCOUNTS.inspector.home, {
    width: 390,
    height: 844,
  });
  const note = `E2E batch ${Date.now()}`;
  // Batches is the QI's home (Phase 28, D-100), on the Queue tab since Phase 33; Today has the
  // day's batches.
  await expect(page.getByTestId("tab-queue")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("tab-today").click();
  await expect(page.getByTestId("today-batches")).toBeVisible();

  // The notice: a banner on any page, a "(n)" in the tab title and the bell (A-9, C-6).
  const banner = page.getByTestId("batch-notice");
  await expect(banner).toContainText(/B-\d{6}-\d+ is due\. Finish it now\./);
  await expect.poll(() => page.title()).toMatch(/^\(\d+\) /);
  await expect(
    page.getByRole("button", { name: /Batch notices: \d+ batch(es)? due/ }),
  ).toBeVisible();
  // Batches are named by their code, B-YYMMDD-N (Phase 33, D-129).
  const code = (await banner.innerText()).match(/(B-\d{6}-\d+) is due/)![1];
  const number = Number(code.split("-")[2]);

  // Finish from the banner opens the batch's sheet.
  await banner.getByRole("link", { name: `Finish ${code}` }).click();
  await expect(page).toHaveURL(/\/batches\?finish=/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(code);
  const finished = dialog.getByLabel(new RegExp(`^Pairs finished in ${code}`));
  const failed = dialog.getByLabel("Of these, failed inspection");
  await expect(failed).toHaveValue("0");

  // Empty pairs, then more failed than finished: each message under its own field.
  await dialog.getByRole("button", { name: `Finish ${code}` }).click();
  await expect(
    dialog.getByText(
      `Enter the pairs finished in ${code} as a whole number, like 24. Enter 0 if none.`,
    ),
  ).toBeVisible();
  await expect(finished).toBeFocused();
  await finished.fill("3");
  await failed.fill("4");
  await dialog.getByRole("button", { name: `Finish ${code}` }).click();
  await expect(
    dialog.getByText("Failed inspection can't be more than the pairs finished (3)."),
  ).toBeVisible();
  // Focus moves to the invalid field a frame after the message shows; typing before that sent
  // "12" into the failed field and saved 3 pairs (Phase 27 run 5, Phase 30A run 6).
  await expect(failed).toBeFocused();

  await finished.fill("12");
  await failed.fill("2");
  // Check what will be sent before saving.
  await expect(finished).toHaveValue("12");
  await expect(failed).toHaveValue("2");
  await dialog.getByLabel("Notes (optional)").fill(note);
  // What was wrong (Phase 34): failed pairs need a reason.
  await dialog.getByLabel("Defect, line 1").selectOption({ label: "Scuffs" });
  await dialog.getByLabel("Pairs, line 1", { exact: true }).fill("2");
  await dialog
    .getByRole("radiogroup", { name: "Can line 1 be fixed?" })
    .getByLabel("Not fixable", { exact: true })
    .check();
  // No rolls on Finish batch (Phase 30E, D-111): the QI only counts pairs.
  await expect(dialog.getByText("Rolls fully used")).toHaveCount(0);
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await dialog.getByRole("button", { name: `Finish ${code}` }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`${code} finished.`, { exact: true })).toBeVisible();
  const card = page.getByTestId(`batch-${number}`);
  await expect(card).toContainText("12 pairs, 2 failed inspection");
  await expect(card).toContainText(`Note: ${note}`);
  await expect(card).not.toContainText("Fully used");
  expect(await rollState()).toEqual(before);

  // Phone layout (D-096): no sideways scroll, and the next batch's Finish button at the bottom.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const state = await today(page);
  if (state.rows.some((r) => !r.checkIn && r.canFinishNow)) {
    const box = await page
      .getByRole("button", { name: /^Finish batch B-\d{6}-\d+$/ })
      .first()
      .boundingBox();
    expect(box!.y + box!.height).toBeGreaterThan(844 - 80);
  }

  // The same batch again through the API: 409 STALE, naming who finished it.
  const saved = state.rows.find((r) => r.checkIn?.notes === note)!;
  const again = await page.request.post("/api/v1/production/check-ins", {
    data: { slotAt: saved.slotAt, pairs: 1, failedPairs: 0 },
  });
  expect(again.status()).toBe(409);
  const body = await again.json();
  expect(body.error.code).toBe("STALE");
  expect(body.error.message).toContain(`already finished ${code} at`);

  // A batch that isn't open yet is refused with the time it opens (C-28).
  const later = state.rows.find((r) => !r.checkIn && !r.canFinishNow && r.state === "UPCOMING");
  if (later) {
    const early = await page.request.post("/api/v1/production/check-ins", {
      data: { slotAt: later.slotAt, pairs: 1 },
    });
    expect(early.status()).toBe(409);
    expect((await early.json()).error.message).toBe(
      `${later.code} can be finished from ${later.finishOpensAt}.`,
    );
  }

  // Correct: a reason is required, then it shows who corrected it and why.
  await card.getByRole("button", { name: "Correct" }).click();
  const fix = page.getByRole("dialog");
  await fix.getByLabel(new RegExp(`^Pairs finished in ${code}`)).fill("11");
  await fix.getByRole("button", { name: "Save correction" }).click();
  await expect(
    fix.getByText("Say why you're correcting this batch, at least 5 characters."),
  ).toBeVisible();
  await fix.getByLabel("Why are you correcting it?").fill("Counted one rack twice");
  await expect(fix.getByRole("checkbox")).toHaveCount(0);
  await fix.getByRole("button", { name: "Save correction" }).click();
  await expect(fix).toBeHidden();
  await expect(card).toContainText("11 pairs, 2 failed inspection");
  await expect(card).toContainText("Counted one rack twice");
  expect(await rollState()).toEqual(before);

  // Recent days stay the Floor Manager's; the QI tracks batches in the queue (Phase 33).
  await expect(page.getByText("Recent days")).toHaveCount(0);

  expect(await axe(page)).toEqual([]);
});

type Roster = { id: string; role: string; present: boolean }[];

test("the Floor Manager finishes batches only on a day no Quality Inspector is present (D-088)", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  const card = page.getByTestId("todays-batches-card");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("quota-progress")).toContainText("pairs passed");

  // Remember today's attendance, so it can be put back afterwards.
  const day = manilaDay();
  type Attendance = { taken: boolean; updatedAt: string | null; roster: Roster };
  const read = async () =>
    (await (await page.request.get("/api/v1/attendance")).json()).data as Attendance;
  const before = await read();
  // Like a page that refreshed: read the roster and the day's version just before each save, and
  // read again once if the server says 409. Other specs make and remove E2E constructors while this
  // runs, so a roster read at the start can name someone who is gone by the second save (Phase 34 run 3).
  const save = async (present: (r: Roster[number]) => boolean) => {
    let status = 0;
    let body: { data: { updatedAt: string } } | null = null;
    for (let attempt = 0; attempt < 2 && status !== 200; attempt++) {
      const fresh = await read();
      const res = await page.request.put(`/api/v1/attendance/${day}`, {
        data: {
          expectedUpdatedAt: fresh.updatedAt,
          marks: fresh.roster.map((r) => ({ userId: r.id, present: present(r) })),
        },
      });
      status = res.status();
      if (status === 200) body = await res.json();
    }
    expect(status).toBe(200);
    return body!.data.updatedAt;
  };

  try {
    // 1. A QI marked present: no Finish batch, no notice, and the API refuses with the reason.
    await save(() => true);
    await page.goto("/batches");
    await expect(page.getByRole("button", { name: /^Finish batch/ })).toHaveCount(0);
    await expect(page.getByTestId("batch-notice")).toHaveCount(0);
    await expect(page.getByTestId("enter-note")).toHaveText(
      "A Quality Inspector is present today, so they finish the batches.",
    );
    const refused = await page.request.post("/api/v1/production/check-ins", {
      data: { slotAt: new Date().toISOString(), pairs: 1 },
    });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.message).toBe(
      "A Quality Inspector is present today, so they finish the batches.",
    );
    // The Floor Manager also sees Recent days.
    await expect(page.getByText("Recent days")).toBeVisible();

    // 2. Every QI marked absent: the Floor Manager covers, and gets the notices.
    await save((r) => r.role !== "QUALITY_INSPECTOR");
    await page.goto("/batches");
    await expect(page.getByTestId("covering-note")).toContainText(
      "No Quality Inspector is present today, so you can finish the batches.",
    );
    await expect(page.getByTestId("batch-notice")).toBeVisible();
    await page
      .getByTestId("today-batches")
      .getByRole("button", { name: /^Finish batch B-\d{6}-\d+$/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Pairs finished in B-\d{6}-\d+/).fill("3");
    // A note of its own per run, so earlier runs' rows never match (Phase 25 QA run 2).
    const coverNote = `E2E FM cover ${Date.now()}`;
    await dialog.getByLabel("Notes (optional)").fill(coverNote);
    await dialog.getByRole("button", { name: /^Finish B-\d{6}-\d+$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page
        .getByTestId("today-batches")
        .getByRole("listitem")
        .filter({ hasText: `Note: ${coverNote}` }),
    ).toContainText("3 pairs, 0 failed inspection");
    expect(await axe(page)).toEqual([]);
  } finally {
    // Put today's attendance back as it was.
    if (before.taken) {
      // From what was there at the start: someone who has gone since is simply not sent, and
      // someone new is saved absent.
      const was = new Map(before.roster.map((r) => [r.id, r.present]));
      await save((r) => was.get(r.id) ?? false);
    } else {
      await withDb(async (db) => {
        await db.query(
          `DELETE FROM attendance_marks WHERE "attendanceDayId" IN (SELECT id FROM attendance_days WHERE day = $1::date)`,
          [day],
        );
        await db.query(`DELETE FROM attendance_days WHERE day = $1::date`, [day]);
      });
    }
  }
});

test("the Admin is refused Batches (D-100) and sets only the lunch break", async ({ browser }) => {
  const page = await signedIn(browser, ACCOUNTS.admin.email, ACCOUNTS.admin.home);
  for (const path of ["/batches", "/batches/plan"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/forbidden");
  }
  expect((await page.request.get("/api/v1/production/today")).status()).toBe(403);
  expect((await page.request.get("/api/v1/production/plans")).status()).toBe(403);
  expect(
    (
      await page.request.put(`/api/v1/production/plans/${manilaDay(1)}`, {
        data: { rollsPlanned: 1, quota: 10 },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/admin");
  await expect(page.getByTestId("lunch-break-card")).toContainText("Lunch break");
});

test("a Shoe Constructor is refused, and the old pages are gone", async ({ browser }) => {
  const page = await signedIn(browser, ACCOUNTS.constructor.email, ACCOUNTS.constructor.home);
  await page.goto("/batches");
  await expect(page).toHaveURL("/forbidden");
  expect((await page.request.get("/api/v1/production/today")).status()).toBe(403);
  expect((await page.request.get("/api/v1/production/days")).status()).toBe(403);
  expect((await page.request.get("/production")).status()).toBe(404);
  expect((await page.request.get("/api/v1/shoe-types")).status()).toBe(404);
});
