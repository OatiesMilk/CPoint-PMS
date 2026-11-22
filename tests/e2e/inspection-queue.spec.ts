import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { removeCheckIns } from "./db-cleanup";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * The Inspection queue (Phase 33, D-129; the panel's revision 2): every batch waiting for
 * inspection, across days, named by its code (B-YYMMDD-N), Urgent first and then the oldest.
 *
 * The demo plans weekdays only, so the suite plans last Saturday and last Sunday itself (once a
 * day, 08:00–17:00, so each has one batch, B-YYMMDD-1, whatever the lunch break) and puts their
 * queued rows in as Open. Both days ended, so both wait in the queue, and both are within the
 * last 7 days, so they show under "Inspected and void" once done. Everything is removed afterwards.
 */
test.describe.configure({ mode: "serial" });

const manilaDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
  );
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const codeOf = (day: string, n = 1) =>
  `B-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-${n}`;

/** The last Saturday and the last Sunday before today, both within the last 7 days. */
function lastWeekend(): { saturday: string; sunday: string } {
  let saturday = "";
  let sunday = "";
  for (let i = 1; i <= 7; i++) {
    const day = manilaDay(-i);
    if (!saturday && weekdayOf(day) === 6) saturday = day;
    if (!sunday && weekdayOf(day) === 0) sunday = day;
  }
  return { saturday, sunday };
}

const { saturday, sunday } = lastWeekend();
const SAT = codeOf(saturday);
const SUN = codeOf(sunday);
const DAYS = [saturday, sunday];

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

type QueueData = {
  waiting: { id: string; code: string; updatedAt: string; state: string }[];
  done: { code: string; state: string; voidReason: string | null }[];
};

async function queue(page: Page, query = ""): Promise<QueueData> {
  return (await (await page.request.get(`/api/v1/production/batches${query}`)).json()).data;
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
      // 08:00–17:00 Manila is 00:00Z–09:00Z.
      await db.query(
        `INSERT INTO production_batches (id, code, day, number, "startAt", "slotAt", status, priority, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::date, 1, $3::timestamp, $4::timestamp, 'OPEN', 'NORMAL', now(), now())`,
        // UTC strings: the columns have no time zone (as in batches.spec.ts).
        [codeOf(day), day, `${day} 00:00:00`, `${day} 09:00:00`],
      );
    }
  });
});

test.afterAll(async () => {
  await withDb(cleanUp);
});

test("the queue lists waiting batches across days by code, oldest first, with filters", async ({
  browser,
}) => {
  const page = await signedIn(browser, ACCOUNTS.inspector.email);
  // The Queue tab is the Quality Inspector's home (Phase 33).
  await page.goto("/batches");
  await expect(page.getByTestId("tab-queue")).toHaveAttribute("aria-current", "page");
  const list = page.getByTestId("queue-list");
  const sat = list.getByTestId(`queue-${SAT}`);
  const sun = list.getByTestId(`queue-${SUN}`);
  await expect(sat).toBeVisible();
  await expect(sun).toBeVisible();
  await expect(sat).toContainText("08:00–17:00");
  await expect(sat).toContainText(/Waiting \d+ hours?/);
  await expect(sat).toContainText("Late");
  await expect(sat).toContainText(/No rolls scanned|\d+ rolls? \(/);

  // Oldest first while both are Normal. On a Sunday the last Sunday is a week older than the last
  // Saturday, so the order follows the dates, not the weekdays.
  const codes = (await queue(page)).waiting.map((w) => w.code);
  const [older, newer] = saturday < sunday ? [SAT, SUN] : [SUN, SAT];
  expect(codes.indexOf(older)).toBeLessThan(codes.indexOf(newer));

  // Search by code, and a filter by day.
  await page.getByLabel("Batch code").fill(SUN.slice(2));
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/tab=queue/);
  await expect(page.getByTestId(`queue-${SUN}`)).toBeVisible();
  await expect(page.getByTestId(`queue-${SAT}`)).toHaveCount(0);
  await page.getByRole("link", { name: "Clear" }).click();
  // Clear empties the fields at once, so the day picked next is filtered alone (run 3 F1).
  await expect(page.getByLabel("Batch code")).toHaveValue("");
  // And wait for its navigation to land (the address loses the old filters) before picking a day:
  // on a slow runner the page that arrives late rebuilds the form and empties the Day just picked, so
  // Filter then sent no day and both batches stayed (CI on #55's main run and #56, not a Phase 34 fault).
  await expect(page).toHaveURL(/\/batches\?tab=queue$/);
  await page.getByLabel("Day").selectOption(saturday);
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByTestId(`queue-${SAT}`)).toBeVisible();
  await expect(page.getByTestId(`queue-${SUN}`)).toHaveCount(0);

  // No batch is named "Batch 1" on its own any more.
  await page.goto("/batches?tab=queue");
  await expect(page.getByText(/\bBatch \d+\b/)).toHaveCount(0);
  await page.goto("/batches?tab=today");
  await expect(page.getByText(/\bBatch \d+\b/)).toHaveCount(0);
  await page.goto("/batches?tab=queue");
  expect(await axe(page)).toEqual([]);
});

