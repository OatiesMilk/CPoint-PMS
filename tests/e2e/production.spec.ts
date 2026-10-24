import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * Production progression (Phase 23, D-082 to D-087).
 *
 * Check-ins open at their scheduled time, so the test can't rely on the default 12:00 / 16:00 /
 * 17:00. It adds its own schedule for today straight in the database (hourly from 00:00 to 23:59,
 * every day), so a check-in is always due after 01:00 Manila, and removes it and everything the
 * test saved afterwards. Run it after 01:00 Manila time. The Floor Manager test changes today's
 * attendance (QI present, then absent) and puts it back; don't run it beside attendance.spec.ts.
 */
test.describe.configure({ mode: "serial" });

const STARTED = new Date();
let scheduleId: string | null = null;

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

async function signedIn(browser: Browser, email: string, home: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await signIn(page, email);
  await expect(page).toHaveURL(home);
  return page;
}

async function axe(page: Page) {
  // A toast fading in or out is half transparent, which axe reads as low contrast. Let any
  // confirmation toast finish and leave first (they last 4 s).
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test.beforeAll(async () => {
  scheduleId = await withDb(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO production_schedules (id, "shiftStart", "shiftEnd", "intervalMinutes", "workingDays", "effectiveFrom", "createdAt")
       VALUES (gen_random_uuid(), '00:00', '23:59', 60, '{1,2,3,4,5,6,7}', $1::date, now())
       RETURNING id`,
      [manilaDay()],
    );
    return rows[0].id;
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
  });
});

test("the Floor Manager sets the schedule and a quota, with specific messages", async ({
  browser,
}) => {
  test.setTimeout(60_000); // the axe check waits for the two save toasts to leave
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await page.goto("/production");
  await page.getByRole("link", { name: "Schedule and quota" }).click();
  await expect(page).toHaveURL("/production/plan");

  // Schedule: a shift end before the start is caught under the field.
  const schedule = page.getByTestId("schedule-form");
  await schedule.getByLabel("Shift start").fill("17:00");
  await schedule.getByLabel("Shift end").fill("08:00");
  await schedule.getByRole("button", { name: "Save schedule" }).click();
  await expect(schedule.getByText("Shift end must be after shift start.")).toBeVisible();
  await expect(schedule.getByLabel("Shift end")).toBeFocused();

  await schedule.getByLabel("Shift start").fill("08:00");
  await schedule.getByLabel("Shift end").fill("17:00");
  await schedule.getByLabel("Check-in").selectOption({ label: "Every 2 hours" });
  await expect(schedule).toContainText("Check-ins at 10:00, 12:00, 14:00, 16:00, 17:00");
  await expect(schedule).toContainText("Applies from tomorrow");
  await schedule.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByText(/Schedule saved\. It applies from/)).toBeVisible();
  await expect(page.getByTestId("schedule-history")).toContainText("every 2 hours");

  // Quota: a 0 is refused with the shoe type named; a whole number is saved.
  const quota = page.getByTestId("quota-form");
  const first = quota.getByLabel(/: pairs per day$/).first();
  const label = (await quota.locator("label").first().innerText()).replace(": pairs per day", "");
  await first.fill("0");
  await quota.getByRole("button", { name: "Save quotas" }).click();
  await expect(
    quota.getByText(`Enter the daily quota for ${label} as a whole number of pairs, at least 1.`),
  ).toBeVisible();
  // Every shoe type needs a quota to save (a fresh database has none yet).
  const all = quota.getByLabel(/: pairs per day$/);
  for (let i = 1; i < (await all.count()); i++)
    if ((await all.nth(i).inputValue()) === "") await all.nth(i).fill("40");
  await first.fill("4321");
  await quota.getByRole("button", { name: "Save quotas" }).click();
  await expect(page.getByText(/quotas? saved\.|Nothing changed/)).toBeVisible();
  await expect(page.getByTestId("quota-history")).toContainText("4321");
  // The suggestion box is there whether or not there is enough history for a number.
  await expect(quota.getByText(/Suggested: \d+ pairs|No suggestion yet/).first()).toBeVisible();

  expect(await axe(page)).toEqual([]);
});

test("the Quality Inspector enters the due check-in; a second entry is refused; a correction needs a reason", async ({
  browser,
}) => {
  const page = await signedIn(browser, ACCOUNTS.inspector.email, ACCOUNTS.inspector.home);
  // A note of its own, so earlier runs' check-ins on the same database never match this row.
  const note = `E2E check-in ${Date.now()}`;
  // The QI home points at the due check-in.
  await expect(page.getByTestId("next-check-in-card")).toBeVisible();

  await page.goto("/production");
  const today = page.getByTestId("today-check-ins");
  await today.getByRole("button", { name: "Enter count" }).last().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Count the pairs that left Finishing since");

  // Empty fields: each shoe type gets its own message.
  await dialog.getByRole("button", { name: "Save count" }).click();
  const fields = dialog.getByLabel(/finished since \d\d:\d\d/);
  const count = await fields.count();
  expect(count).toBeGreaterThan(0);
  await expect(dialog.getByText(/as a whole number, like 24\. Enter 0 if none\./)).toHaveCount(
    count,
  );
  await expect(fields.first()).toBeFocused();

  for (let i = 0; i < count; i++) await fields.nth(i).fill(String(10 + i));
  await dialog.getByLabel("Notes (optional)").fill(note);
  await dialog.getByRole("button", { name: "Save count" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/check-in saved\./)).toBeVisible();

  const row = today.getByRole("row").filter({ hasText: `Note: ${note}` });
  await expect(row).toContainText(/Entered/);

  // The same slot again through the API: 409 STALE, naming who entered it.
  const state = (await (await page.request.get("/api/v1/production/today")).json()).data;
  const saved = state.rows.find(
    (r: { checkIn: { notes: string | null } | null }) => r.checkIn?.notes === note,
  );
  const again = await page.request.post("/api/v1/production/check-ins", {
    data: {
      slotAt: saved.slotAt,
      counts: state.shoeTypes.map((t: { id: string }) => ({ shoeTypeId: t.id, pairs: 1 })),
    },
  });
  expect(again.status()).toBe(409);
  const body = await again.json();
  expect(body.error.code).toBe("STALE");
  expect(body.error.message).toContain(`already entered the ${saved.time} check-in at`);

  // A check-in that hasn't opened yet is refused with the time it opens.
  const later = state.rows.find((r: { state: string }) => r.state === "UPCOMING");
  if (later) {
    const early = await page.request.post("/api/v1/production/check-ins", {
      data: {
        slotAt: later.slotAt,
        counts: state.shoeTypes.map((t: { id: string }) => ({ shoeTypeId: t.id, pairs: 1 })),
      },
    });
    expect(early.status()).toBe(409);
    expect((await early.json()).error.message).toBe(
      `The ${later.time} check-in isn't open yet. You can enter it from ${later.time}.`,
    );
  }

  // Correct: a reason is required, then it shows who corrected it and why.
  await row.getByRole("button", { name: "Correct" }).click();
  const fix = page.getByRole("dialog");
  await fix
    .getByLabel(/finished since/)
    .first()
    .fill("9");
  await fix.getByRole("button", { name: "Save correction" }).click();
  await expect(
    fix.getByText("Say why you're correcting this check-in, at least 5 characters."),
  ).toBeVisible();
  await fix.getByLabel("Why are you correcting it?").fill("Counted one rack twice");
  await fix.getByRole("button", { name: "Save correction" }).click();
  await expect(fix).toBeHidden();
  await expect(row).toContainText("Counted one rack twice");

  expect(await axe(page)).toEqual([]);
});

