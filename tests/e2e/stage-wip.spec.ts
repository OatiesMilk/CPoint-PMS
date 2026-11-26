import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { ACCOUNTS, signIn } from "./helpers";
import { makeConstructor } from "./cv-helpers";

/**
 * Stages and the work in progress board (Phase 34, D-130): the Floor Manager says in the Plan
 * dialog who works where (a prefilled suggestion, one stage per person, past days read-only), an
 * assigned constructor counts their stage from My stage on a phone (with or without camera
 * access), an unassigned one can't, the Floor Manager covers an empty stage, and the board and
 * Operations' work in progress section agree. The QI sees the board read-only.
 *
 * The suite's constructors and its two future planned days (a Monday and the Tuesday after it, at
 * least 3 weeks ahead) are its own; it removes only those, and the counts it saved.
 */
test.describe.configure({ mode: "serial" });

const manilaDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
  );
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

function mondayAhead(from: number): string {
  for (let i = from; i < from + 7; i++) if (weekdayOf(manilaDay(i)) === 1) return manilaDay(i);
  throw new Error("no Monday");
}
const FIRST = mondayAhead(21);
const NEXT = new Date(new Date(`${FIRST}T00:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10);
const TODAY = manilaDay();
const STARTED = new Date();

async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

let assigned: { id: string; email: string }; // at Sole-ing today, no camera access
let capturer: { id: string; email: string }; // has Capture access: at Preparation by the flag, never saved (Addendum 1)
let loose: { id: string; email: string }; // not assigned to any stage

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

async function cleanUp(db: pg.Client) {
  const ids = [assigned?.id, capturer?.id, loose?.id].filter(Boolean);
  await db.query(`DELETE FROM stage_counts WHERE "enteredAt" >= $1`, [STARTED]);
  await db.query(
    `DELETE FROM stage_assignments WHERE "userId" = ANY($1::uuid[]) OR day = ANY($2::date[])`,
    [ids, [FIRST, NEXT]],
  );
  await db.query(`DELETE FROM day_plans WHERE day = ANY($1::date[])`, [[FIRST, NEXT]]);
  // Audit rows keep their place (the actor is set to null); if a user can't go, it is switched off.
  try {
    await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
  } catch {
    await db.query(`UPDATE users SET "isActive" = false WHERE id = ANY($1::uuid[])`, [ids]);
  }
}

test.beforeAll(async () => {
  assigned = await makeConstructor({ canCapture: false });
  capturer = await makeConstructor({ canCapture: true });
  loose = await makeConstructor({ canCapture: false });
  await withDb(async (db) => {
    const fm = (await db.query(`SELECT id FROM users WHERE email = $1`, [ACCOUNTS.manager.email]))
      .rows[0].id;
    for (const day of [FIRST, NEXT])
      await db.query(
        `INSERT INTO day_plans (id, day, kind, "rollsPlanned", quota, "intervalMinutes", "shiftStart", "shiftEnd", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1::date, 'PLANNED', 2, 50, 240, '08:00', '17:00', now(), now())
         ON CONFLICT (day) DO NOTHING`,
        [day],
      );
    // Today: one constructor at Sole-ing without camera access. The one with Capture access has no
    // row: they are at Preparation because of their flag.
    await db.query(
      `INSERT INTO stage_assignments (id, day, stage, "userId", "assignedById")
       VALUES (gen_random_uuid(), $1::date, 'SOLE_ING', $2::uuid, $3::uuid)`,
      [TODAY, assigned.id, fm],
    );
    // The first future day already has stages, so the second one starts from them.
    await db.query(
      `INSERT INTO stage_assignments (id, day, stage, "userId", "assignedById")
       VALUES (gen_random_uuid(), $1::date, 'FINISHING', $2::uuid, $3::uuid)`,
      [FIRST, loose.id, fm],
    );
  });
});

test.afterAll(async () => {
  await withDb(cleanUp);
});

test("the Floor Manager assigns stages in the Plan dialog, starting from the last day's, one stage each", async ({
  browser,
}) => {
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  await fm.goto(`/batches/plan?day=${NEXT}`);
  const section = fm.getByTestId("stage-assignments");
  await expect(section.getByRole("heading", { name: "Who works where" })).toBeVisible();
  // The day is empty, so the stages of the last working day are suggested; nothing is stored yet.
  await expect(section.getByTestId("stages-prefill")).toContainText("Save to confirm.");
  const stored = () =>
    withDb(async (db) =>
      Number(
        (await db.query(`SELECT count(*) FROM stage_assignments WHERE day = $1::date`, [NEXT]))
          .rows[0].count,
      ),
    );
  expect(await stored()).toBe(0);
  const finishing = section.getByRole("group", { name: "Finishing" });
  await expect(finishing.getByLabel(/E2E Constructor/).first()).toBeVisible();
  // Ticking a constructor at another stage moves them: they are at one stage a day.
  const soleIng = section.getByRole("group", { name: "Sole-ing" });
  const name = (await withDb(
    async (db) => (await db.query(`SELECT name FROM users WHERE id = $1`, [loose.id])).rows[0].name,
  )) as string;
  await expect(finishing.getByLabel(name)).toBeChecked();
  await soleIng.getByLabel(name).check();
  await expect(finishing.getByLabel(name)).not.toBeChecked();
  await expect(finishing.getByText("At Sole-ing").first()).toBeVisible();
  expect(await axe(fm)).toEqual([]);
  await section.getByRole("button", { name: "Save stages" }).click();
  await expect(fm.getByText("Who works where is saved.")).toBeVisible();
  const rows = await withDb(
    async (db) =>
      (await db.query(`SELECT stage, "userId" FROM stage_assignments WHERE day = $1::date`, [NEXT]))
        .rows,
  );
  expect(rows).toEqual([{ stage: "SOLE_ING", userId: loose.id }]);

  // A past day can't change: the API says why.
  const past = await fm.request.put(`/api/v1/production/stages/${manilaDay(-3)}`, {
    data: { assignments: [] },
  });
  expect(past.status()).toBe(409);
  // An unplanned day needs a plan first.
  const unplanned = await fm.request.put(`/api/v1/production/stages/${manilaDay(60)}`, {
    data: { assignments: [] },
  });
  expect([409, 422]).toContain(unplanned.status());
  await fm.context().close();
});

test("an assigned constructor counts their stage on a phone, even without camera access", async ({
  browser,
}) => {
  const page = await signedIn(browser, assigned.email, { width: 390, height: 800 });
  await page.goto("/camera/capture");
  // No camera access, but a stage today: My stage is here instead of the camera message.
  await expect(page.getByTestId("no-camera-access")).toHaveCount(0);
  const card = page.getByTestId("my-stage");
  await expect(card.getByRole("heading", { name: "Sole-ing · pairs here now" })).toBeVisible();
  const input = card.getByLabel("Pairs at Sole-ing now");
  await expect(input).toHaveAttribute("inputmode", "numeric");
  // The message shows as soon as a wrong entry is left, before Save is pressed, and Save stays on.
  const tryAgain = card.getByText(
    "Enter the pairs here now as a whole number, like 12. Enter 0 if none.",
  );
  await input.fill("x");
  await input.blur();
  await expect(tryAgain).toBeVisible();
  await expect(card.getByRole("button", { name: "Save count" })).toBeEnabled();
  await card.getByRole("button", { name: "Save count" }).click();
  await expect(tryAgain).toBeVisible();
  await expect(page.getByText(/Sole-ing counted/)).toHaveCount(0);
  // Empty, and numbers written the way a spreadsheet would, are refused the same way.
  await input.fill("");
  await card.getByRole("button", { name: "Save count" }).click();
  await expect(tryAgain).toBeVisible();
  await input.fill("1e3");
  await card.getByRole("button", { name: "Save count" }).click();
  await expect(tryAgain).toBeVisible();
  await input.fill("14");
  await expect(tryAgain).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
  await card.getByRole("button", { name: "Save count" }).click();
  await expect(page.getByText("Sole-ing counted: 14 pairs.")).toBeVisible();
  // The number is the stage's: "for all of Sole-ing", never the person's.
  await expect(card.getByTestId("my-stage-last")).toContainText("for all of Sole-ing");
  await expect(page.getByRole("button", { name: "Save count" })).toBeVisible();
  // No horizontal scroll on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  // Not the stage they are assigned to: the API refuses.
  const other = await page.request.post("/api/v1/production/stage-counts", {
    data: { stage: "FINISHING", pairs: 3 },
  });
  expect(other.status()).toBe(403);
  await page.context().close();
});

test("a constructor who isn't assigned can't count, in the page or the API", async ({
  browser,
}) => {
  const page = await signedIn(browser, loose.email, { width: 390, height: 800 });
  await page.goto("/camera/capture");
  await expect(page.getByTestId("no-camera-access")).toBeVisible();
  await expect(page.getByTestId("my-stage-none")).toContainText(
    "You aren’t assigned to a stage today. Ask the Floor Manager.",
  );
  const res = await page.request.post("/api/v1/production/stage-counts", {
    data: { stage: "SOLE_ING", pairs: 3 },
  });
  expect(res.status()).toBe(403);
  await page.context().close();
});

test("the Floor Manager covers a stage nobody is assigned to, and the board and the report agree", async ({
  browser,
}) => {
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  await fm.goto("/batches?tab=wip");
  const preparation = fm.getByTestId("wip-PREPARATION");
  await expect(preparation).toContainText("Rolls:");
  // At Preparation the defects are the camera's, on the raw roll; no repairs go there (D-136).
  await expect(preparation.getByTestId("wip-leather-defects")).toContainText(
    "Leather defects found by the camera",
  );
  await expect(preparation).not.toContainText("No repairs here.");
  await preparation.getByRole("button", { name: /^Update count/ }).click();
  await preparation.getByLabel("Pieces at Preparation now").fill("33");
  await preparation.getByRole("button", { name: "Save count" }).click();
  await expect(fm.getByText("Preparation counted: 33 pieces.")).toBeVisible();
  await expect(preparation).toContainText("33");
  await expect(preparation).toContainText(/pieces as of \d\d:\d\d/);
  // Sole-ing shows the constructor's count with who is assigned in a quiet line below.
  const soleIng = fm.getByTestId("wip-SOLE_ING");
  await expect(soleIng).toContainText("14");
  await expect(soleIng).toContainText(/pairs as of \d\d:\d\d/);
  await expect(soleIng).toContainText("Assigned today:");
  expect(await axe(fm)).toEqual([]);

  // The board's figures are the report's latest for today.
  const board = (await (await fm.request.get("/api/v1/production/wip")).json()).data;
  const report = (
    await (await fm.request.get(`/api/v1/reports/operations?from=${TODAY}&to=${TODAY}`)).json()
  ).data;
  // Preparation is counted in pieces, so the report leaves it out (D-137): only the pair stages match.
  for (const card of board.cards as { stage: string; pairs: number | null }[]) {
    const row = report.wip.stages.find((s: { stage: string }) => s.stage === card.stage);
    if (card.stage === "PREPARATION") expect(row).toBeUndefined();
    else expect(row.latest).toBe(card.pairs);
  }
  // The home card links to it.
  await fm.goto("/floor-manager");
  await expect(fm.getByTestId("wip-card")).toContainText("Preparation");
  await fm.goto(`/reports?view=operations&from=${TODAY}&to=${TODAY}`);
  // The report compares only the stages counted in pairs: no Preparation row, and Sole-ing's 14 shows.
  await expect(
    fm.getByTestId("wip-stage-table").getByRole("row", { name: "Sole-ing" }),
  ).toContainText("14");
  await expect(
    fm.getByTestId("wip-stage-table").getByRole("row", { name: "Preparation" }),
  ).toHaveCount(0);
  await expect(fm.getByTestId("wip-section")).toContainText("Preparation is counted in pieces");
  await fm.context().close();
});

test("the Quality Inspector sees the board but can't count or change anything", async ({
  browser,
}) => {
  const qi = await signedIn(browser, ACCOUNTS.inspector.email);
  await qi.goto("/batches?tab=wip");
  await expect(qi.getByTestId("wip-board")).toBeVisible();
  await expect(qi.getByTestId("wip-waiting")).toContainText("waiting for inspection");
  // On the board only: the Demo mode band has its own "Change time" button.
  const board = qi.getByTestId("wip-board");
  await expect(board.getByRole("button", { name: /Update count/ })).toHaveCount(0);
  await expect(board.getByRole("button", { name: /Back for inspection/ })).toHaveCount(0);
  await expect(board.getByRole("button", { name: /^Change/ })).toHaveCount(0);
  const count = await qi.request.post("/api/v1/production/stage-counts", {
    data: { stage: "SOLE_ING", pairs: 1 },
  });
  expect(count.status()).toBe(403);
  const assign = await qi.request.put(`/api/v1/production/stages/${FIRST}`, {
    data: { assignments: [] },
  });
  expect(assign.status()).toBe(403);
  // The nav is unchanged: the QI's one page is Batches.
  expect(
    await qi.getByRole("navigation", { name: "Main" }).locator("li").allInnerTexts(),
  ).toHaveLength(1);
  await qi.context().close();
});

test("a constructor with Capture access is at Preparation: locked in the Plan dialog, refused elsewhere, My stage is Preparation", async ({
  browser,
}) => {
  const capName = await withDb(
    async (db) =>
      (await db.query(`SELECT name FROM users WHERE id = $1`, [capturer.id])).rows[0]
        .name as string,
  );
  const fm = await signedIn(browser, ACCOUNTS.manager.email);
  await fm.goto(`/batches/plan?day=${NEXT}`);
  const section = fm.getByTestId("stage-assignments");
  const preparation = section.getByRole("group", { name: "Preparation" });
  // Shown automatically under Preparation, ticked and locked, with the note.
  const locked = preparation.getByLabel(capName);
  await expect(locked).toBeChecked();
  await expect(locked).toBeDisabled();
  await expect(preparation.getByText("Has Capture access").first()).toBeVisible();
  // Not offered under the other stages.
  for (const stage of ["Construction", "Sole-ing", "Finishing"])
    await expect(section.getByRole("group", { name: stage }).getByLabel(capName)).toHaveCount(0);
  // A person without Capture access can still go to Preparation: this spec's own `loose`, by their
  // exact generated name (other runs may have left locked Capture constructors in the list).
  const looseName = await withDb(
    async (db) =>
      (await db.query(`SELECT name FROM users WHERE id = $1`, [loose.id])).rows[0].name as string,
  );
  const looseBox = preparation.getByLabel(looseName);
  await expect(looseBox).toBeEnabled();
  await expect(looseBox).not.toBeChecked();
  expect(await axe(fm)).toEqual([]);

  // The API refuses one at another stage, with the fix, and stores nothing for them.
  const refused = await fm.request.put(`/api/v1/production/stages/${NEXT}`, {
    data: { assignments: [{ stage: "SOLE_ING", userIds: [capturer.id] }] },
  });
  expect(refused.status()).toBe(422);
  expect(JSON.stringify(await refused.json())).toContain(
    `${capName.split(" ")[0]} is a shoe constructor with Capture access, so ${capName.split(" ")[0]} works at Preparation. Choose Preparation, or ask the Admin to remove Capture access first.`,
  );
  const saved = await fm.request.put(`/api/v1/production/stages/${NEXT}`, {
    data: { assignments: [{ stage: "PREPARATION", userIds: [capturer.id] }] },
  });
  expect(saved.status()).toBe(200);
  const rows = await withDb(
    async (db) =>
      (await db.query(`SELECT 1 FROM stage_assignments WHERE "userId" = $1`, [capturer.id]))
        .rowCount,
  );
  expect(rows).toBe(0);
  // The board names them at Preparation, below the figures.
  await fm.goto("/batches?tab=wip");
  await expect(fm.getByTestId("wip-PREPARATION")).toContainText(capName);
  await fm.context().close();

  // On their phone, My stage is Preparation, and they can count it but no other stage.
  const page = await signedIn(browser, capturer.email, { width: 390, height: 800 });
  await page.goto("/camera/capture");
  const card = page.getByTestId("my-stage");
  await expect(card.getByRole("heading", { name: "Preparation · pieces here now" })).toBeVisible();
  await expect(card.getByTestId("my-stage-capture")).toContainText(
    "You have Capture access, so you work at Preparation.",
  );
  await card.getByLabel("Pieces at Preparation now").fill("21");
  await card.getByRole("button", { name: "Save count" }).click();
  await expect(page.getByText("Preparation counted: 21 pieces.")).toBeVisible();
  const other = await page.request.post("/api/v1/production/stage-counts", {
    data: { stage: "SOLE_ING", pairs: 3 },
  });
  expect(other.status()).toBe(403);
  await page.context().close();
});