test("the Floor Manager marks a batch Urgent, it jumps to the top, and the QI can't", async ({
  browser,
}) => {
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  await fm.goto("/batches?tab=queue");
  const sun = fm.getByTestId(`queue-${SUN}`);

  // A reason is required, named under its field.
  await sun.getByRole("button", { name: `Mark Urgent ${SUN}` }).click();
  const dialog = fm.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mark Urgent" }).click();
  await expect(
    dialog.getByText(/^Say why this batch is urgent, at least 5 characters/),
  ).toBeVisible();
  await dialog.getByLabel("Why is it urgent?").fill("Customer pick-up at 3 pm");
  await dialog.getByRole("button", { name: "Mark Urgent" }).click();
  await expect(dialog).toBeHidden();
  await expect(fm.getByText(`${SUN} is Urgent.`)).toBeVisible();
  await expect(sun).toContainText("Urgent");
  await expect(sun).toContainText("Customer pick-up at 3 pm");

  // Urgent goes first, whichever of the two is older.
  const codes = (await queue(fm)).waiting.map((w) => w.code);
  expect(codes.indexOf(SUN)).toBeLessThan(codes.indexOf(SAT));
  await expect(
    fm.getByTestId("queue-list").locator("[data-testid^='queue-']").first(),
  ).toHaveAttribute("data-testid", `queue-${SUN}`);

  // The Quality Inspector can't change priority or void.
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  await qi.goto("/batches?tab=queue");
  await expect(qi.getByRole("button", { name: /^Mark Urgent/ })).toHaveCount(0);
  await expect(qi.getByRole("button", { name: /^Void/ })).toHaveCount(0);
  const target = (await queue(qi)).waiting.find((w) => w.code === SAT)!;
  const refused = await qi.request.put(`/api/v1/production/batches/${target.id}/priority`, {
    data: { priority: "URGENT", reason: "Rush order", expectedUpdatedAt: target.updatedAt },
  });
  expect(refused.status()).toBe(403);
  const voided = await qi.request.post(`/api/v1/production/batches/${target.id}/void`, {
    data: { reason: "Line stopped", expectedUpdatedAt: target.updatedAt },
  });
  expect(voided.status()).toBe(403);
});

