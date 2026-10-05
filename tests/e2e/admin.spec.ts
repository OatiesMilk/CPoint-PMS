import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { createBatch, createDeviceToken, managerApi, postScan } from "./cv-helpers";

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

async function adminPage(browser: Browser) {
  const page = await browser.newPage();
  await signInAs(page, ACCOUNTS.admin);
  return page;
}

const suffix = () => randomBytes(3).toString("hex");

test("a new account signs in with its temporary password, must choose its own, and a reset ends its session", async ({
  browser,
  page,
}) => {
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
  await page.goto("/quality-inspector");
  await expect(page).toHaveURL("/account/password");
  await page.getByLabel("Temporary password").fill(temp);
  await page.getByLabel("New password").fill("short");
  await page.getByLabel("Type it again").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Use at least 10 characters")).toBeVisible();
  const chosen = `leather roll ${suffix()}`;
  await page.getByLabel("New password").fill(chosen);
  await page.getByLabel("Type it again").fill(chosen);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL("/quality-inspector");

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
  // Other specs post scans in parallel. 85% / 50% decides every confidence they use the same way
  // as 90% / 60% (nothing between 0.80 and 0.92, or between 0.40 and 0.65), so they're unaffected.
  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({ browser }) => {
    const admin = await adminPage(browser);
    await admin.request.put("/api/v1/settings/cv", {
      data: { rejectPercent: 90, reworkPercent: 60 },
    });
    await admin.close();
  });

  test("thresholds are validated, and new scans use the saved ones (old scans keep theirs)", async ({
    browser,
    page,
    request,
  }) => {
    await signInAs(page, ACCOUNTS.admin);
    await page.goto("/admin/settings");
    await page.getByLabel("Reject at or above").fill("80");
    await page.getByLabel("Rework at or above").fill("80");
    await page.getByRole("button", { name: "Save thresholds" }).click();
    await expect(page.getByText("Rework must start below Reject (80%).")).toBeVisible();

    await page.getByLabel("Reject at or above").fill("85");
    await page.getByLabel("Rework at or above").fill("50");
    await expect(page.getByText("85% and above")).toBeVisible();
    await page.getByRole("button", { name: "Save thresholds" }).click();
    await expect(page.getByText("Thresholds saved")).toBeVisible();

    const api = await managerApi(browser);
    const batch = await createBatch(api);
    const { token } = await createDeviceToken();
    const res = await postScan(request, token, batch.id, [{ classKey: "cut", confidence: 0.87 }]);
    expect(res.status()).toBe(201);
    const scan = (await res.json()).data;
    expect(scan.verdict).toBe("REJECT");
    const detail = await (await api.get(`/api/v1/scans/${scan.scanId}`)).json();
    expect(detail.data.thresholdsSnapshot).toEqual({ rejectAtOrAbove: 0.85, reworkAtOrAbove: 0.5 });
  });

  test("an unknown class can be added as a defect type, and later scans are decided automatically", async ({
    browser,
    page,
    request,
  }) => {
    const key = `e2e-${suffix()}`;
    const api = await managerApi(browser);
    const batch = await createBatch(api);
    const { token } = await createDeviceToken();
    const before = await postScan(request, token, batch.id, [{ classKey: key, confidence: 0.95 }]);
    expect((await before.json()).data.verdict).toBe("NEEDS_REVIEW");

    await signInAs(page, ACCOUNTS.admin);
    await page.goto("/admin/settings?tab=defects");
    const unknown = page
      .getByTestId("unknown-classes")
      .getByRole("listitem")
      .filter({ hasText: key });
    await expect(unknown).toContainText("1 detection");
    await unknown.getByRole("link", { name: "Add as defect type" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Class key")).toHaveValue(key);
    await dialog.getByRole("button", { name: "Add defect type" }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(key.replace("-", " "), "i") }),
    ).toBeVisible();
    await expect(page.getByTestId("unknown-classes").getByText(key)).toHaveCount(0);

    const after = await postScan(request, token, batch.id, [{ classKey: key, confidence: 0.95 }]);
    expect((await after.json()).data.verdict).toBe("REJECT");

    // Leave it inactive so it doesn't change other runs.
    const row = page.getByRole("row", { name: new RegExp(key.replace("-", " "), "i") });
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row).toContainText("Inactive");
  });
});

test("a deactivated shoe type or supplier disappears from the batch form", async ({
  browser,
  page,
}) => {
  const shoe = `E2E Shoe ${suffix()}`;
  const supplier = `E2E Supplier ${suffix()}`;
  const admin = await adminPage(browser);
  await admin.goto("/admin/settings?tab=shoes");
  await admin.getByRole("button", { name: "Add shoe type" }).click();
  await admin.getByRole("dialog").getByLabel("Name").fill(shoe);
  await admin
    .getByRole("dialog")
    .getByLabel("Code")
    .fill(`E${suffix().slice(0, 5)}`.toUpperCase());
  await admin.getByRole("dialog").getByRole("button", { name: "Add shoe type" }).click();
  await expect(admin.getByRole("row", { name: shoe })).toContainText("Active");

  await admin.goto("/admin/settings?tab=suppliers");
  await admin.getByRole("button", { name: "Add supplier" }).click();
  await admin.getByRole("dialog").getByLabel("Name").fill(supplier);
  await admin.getByRole("dialog").getByLabel("Phone (optional)").fill("0917 123 4567");
  await admin.getByRole("dialog").getByRole("button", { name: "Add supplier" }).click();
  await expect(admin.getByRole("row", { name: supplier })).toContainText("0917 123 4567");

  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/batches/new");
  await expect(page.getByLabel("Shoe type").getByRole("option", { name: shoe })).toHaveCount(1);
  await expect(
    page.getByLabel("Supplier (optional)").getByRole("option", { name: supplier }),
  ).toHaveCount(1);

  await admin
    .getByRole("row", { name: supplier })
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(admin.getByRole("row", { name: supplier })).toContainText("Inactive");
  await admin.goto("/admin/settings?tab=shoes");
  await admin.getByRole("row", { name: shoe }).getByRole("button", { name: "Deactivate" }).click();
  await expect(admin.getByRole("row", { name: shoe })).toContainText("Inactive");

  await page.reload();
  await expect(page.getByLabel("Shoe type").getByRole("option", { name: shoe })).toHaveCount(0);
  await expect(
    page.getByLabel("Supplier (optional)").getByRole("option", { name: supplier }),
  ).toHaveCount(0);
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
