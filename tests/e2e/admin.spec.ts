import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  captureApi,
  createRoll,
  createDeviceToken,
  managerApi,
  postScan,
  withDb,
} from "./cv-helpers";

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

// Pages opened beside the test's own page are closed after each test, so renderers don't pile up.
const extraPages: Page[] = [];
test.afterEach(async () => {
  await Promise.all(extraPages.splice(0).map((p) => p.close()));
});

async function adminPage(browser: Browser) {
  const page = await browser.newPage();
  extraPages.push(page);
  await signInAs(page, ACCOUNTS.admin);
  return page;
}

const suffix = () => randomBytes(3).toString("hex");

test("a new account signs in with its temporary password, must choose its own, and a reset ends its session", async ({
  browser,
  page,
}) => {
  // Long under a full parallel run (several sign-ins and password hashes): 30 s was too tight.
  test.setTimeout(60_000);
  const email = `e2e-qi-${suffix()}@cpoint.local`;
  const name = `E2E Inspector ${suffix()}`;
  const admin = await adminPage(browser);

  // Create: the temporary password is shown once.
  await admin.goto("/admin/users");
  await admin.getByRole("button", { name: "Add user" }).click();
  const create = admin.getByRole("dialog");
  await create.getByLabel("Name").fill(name);
  await create.getByLabel("Email").fill(email);
  await create.locator("#user-role").selectOption("QUALITY_INSPECTOR");
  await create.getByRole("button", { name: "Create account" }).click();
  const temp = await create.getByLabel("Temporary password").inputValue();
  expect(temp).toMatch(/^[A-Za-z2-9]{12}$/);
  await create.getByRole("button", { name: "Done" }).click();
  // Searched, not browsed: other tests add accounts that can push this one past page 1.
  await admin.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await expect(admin.getByRole("row", { name: email })).toContainText("Temporary password");

  // First sign-in: forced to choose a password before anything else.
  await page.goto("/login");
  await signIn(page, email, temp);
  await expect(page).toHaveURL("/account/password");
  await page.goto("/batches");
  await expect(page).toHaveURL("/account/password");
  await page.getByLabel("Temporary password").fill(temp);
  await page.getByLabel("New password").fill("short");
  await page.getByLabel("Type it again").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("The new password needs at least 10 characters")).toBeVisible();
  const chosen = `leather roll ${suffix()}`;
  await page.getByLabel("New password").fill(chosen);
  await page.getByLabel("Type it again").fill(chosen);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL("/batches");

  // Reset by the admin: the open session ends on the next request.
  await admin.reload();
  await admin.getByRole("button", { name: `More actions for ${name}` }).click();
  await admin.getByRole("menuitem", { name: "Reset password…" }).click();
  const reset = admin.getByRole("dialog");
  await reset.getByRole("button", { name: "Reset password" }).click();
  const temp2 = await reset.getByLabel("Temporary password").inputValue();
  expect(temp2).not.toBe(temp);
  await reset.getByRole("button", { name: "Done" }).click();

  await page.reload();
  await expect(page).toHaveURL("/login?reason=password-reset");
  await expect(page.getByText("Your password was changed, so you were signed out")).toBeVisible();
  await signIn(page, email, chosen);
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
  await signIn(page, email, temp2);
  await expect(page).toHaveURL("/account/password");

  // The audit log shows the reset, with what changed.
  await admin.goto("/admin/audit?action=user.password_reset");
  const entry = admin.getByTestId("audit-entry").filter({ hasText: email });
  await expect(entry).toContainText("user.password_reset");
  await entry.locator("summary").click();
  await expect(entry).toContainText("mustChangePassword");
  await admin.close();
});