type Roster = { id: string; role: string; present: boolean }[];

test("the Floor Manager enters check-ins only on a day no Quality Inspector is present (D-088)", async ({
  browser,
}) => {
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  const card = page.getByTestId("todays-production-card");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("quota-progress")).toBeVisible();
  await expect(page.getByText("Rolls by stage")).toHaveCount(0);

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
    // 1. A QI marked present: no Enter count, and the API refuses with the reason.
    const withQi = await save(
      before.roster.map((r) => ({ userId: r.id, present: true })),
      before.updatedAt,
    );
    await page.goto("/production");
    await expect(page.getByRole("button", { name: "Enter count" })).toHaveCount(0);
    await expect(page.getByTestId("enter-note")).toHaveText(
      "A Quality Inspector is present today, so they enter the check-ins.",
    );
    const refused = await page.request.post("/api/v1/production/check-ins", {
      data: { slotAt: new Date().toISOString(), counts: [] },
    });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.message).toBe(
      "A Quality Inspector is present today, so they enter the check-ins.",
    );

    // 2. Every QI marked absent: the Floor Manager covers.
    await save(
      before.roster.map((r) => ({ userId: r.id, present: r.role !== "QUALITY_INSPECTOR" })),
      withQi,
    );
    await page.goto("/production");
    await expect(page.getByTestId("covering-note")).toContainText(
      "No Quality Inspector is present today, so you can enter the check-ins.",
    );
    await page
      .getByTestId("today-check-ins")
      .getByRole("button", { name: "Enter count" })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    const fields = dialog.getByLabel(/finished since \d\d:\d\d/);
    for (let i = 0; i < (await fields.count()); i++) await fields.nth(i).fill("3");
    // A note of its own per run, so earlier runs' rows never match (Phase 25 QA run 2).
    const coverNote = `E2E FM cover ${Date.now()}`;
    await dialog.getByLabel("Notes (optional)").fill(coverNote);
    await dialog.getByRole("button", { name: "Save count" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page
        .getByTestId("today-check-ins")
        .getByRole("row")
        .filter({ hasText: `Note: ${coverNote}` }),
    ).toContainText("Entered");
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

test("the Admin views production read-only", async ({ browser }) => {
  const page = await signedIn(browser, ACCOUNTS.admin.email, ACCOUNTS.admin.home);
  await page.goto("/production");
  await expect(page.getByRole("heading", { name: "Production", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule and quota" })).toHaveCount(0);
  await page.goto("/production/plan");
  await expect(page).toHaveURL("/forbidden");
  expect((await page.request.get("/api/v1/production/today")).status()).toBe(200);
  expect(
    (await page.request.put("/api/v1/production/quotas", { data: { quotas: [] } })).status(),
  ).toBe(403);
});

test("a Shoe Constructor is refused", async ({ browser }) => {
  const page = await signedIn(browser, ACCOUNTS.constructor.email, ACCOUNTS.constructor.home);
  await page.goto("/production");
  await expect(page).toHaveURL("/forbidden");
  expect((await page.request.get("/api/v1/production/today")).status()).toBe(403);
  expect((await page.request.get("/api/v1/production/days")).status()).toBe(403);
});
