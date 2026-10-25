import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import pg from "pg";
import { ACCOUNTS, DEMO_PASSWORD, signIn } from "./helpers";

/**
 * Attendance (Phase 22, D-077 to D-081). The test adds its own Shoe Constructor, dated 10 days
 * back so they are on today's, yesterday's and the locked day's roster, and removes them (and the
 * marks that name them) afterwards. The days themselves stay, as the Floor Manager's log.
 */
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const NAME = `E2E Attendance ${STAMP}`;
const EMAIL = `e2e-attendance-${STAMP}@cpoint.local`;

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

/** The roster row for our test constructor, found with the Find box. */
async function findOurRow(page: Page) {
  await page.getByLabel("Find a person").fill(STAMP);
  const row = page.getByRole("row", { name: NAME });
  await expect(row).toBeVisible();
  return row;
}

test.beforeAll(async () => {
  expect(DEMO_PASSWORD, "Set DEMO_USER_PASSWORD (and SEED_DEMO_USERS=true) for e2e").not.toBe("");
  await withDb((db) =>
    db.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, 'SHOE_CONSTRUCTOR', now() - interval '10 days', now())`,
      [NAME, EMAIL, bcrypt.hashSync(DEMO_PASSWORD, 4)],
    ),
  );
});

test.afterAll(async () => {
  await withDb(async (db) => {
    await db.query(
      `DELETE FROM attendance_marks WHERE "userId" = (SELECT id FROM users WHERE email = $1)`,
      [EMAIL],
    );
    await db.query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
  });
});

test("the Floor Manager takes today's attendance and the home card shows the count", async ({
  browser,
}) => {
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await page.goto("/attendance");
  await expect(page.getByRole("heading", { name: "Attendance", level: 1 })).toBeVisible();

  const row = await findOurRow(page);
  const box = row.getByRole("checkbox", { name: `${NAME}: Present` });
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(page.getByRole("button", { name: "Save attendance (1 change)" })).toBeEnabled();
  await page.getByRole("button", { name: "Save attendance (1 change)" }).click();
  await expect(page.getByText(/^Attendance for .* saved:/)).toBeVisible();
  await expect(page.getByTestId("attendance-summary")).toContainText(/Shoe Constructors? present/);

  await page.reload();
  await expect((await findOurRow(page)).getByRole("checkbox")).toBeChecked();
  // Nothing changed now, so there is nothing to save.
  await expect(page.getByRole("button", { name: "Save attendance" })).toBeDisabled();

  await page.goto("/floor-manager");
  await expect(page.getByTestId("attendance-card")).toContainText(/Shoe Constructors? present/);
});

test("the Floor Manager edits yesterday, and leaving with unsaved ticks asks first", async ({
  browser,
}) => {
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await page.goto(`/attendance?day=${manilaDay(-1)}`);
  const row = await findOurRow(page);
  const box = row.getByRole("checkbox");
  const wasChecked = await box.isChecked();
  await box.setChecked(!wasChecked);

  // Dismissing the prompt keeps the page and the tick.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page).toHaveURL(new RegExp(`day=${manilaDay(-1)}`));
  await expect(box).toBeChecked({ checked: !wasChecked });

  await page.getByRole("button", { name: /^Save attendance \(\d+ changes?\)$/ }).click();
  await expect(page.getByText(/^Attendance for .* saved:/)).toBeVisible();
  await page.reload();
  await expect((await findOurRow(page)).getByRole("checkbox")).toBeChecked({
    checked: !wasChecked,
  });
});

test("a day more than 7 days ago is read-only, and the future can't be saved", async ({
  browser,
}) => {
  const manager = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await manager.goto(`/attendance?day=${manilaDay(-8)}`);
  await expect(manager.getByText("Days more than 7 days ago are locked.")).toBeVisible();
  const row = await findOurRow(manager);
  await expect(row.getByRole("checkbox")).toHaveCount(0);
  await expect(manager.getByRole("button", { name: /Save attendance/ })).toHaveCount(0);
  await expect(manager.getByRole("button", { name: "Next day" })).toBeEnabled();

  // The API refuses a locked day and a future day with the reason.
  const userId = await withDb(
    async (db) => (await db.query("SELECT id FROM users WHERE email = $1", [EMAIL])).rows[0].id,
  );
  for (const [day, reason] of [
    [manilaDay(-8), "Days more than 7 days ago are locked."],
    [manilaDay(1), "Attendance can't be taken for a future day."],
  ]) {
    const res = await manager.request.put(`/api/v1/attendance/${day}`, {
      data: { expectedUpdatedAt: null, marks: [{ userId, present: true }] },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.message).toBe(reason);
  }
});

// Attendance is the Floor Manager's alone since Phase 28 (D-100).
for (const role of ["inspector", "admin", "constructor"] as const) {
  test(`the ${role} is refused the page and the API`, async ({ browser }) => {
    const page = await signedIn(browser, ACCOUNTS[role].email, ACCOUNTS[role].home);
    await page.goto("/attendance");
    await expect(page).toHaveURL("/forbidden");
    expect((await page.request.get("/api/v1/attendance")).status()).toBe(403);
  });
}

test("the Attendance page passes axe (WCAG 2.1 A/AA)", async ({ browser }) => {
  const page = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await page.goto("/attendance");
  await expect(page.getByTestId("attendance-summary")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  expect(serious).toEqual([]);
});
