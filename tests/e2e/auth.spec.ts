import AxeBuilder from "@axe-core/playwright";
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

// Each role sees only its modules (Phase 28, D-100, C-18): one list, in this order.
const EXPECTED_NAV = {
  manager: ["Overview", "Batches", "Attendance", "Reports", "Inventory", "Find roll"],
  inspector: ["Batches"],
  // No Camera: its page is gone (D-119).
  admin: ["Overview", "Users", "Settings", "API tokens", "Audit log"],
  // Capture is a constructor's home; Find roll joins it once they have camera access (Phase 32).
  constructor: ["Capture"],
} as const;

// A sample of pages each role is refused (403 page), and pages that are gone for everyone (404).
const REFUSED = {
  manager: ["/admin", "/admin/users", "/camera/capture"],
  inspector: ["/reports", "/attendance", "/inventory", "/floor-manager", "/admin"],
  admin: ["/batches", "/attendance", "/inventory", "/reports", "/reports/rolls", "/camera/capture"],
  constructor: ["/batches", "/reports", "/admin"],
} as const;

for (const role of Object.keys(ACCOUNTS) as (keyof typeof ACCOUNTS)[]) {
  const account = ACCOUNTS[role];
  test(`${role} signs in, lands on their home and sees only their nav`, async ({ page }) => {
    await page.goto("/login");
    await signIn(page, account.email);
    await expect(page).toHaveURL(account.home);
    const labels = await navLabels(page);
    if (role === "constructor") {
      // With camera access (the demo week gives it to this account) Find roll follows Capture.
      expect(labels[0]).toBe("Capture");
      expect(labels.slice(1)).toEqual(labels.length > 1 ? ["Find roll"] : []);
    } else expect(labels).toEqual([...EXPECTED_NAV[role]]);
  });
}

for (const role of Object.keys(ACCOUNTS) as (keyof typeof ACCOUNTS)[]) {
  test(`${role} is refused every other role's pages`, async ({ page }) => {
    await page.goto("/login");
    await signIn(page, ACCOUNTS[role].email);
    await expect(page).toHaveURL(ACCOUNTS[role].home);
    for (const path of REFUSED[role]) {
      await page.goto(path);
      await expect(page, `${role} → ${path}`).toHaveURL("/forbidden");
    }
  });
}

test("the QI home, the Scans list and its API are gone (A-26)", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  for (const path of ["/quality-inspector", "/scans"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  expect((await page.request.get("/api/v1/scans")).status()).toBe(405);
});

test("the System Admin has no Camera page, home card or scan photos (D-119)", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(ACCOUNTS.admin.home);
  await expect(page.getByTestId("camera-status-card")).toHaveCount(0);
  const res = await page.goto("/camera");
  expect(res?.status()).toBe(404);
  // Refused before the scan is looked up, so any well-formed id will do.
  const image = await page.request.get("/api/v1/scans/0190a4f2-7c1e-7000-8000-000000000000/image");
  expect(image.status()).toBe(403);
});

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
    await expect(page).toHaveURL("/batches");

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

// Demo sign-in and Reset demo data (Phase 28, D-101): only while DEMO_LOGIN_TOOLS (and
// SEED_DEMO_USERS) are on for the server under test. Codex runs this once each way.
const DEMO_TOOLS = process.env.DEMO_LOGIN_TOOLS === "true";

test.describe("demo tools", () => {
  test("with the flag off: no tools, no band, and both endpoints answer 404", async ({
    page,
    request,
  }) => {
    test.skip(DEMO_TOOLS, "The server under test has DEMO_LOGIN_TOOLS=true.");
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByTestId("demo-tools")).toHaveCount(0);
    await expect(page.getByTestId("demo-band")).toHaveCount(0);
    for (const [path, body] of [
      ["/api/v1/demo/sign-in", { role: "FLOOR_MANAGER" }],
      ["/api/v1/demo/reset", { confirm: "RESET" }],
    ] as const)
      expect((await request.post(path, { data: body })).status(), path).toBe(404);
  });

  test("with the flag on: four buttons sign in, and the band shows on every page", async ({
    page,
  }) => {
    test.skip(!DEMO_TOOLS, "Start the server with DEMO_LOGIN_TOOLS=true to run this.");
    await page.goto("/login");
    await expect(page.getByTestId("demo-band")).toContainText("Demo mode");
    const tools = page.getByTestId("demo-tools");
    for (const label of [
      "Floor Manager · Rodel Pascual",
      "Quality Inspector · Maricel Dizon",
      "System Admin · Jerome Salazar",
      "Shoe Constructor · Noel Manalo",
    ])
      await expect(tools.getByRole("button", { name: label })).toBeVisible();
    await tools.getByRole("button", { name: "Quality Inspector · Maricel Dizon" }).click();
    await expect(page).toHaveURL(ACCOUNTS.inspector.home);
    await expect(page.getByTestId("demo-band")).toBeVisible();
  });

  test("with the flag on: Reset demo data needs RESET typed exactly", async ({ page }) => {
    test.skip(!DEMO_TOOLS, "Start the server with DEMO_LOGIN_TOOLS=true to run this.");
    await page.goto("/login");
    await page.getByRole("button", { name: "Reset demo data…" }).click();
    const dialog = page.getByRole("dialog", { name: "Reset demo data?" });
    await dialog.getByLabel("Type RESET to confirm").fill("reset");
    await dialog.getByRole("button", { name: "Reset demo data" }).click();
    await expect(dialog.getByText("Type RESET in capitals to reset the demo data.")).toBeVisible();
    // The reset itself is run by hand on a throwaway stack (the QA handoff), not here.
    await dialog.getByRole("button", { name: "Keep the data" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("the login page passes axe (WCAG 2.1 A/AA), with or without the tools", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