test("two inspectors: one starts a batch, the other sees who has it; a day-old batch is inspected", async ({
  browser,
}) => {
  const lea = await signedIn(browser, ACCOUNTS.inspector.email, { width: 390, height: 844 });
  await lea.goto("/batches?tab=queue");
  const sun = lea.getByTestId(`queue-${SUN}`);
  await sun.getByRole("button", { name: `Start inspection ${SUN}` }).click();
  await expect(lea.getByText(`You're inspecting ${SUN}.`)).toBeVisible();
  await expect(sun.getByTestId("inspecting-by")).toContainText("You started inspecting it at");

  // A second session sees it Being inspected. The demo has one Quality Inspector account, so a
  // second person's refusal ("… is already inspecting …") is checked by the unit test and by hand
  // in the handoff (a second QI account); the same person starting again is a no-op.
  const second = await signedIn(browser, ACCOUNTS.inspector.email);
  const item = (await queue(second)).waiting.find((w) => w.code === SUN)!;
  expect(item.state).toBe("INSPECTING");
  const again = await second.request.post(`/api/v1/production/batches/${item.id}/start`, {
    data: { expectedUpdatedAt: item.updatedAt },
  });
  expect(again.status()).toBe(200);
  expect((await again.json()).data).toMatchObject({ code: SUN, started: false });

  // Inspect the day-old batch on the phone: the dialog names its code and day.
  await sun.getByRole("button", { name: `Inspect ${SUN}` }).click();
  const dialog = lea.getByRole("dialog");
  await expect(dialog).toContainText(`Finish ${SUN}`);
  await dialog.getByLabel(new RegExp(`^Pairs finished in ${SUN}`)).fill("20");
  await dialog.getByLabel("Of these, failed inspection").fill("1");
  // What was wrong (Phase 34): failed pairs need a reason.
  await dialog.getByLabel("Defect, line 1").selectOption({ label: "Scuffs" });
  await dialog.getByLabel("Pairs, line 1", { exact: true }).fill("1");
  await dialog
    .getByRole("radiogroup", { name: "Can line 1 be fixed?" })
    .getByLabel("Not fixable", { exact: true })
    .check();
  await dialog.getByRole("button", { name: `Finish ${SUN}` }).click();
  await expect(dialog).toBeHidden();
  await expect(lea.getByText(`${SUN} finished.`, { exact: true })).toBeVisible();
  // The toast sits over the list on a phone; let it go before the next tap (it intercepted the click in a loaded run).
  // Sonner pauses a toast's timer while the pointer is over it, and the pointer is still where Finish was,
  // under the toast: move it away first, as a finger lifting off the screen would.
  await lea.mouse.move(0, 0);
  await expect(lea.getByText(`${SUN} finished.`, { exact: true })).toBeHidden({ timeout: 15_000 });
  await expect(lea.getByTestId(`queue-${SUN}`)).toHaveCount(0);
  await expect(lea.getByTestId(`done-${SUN}`)).toContainText("20 pairs, 1 failed");
  await expect(lea.getByTestId(`done-${SUN}`)).toContainText("Inspected");

  // Inspected today, so it can be corrected from the list, though it is Sunday's batch.
  await lea
    .getByTestId(`done-${SUN}`)
    .getByRole("button", { name: `Correct ${SUN}` })
    .click();
  const fix = lea.getByRole("dialog");
  await expect(fix).toContainText(`Correct ${SUN}`);
  await fix.getByLabel(new RegExp(`^Pairs finished in ${SUN}`)).fill("21");
  await fix.getByLabel("Why are you correcting it?").fill("Counted one rack twice");
  await fix.getByRole("button", { name: "Save correction" }).click();
  await expect(fix).toBeHidden();
  await expect(lea.getByTestId(`done-${SUN}`)).toContainText("21 pairs, 1 failed");

  // Phone layout (D-096): no sideways scroll.
  expect(await lea.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(await axe(lea)).toEqual([]);
});

test("the Floor Manager voids a batch with a reason; it leaves the queue and can't be finished", async ({
  browser,
}) => {
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  await fm.goto("/batches?tab=queue");
  const sat = fm.getByTestId(`queue-${SAT}`);
  await sat.getByRole("button", { name: `Void ${SAT}` }).click();
  const dialog = fm.getByRole("dialog");
  await dialog.getByRole("button", { name: "Void batch" }).click();
  await expect(
    dialog.getByText(/^Say why this batch won't be inspected, at least 5 characters/),
  ).toBeVisible();
  await dialog.getByLabel("Why won't it be inspected?").fill("Line stopped, no pairs made");
  await dialog.getByRole("button", { name: "Void batch" }).click();
  await expect(dialog).toBeHidden();
  await expect(fm.getByText(`${SAT} is void.`)).toBeVisible();
  await expect(fm.getByTestId(`queue-${SAT}`)).toHaveCount(0);
  await expect(fm.getByTestId(`done-${SAT}`)).toContainText("Line stopped, no pairs made");

  const data = await queue(fm);
  expect(data.done.find((d) => d.code === SAT)).toMatchObject({ state: "VOID" });

  // Finishing a voided batch is refused, naming it.
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  const id = await withDb(
    async (db) =>
      (await db.query<{ id: string }>(`SELECT id FROM production_batches WHERE code = $1`, [SAT]))
        .rows[0].id,
  );
  const res = await qi.request.post("/api/v1/production/check-ins", {
    data: { batchId: id, pairs: 1 },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.message).toBe(
    `${SAT} was voided: Line stopped, no pairs made. It can't be finished.`,
  );
});
