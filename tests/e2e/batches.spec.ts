import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * Batches (Phase 27, D-097 to D-099): a batch is a check-in interval, finished by the Quality
 * Inspector with the pairs finished and the pairs that failed inspection.
 *
 * Finish batch opens 10 minutes before a batch's end, so the test can't rely on the default
 * 08:00–13:00 and 13:00–17:00. It adds its own schedule and "no lunch" for today straight in the
 * database (hourly from 00:00 to 23:59, every day), so a batch is always due after 01:00 Manila,
 * and removes them and everything the test saved afterwards. Run it after 01:00 Manila time. The
 * Floor Manager test changes today's attendance (QI present, then absent) and puts it back; don't
 * run it beside attendance.spec.ts.
 */
test.describe.configure({ mode: "serial" });

const STARTED = new Date();
let scheduleId: string | null = null;
let lunchId: string | null = null;

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
  [scheduleId, lunchId] = await withDb(async (db) => {
    const schedule = await db.query<{ id: string }>(
      `INSERT INTO production_schedules (id, "shiftStart", "shiftEnd", "intervalMinutes", "workingDays", "effectiveFrom", "createdAt")
       VALUES (gen_random_uuid(), '00:00', '23:59', 60, '{1,2,3,4,5,6,7}', $1::date, now())
       RETURNING id`,
      [manilaDay()],
    );
    const lunch = await db.query<{ id: string }>(
      `INSERT INTO lunch_breaks (id, "startTime", "endTime", "effectiveFrom", "createdAt")
       VALUES (gen_random_uuid(), NULL, NULL, $1::date, now())
       RETURNING id`,
      [manilaDay()],
    );
    return [schedule.rows[0].id, lunch.rows[0].id];
  });
});

test.afterAll(async () => {
  await withDb(async (db) => {
    await db.query(`DELETE FROM production_check_ins WHERE "enteredAt" >= $1`, [STARTED]);
    await db.query(`DELETE FROM daily_quotas WHERE "createdAt" >= $1`, [STARTED]);
    await db.query(
      `DELETE FROM production_schedules WHERE id = $1 OR ("createdAt" >= $2 AND "createdById" IS NOT NULL)`,
      [scheduleId, STARTED],
    );
    await db.query(
      `DELETE FROM lunch_breaks WHERE id = $1 OR ("createdAt" >= $2 AND "createdById" IS NOT NULL)`,
      [lunchId, STARTED],
    );
  });
});