test("the admin can't lock themselves out", async ({ page }) => {
  await signInAs(page, ACCOUNTS.admin);
  await page.goto("/admin/users?q=admin%40cpoint.local");
  await page.getByRole("button", { name: /More actions for/ }).click();
  await expect(page.getByRole("menuitem", { name: /Deactivate/ })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: /Deactivate/ })).toContainText(
    "You can't deactivate your own account.",
  );
  await page.keyboard.press("Escape");

  const me = (await (await page.request.get("/api/v1/users?q=admin%40cpoint.local")).json()).data
    .rows[0];
  const deactivate = await page.request.patch(`/api/v1/users/${me.id}`, {
    data: { isActive: false },
  });
  expect(deactivate.status()).toBe(409);
  const demote = await page.request.patch(`/api/v1/users/${me.id}`, {
    data: { name: me.name, email: me.email, role: "FLOOR_MANAGER" },
  });
  expect(demote.status()).toBe(409);
});

test.describe("camera settings", () => {
  // Other specs post scans in parallel. Found at 45% decides every confidence they use the same
  // way as 50% (none between 0.45 and 0.50), so they're unaffected.
  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({ browser }) => {
    const admin = await adminPage(browser);
    await admin.request.put("/api/v1/settings/cv", { data: { foundPercent: 50 } });
    await admin.close();
  });

  test("the found-at value is validated, and new scans use the saved one (D-093)", async ({
    browser,
    page,
    request,
  }) => {
    await signInAs(page, ACCOUNTS.admin);
    await page.goto("/admin/settings");
    await expect(page.getByLabel("Reject at or above")).toHaveCount(0);
    await expect(page.getByLabel("Fixable at or above")).toHaveCount(0);
    const found = page.getByLabel("A defect counts as found at");
    await found.fill("0");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Enter the found-at value as a percentage from 1 to 100, like 50."),
    ).toBeVisible();

    await found.fill("45");
    await expect(page.getByRole("listitem").filter({ hasText: "Not accepted type" })).toContainText(
      "found from 45%",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved. New scans use it from now on.")).toBeVisible();

    // The API refuses the two old thresholds by name.
    const old = await page.request.put("/api/v1/settings/cv", {
      data: { foundPercent: 45, rejectPercent: 90, reworkPercent: 60 },
    });
    expect(old.status()).toBe(422);

    const api = await managerApi(browser);
    const roll = await createRoll(await captureApi(browser));
    const { token } = await createDeviceToken();
    const res = await postScan(request, token, roll.id, [{ classKey: "cut", confidence: 0.47 }]);
    expect(res.status()).toBe(201);
    const scan = (await res.json()).data;
    expect(scan.verdict).toBe("REJECT"); // a Not accepted cut found at 45%
    const detail = await (await api.get(`/api/v1/scans/${scan.scanId}`)).json();
    expect(detail.data.thresholdsSnapshot).toMatchObject({ foundAtOrAbove: 0.45 });
    expect(detail.data.thresholdsSnapshot).not.toHaveProperty("rejectAtOrAbove");
  });

  test("a class with no defect type is ignored until added; then it counts (D-108)", async ({
    browser,
    page,
    request,
  }) => {
    const key = `e2e-${suffix()}`;
    const roll = await createRoll(await captureApi(browser));
    const { token } = await createDeviceToken();
    const before = await postScan(request, token, roll.id, [{ classKey: key, confidence: 0.95 }]);
    expect((await before.json()).data.verdict).toBe("PASS"); // dropped: no defect type (D-108)

    await signInAs(page, ACCOUNTS.admin);
    await page.goto("/admin/settings?tab=defects");
    await expect(page.getByText(/unknown/i)).toHaveCount(0);
    await page.getByRole("button", { name: "Add defect type" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Class key").fill(key);
    await dialog.getByLabel("Label").fill(key.replace("-", " "));
    // The outcome is required (D-093).
    await dialog.getByRole("button", { name: "Add defect type" }).click();
    await expect(dialog.getByText(/is Usable or Not accepted\./)).toBeVisible();
    await dialog.getByLabel("When found").selectOption({ value: "NOT_ACCEPTED" });
    await dialog.getByRole("button", { name: "Add defect type" }).click();
    // Found, not browsed: other runs add defect types that can push this one past page 1 (D-047).
    await page.getByLabel("Find defect type").fill(key.replace("-", " "));
    await expect(
      page.getByRole("row", { name: new RegExp(key.replace("-", " "), "i") }),
    ).toBeVisible();

    const after = await postScan(request, token, roll.id, [{ classKey: key, confidence: 0.95 }]);
    expect((await after.json()).data.verdict).toBe("REJECT");

    // Leave it inactive so it doesn't change other runs.
    const row = page.getByRole("row", { name: new RegExp(key.replace("-", " "), "i") });
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row).toContainText("Inactive");
  });
});

