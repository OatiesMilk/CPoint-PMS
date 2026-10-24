import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import pg from "pg";
import { ACCOUNTS, DEMO_PASSWORD, navLabels, signIn } from "./helpers";

test.beforeAll(() => {
  expect(DEMO_PASSWORD, "Set DEMO_USER_PASSWORD (and SEED_DEMO_USERS=true) for e2e").not.toBe("");
});

test("health endpoint reports app and database up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect((await res.json()).checks).toEqual({ app: "up", database: "up" });
});

// Phase 26: rolls moved to Reports (the FM), and only constructors capture.
const EXPECTED_NAV = {
  manager: ["Overview", "Production", "Attendance", "Inventory", "Camera", "Scans", "Reports"],
  inspector: ["Overview", "Production", "Camera", "Scans", "Reports"],
  admin: [
    "Overview",
    "Production",
    "Attendance",
    "Inventory",
    "Camera",
    "Scans",
    "Users",
    "Settings",
    "API tokens",
    "Audit log",
  ],
  // Capture is a constructor's only page and home, with or without camera access.
  constructor: ["Capture"],
} as const;

for (const role of Object.keys(ACCOUNTS) as (keyof typeof ACCOUNTS)[]) {
  const account = ACCOUNTS[role];
  test(`${role} signs in, lands on their home and sees only their nav`, async ({ page }) => {
    await page.goto("/login");
    await signIn(page, account.email);
    await expect(page).toHaveURL(account.home);
    expect(await navLabels(page)).toEqual([...EXPECTED_NAV[role]]);
  });
}

test("a signed-out visit goes to login, then back to the page after signing in", async ({
  page,
}) => {
  await page.goto("/floor-manager");
  await expect(page).toHaveURL("/login?callbackUrl=%2Ffloor-manager");
  await expect(page.getByText("Sign in to continue.")).toBeVisible();
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL("/floor-manager");
});

test("another role's area shows 403", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.inspector.email);
  await expect(page).toHaveURL(ACCOUNTS.inspector.home);
  await page.goto("/admin");
  await expect(page).toHaveURL("/forbidden");
  await expect(
    page.getByRole("heading", { name: "You don’t have access to that page" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to your overview" }).click();
  await expect(page).toHaveURL(ACCOUNTS.inspector.home);
});

test("a wrong password shows the error, keeps the email and clears the password", async ({
  page,
}) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.inspector.email, "not-the-password");
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(ACCOUNTS.inspector.email);
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page).toHaveURL("/login");
});

test("client-side validation explains a malformed email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").focus();
  await expect(page.getByText("Enter your email in full, like name@cpoint.local.")).toBeVisible();
});

test("sign out returns to login and protects pages again", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(ACCOUNTS.admin.home);
  // The account menu is named "<the account's name> System Admin"; the name can be changed.
  await page.getByRole("button", { name: /System Admin$/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login?reason=signed-out");
  await expect(page.getByText("You signed out.")).toBeVisible();
  // Signed out server-side (D-025): even if a late response restored the cookie, the session is
  // refused, so a protected page always lands on the login page.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?(callbackUrl=|reason=signed-out)/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test.describe("deactivation", () => {
  const email = `e2e-deactivated-${Date.now()}@cpoint.local`;
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

  test.beforeAll(async () => {
    await db.connect();
    await db.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "updatedAt")
       VALUES (gen_random_uuid(), 'E2E Inspector', $1, $2, 'QUALITY_INSPECTOR', now())`,
      [email, await bcrypt.hash(DEMO_PASSWORD, 4)],
    );
  });

  test.afterAll(async () => {
    await db.query("DELETE FROM users WHERE email = $1", [email]);
    await db.end();
  });

  test("an open session ends on the next request after the account is deactivated", async ({
    page,
  }) => {
    await page.goto("/login");
    await signIn(page, email);
    await expect(page).toHaveURL("/quality-inspector");

    await db.query(`UPDATE users SET "isActive" = false WHERE email = $1`, [email]);
    await page.reload();
    await expect(page).toHaveURL("/login?reason=deactivated");
    await expect(page.getByText("Your account was deactivated")).toBeVisible();

    await signIn(page, email);
    await expect(page.getByText("This account is deactivated")).toBeVisible();
  });
});

test("the sign-in form never sends credentials before the page is ready, nor in a URL", async ({
  request,
  page,
}) => {
  // The server-rendered form posts (never GET) and its button is disabled until React hydrates,
  // so an early click can't submit the password natively, let alone put it in the address bar.
  const html = await (await request.get("/login")).text();
  expect(html).toMatch(/<form[^>]*method="post"/);
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  expect(page.url()).not.toContain("password");
});