test("the Floor Manager plans the batches, once at the end of the day, and the one quota", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await page.goto("/batches");
  await page.getByRole("link", { name: "Plan batches and quota" }).click();
  await expect(page).toHaveURL("/batches/plan");

  // Schedule: a shift end before the start is caught under the field.
  const schedule = page.getByTestId("schedule-form");
  await schedule.getByLabel("Shift start").fill("17:00");
  await schedule.getByLabel("Shift end").fill("08:00");
  await schedule.getByRole("button", { name: "Save schedule" }).click();
  await expect(schedule.getByText("Shift end must be after shift start.")).toBeVisible();
  await expect(schedule.getByLabel("Shift end")).toBeFocused();

  // Once at the end of the day: one batch for the whole shift (C-4).
  await schedule.getByLabel("Shift start").fill("08:00");
  await schedule.getByLabel("Shift end").fill("17:00");
  await schedule.getByLabel("How often").selectOption({ label: "Once at the end of the day" });
  await expect(schedule).toContainText(
    /Tomorrow: Batch 1 08:00–17:00(, lunch \d\d:\d\d–\d\d:\d\d)?\./,
  );
  await expect(schedule).not.toContainText("Batch 2");
  await expect(schedule).toContainText("Applies from tomorrow");
  await schedule.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByText(/Schedule saved\. It applies from/)).toBeVisible();
  await expect(page.getByTestId("schedule-history")).toContainText("once at the end of the day");

  // Every 2 hours shows more batches in the preview.
  await schedule.getByLabel("How often").selectOption({ label: "Every 2 hours" });
  await expect(schedule).toContainText("Batch 2");

  // The one daily quota (D-099): a 0 is refused; a whole number is saved.
  const quota = page.getByTestId("quota-form");
  const pairs = quota.getByLabel("Pairs per day for the whole line");
  await pairs.fill("0");
  await quota.getByRole("button", { name: "Save quota" }).click();
  await expect(
    quota.getByText("Enter the daily quota as a whole number of pairs, at least 1."),
  ).toBeVisible();
  await expect(pairs).toBeFocused();
  await pairs.fill("4321");
  await quota.getByRole("button", { name: "Save quota" }).click();
  await expect(page.getByText(/Daily quota saved\.|Nothing changed/)).toBeVisible();
  await expect(page.getByTestId("quota-history")).toContainText("4321");
  // The suggestion box is there whether or not there is enough history for a number.
  await expect(quota.getByText(/Suggested: \d+ pairs|No suggestion yet/)).toBeVisible();
  // No shoe types anywhere on the plan (C-8).
  await expect(page.getByText(/shoe type/i)).toHaveCount(0);

  expect(await axe(page)).toEqual([]);
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

  // Outside tomorrow's shift (the Floor Manager's 08:00 to 17:00 above).
  await form.getByLabel("Lunch starts").fill("06:00");
  await form.getByLabel("Lunch ends").fill("07:00");
  await form.getByRole("button", { name: "Save lunch break" }).click();
  await expect(
    form.getByText(/Lunch must be inside the shift \(\d\d:\d\d to \d\d:\d\d\)\./),
  ).toBeVisible();

  await form.getByLabel("Lunch starts").fill("11:30");
  await form.getByLabel("Lunch ends").fill("12:30");
  await form.getByRole("button", { name: "Save lunch break" }).click();
  await expect(page.getByText(/Lunch 11:30 to 12:30 saved\. It applies from/)).toBeVisible();
  await expect(page.getByTestId("lunch-history")).toContainText("11:30 to 12:30");

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
  test.setTimeout(60_000);
  const page = await signedIn(browser, ACCOUNTS.inspector.email, ACCOUNTS.inspector.home, {
    width: 390,
    height: 844,
  });
  const note = `E2E batch ${Date.now()}`;
  await expect(page.getByTestId("next-batch-card")).toBeVisible();

  // The notice: a banner on any page, a "(n)" in the tab title and the bell (A-9, C-6).
  const banner = page.getByTestId("batch-notice");
  await expect(banner).toContainText(/Batch \d+ is due\. Finish it now\./);
  await expect.poll(() => page.title()).toMatch(/^\(\d+\) /);
  await expect(
    page.getByRole("button", { name: /Batch notices: \d+ batch(es)? due/ }),
  ).toBeVisible();
  const number = Number((await banner.innerText()).match(/Batch (\d+) is due/)![1]);

  // Finish batch from the banner opens the batch's sheet.
  await banner.getByRole("link", { name: `Finish batch ${number}` }).click();
  await expect(page).toHaveURL(/\/batches\?finish=/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Batch ${number}`);
  const finished = dialog.getByLabel(new RegExp(`^Pairs finished in Batch ${number}`));
  const failed = dialog.getByLabel("Of these, failed inspection");
  await expect(failed).toHaveValue("0");

  // Empty pairs, then more failed than finished: each message under its own field.
  await dialog.getByRole("button", { name: `Finish batch ${number}` }).click();
  await expect(
    dialog.getByText(
      `Enter the pairs finished in Batch ${number} as a whole number, like 24. Enter 0 if none.`,
    ),
  ).toBeVisible();
  await expect(finished).toBeFocused();
  await finished.fill("3");
  await failed.fill("4");
  await dialog.getByRole("button", { name: `Finish batch ${number}` }).click();
  await expect(
    dialog.getByText("Failed inspection can't be more than the pairs finished (3)."),
  ).toBeVisible();

  await finished.fill("12");
  await failed.fill("2");
  // Run 5 saw "3 pairs" saved once under the full parallel suite: check what will be sent first.
  await expect(finished).toHaveValue("12");
  await expect(failed).toHaveValue("2");
  await dialog.getByLabel("Notes (optional)").fill(note);
  await dialog.getByRole("button", { name: `Finish batch ${number}` }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Batch ${number} finished.`)).toBeVisible();
  const card = page.getByTestId(`batch-${number}`);
  await expect(card).toContainText("12 pairs, 2 failed inspection");
  await expect(card).toContainText(`Note: ${note}`);

  // Phone layout (D-096): no sideways scroll, and the next batch's Finish button at the bottom.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const state = await today(page);
  if (state.rows.some((r) => !r.checkIn && r.canFinishNow)) {
    const box = await page
      .getByRole("button", { name: /^Finish batch \d+$/ })
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
  expect(body.error.message).toContain(`already finished Batch ${number} at`);

  // A batch that isn't open yet is refused with the time it opens (C-28).
  const later = state.rows.find((r) => !r.checkIn && !r.canFinishNow && r.state === "UPCOMING");
  if (later) {
    const early = await page.request.post("/api/v1/production/check-ins", {
      data: { slotAt: later.slotAt, pairs: 1 },
    });
    expect(early.status()).toBe(409);
    expect((await early.json()).error.message).toBe(
      `Batch ${later.number} can be finished from ${later.finishOpensAt}.`,
    );
  }

  // Correct: a reason is required, then it shows who corrected it and why.
  await card.getByRole("button", { name: "Correct" }).click();
  const fix = page.getByRole("dialog");
  await fix.getByLabel(new RegExp(`^Pairs finished in Batch ${number}`)).fill("11");
  await fix.getByRole("button", { name: "Save correction" }).click();
  await expect(
    fix.getByText("Say why you're correcting this batch, at least 5 characters."),
  ).toBeVisible();
  await fix.getByLabel("Why are you correcting it?").fill("Counted one rack twice");
  await fix.getByRole("button", { name: "Save correction" }).click();
  await expect(fix).toBeHidden();
  await expect(card).toContainText("11 pairs, 2 failed inspection");
  await expect(card).toContainText("Counted one rack twice");

  // The QI sees today only (Dylan 2026-10-24).
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
  const before = (await (await page.request.get("/api/v1/attendance")).json()).data as {
    taken: boolean;
    updatedAt: string | null;
    roster: Roster;
  };
  const save = async (marks: { userId: string; present: boolean }[], expected: string | null) => {
    const res = await page.request.put(`/api/v1/attendance/${day}`, {
      data: { expectedUpdatedAt: expected, marks },
    });
    expect(res.status()).toBe(200);
    return (await res.json()).data.updatedAt as string;
  };

  try {
    // 1. A QI marked present: no Finish batch, no notice, and the API refuses with the reason.
    const withQi = await save(
      before.roster.map((r) => ({ userId: r.id, present: true })),
      before.updatedAt,
    );
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
    await save(
      before.roster.map((r) => ({ userId: r.id, present: r.role !== "QUALITY_INSPECTOR" })),
      withQi,
    );
    await page.goto("/batches");
    await expect(page.getByTestId("covering-note")).toContainText(
      "No Quality Inspector is present today, so you can finish the batches.",
    );
    await expect(page.getByTestId("batch-notice")).toBeVisible();
    await page
      .getByTestId("today-batches")
      .getByRole("button", { name: /^Finish batch \d+$/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Pairs finished in Batch \d+/).fill("3");
    // A note of its own per run, so earlier runs' rows never match (Phase 25 QA run 2).
    const coverNote = `E2E FM cover ${Date.now()}`;
    await dialog.getByLabel("Notes (optional)").fill(coverNote);
    await dialog.getByRole("button", { name: /^Finish batch \d+$/ }).click();
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
      const now = (await (await page.request.get("/api/v1/attendance")).json()).data.updatedAt;
      await save(
        before.roster.map((r) => ({ userId: r.id, present: r.present })),
        now,
      );
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

test("the Admin views the batches read-only", async ({ browser }) => {
  const page = await signedIn(browser, ACCOUNTS.admin.email, ACCOUNTS.admin.home);
  await page.goto("/batches");
  await expect(page.getByRole("heading", { name: "Batches", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan batches and quota" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Finish batch/ })).toHaveCount(0);
  await page.goto("/batches/plan");
  await expect(page).toHaveURL("/forbidden");
  expect((await page.request.get("/api/v1/production/today")).status()).toBe(200);
  expect(
    (await page.request.put("/api/v1/production/quotas", { data: { pairs: 10 } })).status(),
  ).toBe(403);
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