test("a deactivated supplier disappears from the roll supplier lists (Phase 26)", async ({
  browser,
  page,
}) => {
  const supplier = `E2E Supplier ${suffix()}`;
  const admin = await adminPage(browser);
  await admin.goto("/admin/settings?tab=suppliers");
  await admin.getByRole("button", { name: "Add supplier" }).click();
  await admin.getByRole("dialog").getByLabel("Name").fill(supplier);
  await admin.getByRole("dialog").getByLabel("Phone (optional)").fill("0917 123 4567");
  await admin.getByRole("dialog").getByRole("button", { name: "Add supplier" }).click();
  await admin.getByLabel("Find supplier").fill(supplier);
  await expect(admin.getByRole("row", { name: supplier })).toContainText("0917 123 4567");
  // Left blank, the code is made from the name's initials (Phase 30A): E2E Supplier … → ES…
  // The Code cell, the row's second column (QA 30A run 2, F1: the row's text runs the cells together).
  await expect(admin.getByRole("row", { name: supplier }).getByRole("cell").nth(1)).toHaveText(
    /^ES[A-Z0-9]{0,4}$/,
  );
  // A code another supplier has is refused on its field.
  await admin.getByRole("button", { name: "Add supplier" }).click();
  await admin.getByRole("dialog").getByLabel("Name").fill(`${supplier} B`);
  const taken = await withDb(
    async (db) => (await db.query(`SELECT code FROM suppliers ORDER BY code LIMIT 1`)).rows[0].code,
  );
  await admin.getByRole("dialog").getByLabel("Code (optional)").fill(taken);
  await admin.getByRole("dialog").getByRole("button", { name: "Add supplier" }).click();
  await expect(admin.getByRole("dialog")).toContainText(
    `${taken} is already another supplier’s code.`,
  );
  await admin.getByRole("dialog").getByLabel("Code (optional)").fill("2AB");
  await admin.getByRole("dialog").getByRole("button", { name: "Add supplier" }).click();
  await expect(admin.getByRole("dialog")).toContainText(
    "Enter a short code of 2 to 6 capital letters or digits",
  );
  await admin.keyboard.press("Escape");

  // Shoe types are gone (Phase 27, C-8): no Settings tab, no API.
  await admin.goto("/admin/settings");
  await expect(admin.getByRole("link", { name: "Shoe types" })).toHaveCount(0);
  expect((await admin.request.get("/api/v1/shoe-types")).status()).toBe(404);

  // The supplier is listed in Reports → Rolls' filter.
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/reports/rolls?status=PASSED");
  await expect(page.getByLabel("Supplier").getByRole("option", { name: supplier })).toHaveCount(1);

  await admin.goto("/admin/settings?tab=suppliers");
  await admin.getByLabel("Find supplier").fill(supplier);
  await admin
    .getByRole("row", { name: supplier })
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(admin.getByRole("row", { name: supplier })).toContainText("Inactive");

  await page.reload();
  await expect(page.getByLabel("Supplier").getByRole("option", { name: supplier })).toHaveCount(0);
  await admin.close();
});

test("only the System Admin reaches the admin pages and APIs", async ({ browser, page }) => {
  await signInAs(page, ACCOUNTS.manager);
  for (const path of ["/admin/users", "/admin/settings", "/admin/audit"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/forbidden");
  }
  expect((await page.request.get("/api/v1/settings/cv")).status()).toBe(403);

  const qi = await browser.newPage();
  await signInAs(qi, ACCOUNTS.inspector);
  expect((await qi.request.get("/api/v1/users")).status()).toBe(403);
  expect((await qi.request.get("/api/v1/audit-logs")).status()).toBe(403);
  await qi.close();
});
