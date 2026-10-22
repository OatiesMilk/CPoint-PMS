import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

// Batches are leather rolls (Phase 23, D-082): Start roll at Preparation, Finish roll when used up.

const unique = () =>
  `E2E-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

async function createBatch(page: Page, rollCode: string, options: { shoe?: string } = {}) {
  await page.goto("/batches/new");
  await page.getByLabel("Roll code").fill(rollCode);
  await page.getByLabel("Shoe type").selectOption({ label: options.shoe ?? "School Shoe" });
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^B-\d{4}-\d{4,}$/);
  return page.url();
}

const historyRows = (page: Page) => page.getByRole("table").locator("tbody tr");

test.describe("Floor Manager", () => {
  test.beforeEach(async ({ page }) => signInAs(page, ACCOUNTS.manager));

  test("starts a roll at Preparation and finishes it", async ({ page }) => {
    await page.goto("/batches/new");
    // The daily quota replaced the batch's target quota.
    await expect(page.getByLabel("Target quota")).toHaveCount(0);

    await createBatch(page, unique());
    await expect(page.getByText("Planned", { exact: true })).toBeVisible();
    await expect(page.getByText("This roll hasn’t started.")).toBeVisible();

    await page.getByRole("button", { name: "Start roll" }).click();
    await expect(page.getByText("At Preparation", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Move to|Move back/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Finish roll…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Do this when the roll is used up.");
    await expect(dialog).toContainText("(10 expected)");
    await dialog.getByRole("button", { name: "Finish roll", exact: true }).click();

    await expect(page.getByText("Finished", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(historyRows(page)).toHaveCount(1);
    await expect(historyRows(page).first()).toContainText("Preparation");
    await expect(page.getByRole("button", { name: /Finish roll|Cancel roll/ })).toHaveCount(0);
  });

  test("cancelling asks for a reason and ends the roll", async ({ page }) => {
    await createBatch(page, unique());
    await page.getByRole("button", { name: "Cancel roll…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel roll", exact: true }).click();
    await expect(
      dialog.getByText("Enter a reason for cancelling the roll (at least 3 characters)."),
    ).toBeVisible();
    await dialog.getByLabel("Reason").fill("Roll returned to supplier");
    await dialog.getByRole("button", { name: "Cancel roll", exact: true }).click();
    await expect(page.getByText("Cancelled: Roll returned to supplier")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start roll" })).toHaveCount(0);
  });

  test("the form explains missing fields and keeps the shoe type locked after start", async ({
    page,
  }) => {
    await page.goto("/batches/new");
    await page.getByRole("button", { name: "Create batch" }).click();
    await expect(page.getByText("Enter the roll code from the leather roll's tag.")).toBeVisible();
    await expect(page.getByText("Choose a shoe type from the list.")).toBeVisible();
    await expect(page.getByLabel("Roll code")).toBeFocused();

    const url = await createBatch(page, unique());
    await page.getByRole("button", { name: "Start roll" }).click();
    await expect(page.getByRole("button", { name: "Finish roll…" })).toBeVisible();
    await page.goto(`${url}/edit`);
    await expect(page.getByLabel("Shoe type")).toBeDisabled();
    await expect(page.getByText("The shoe type is fixed once the roll has started.")).toBeVisible();
  });

  test("search narrows the list and survives a reload; the filter is by status", async ({
    page,
  }) => {
    const roll = unique();
    await createBatch(page, roll, { shoe: "Topsider" });
    await page.goto("/batches");
    await expect(page.getByLabel("Stage")).toHaveCount(0);
    await expect(page.getByLabel("Status").locator("option")).toHaveText([
      "All statuses",
      "Planned",
      "At Preparation",
      "Finished",
      "Cancelled",
    ]);
    await page.getByLabel("Search").fill(roll);
    await expect(page).toHaveURL(new RegExp(`q=${roll}`));
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
    await page.reload();
    await expect(page.getByLabel("Search")).toHaveValue(roll);
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);

    await page.goto(`/batches?q=${roll}-NOPE`);
    await expect(page.getByText("No batches match these filters")).toBeVisible();
  });

  test("the old stage moves are refused, and a stale finish is 409 STALE", async ({ page }) => {
    const url = await createBatch(page, unique());
    const id = url.split("/").pop();
    await page.getByRole("button", { name: "Start roll" }).click();
    await expect(page.getByText("At Preparation", { exact: true })).toBeVisible();

    const advance = await page.request.post(`/api/v1/batches/${id}/stages`, {
      data: { action: "advance", expectedStage: "PREPARATION" },
    });
    expect(advance.status()).toBe(422);
    expect(JSON.stringify(await advance.json())).toContain(
      "Choose start or finish. A roll no longer moves through stages.",
    );

    const stale = await page.request.post(`/api/v1/batches/${id}/stages`, {
      data: { action: "finish", expectedStage: "SOLEING" },
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe("STALE");

    const finished = await page.request.post(`/api/v1/batches/${id}/stages`, {
      data: { action: "finish", expectedStage: "PREPARATION" },
    });
    expect(finished.status()).toBe(200);
    const again = await page.request.post(`/api/v1/batches/${id}/stages`, {
      data: { action: "finish", expectedStage: "PREPARATION" },
    });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.message).toBe("This roll is already finished.");
  });
});

test.describe("Quality Inspector", () => {
  test("can finish a roll but not start, edit or cancel one", async ({ page, browser }) => {
    const fm = await browser.newPage();
    await signInAs(fm, ACCOUNTS.manager);
    const url = await createBatch(fm, unique());
    await fm.getByRole("button", { name: "Start roll" }).click();
    await expect(fm.getByText("At Preparation", { exact: true })).toBeVisible();
    await fm.close();

    await signInAs(page, ACCOUNTS.inspector);
    await page.goto(url);
    await expect(page.getByRole("button", { name: /Cancel roll|Start roll/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await page.getByRole("button", { name: "Finish roll…" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Finish roll", exact: true })
      .click();
    await expect(page.getByText("Finished", { exact: true })).toBeVisible();

    const id = url.split("/").pop();
    const start = await page.request.post(`/api/v1/batches/${id}/stages`, {
      data: { action: "start", expectedStage: "PREPARATION" },
    });
    expect(start.status()).toBe(403);
  });

  test("can view batches but not create them", async ({ page, browser }) => {
    const fm = await browser.newPage();
    await signInAs(fm, ACCOUNTS.manager);
    const url = await createBatch(fm, unique());
    await fm.close();

    await signInAs(page, ACCOUNTS.inspector);
    await page.goto("/batches");
    await expect(page.getByRole("heading", { name: "Batches" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New batch" })).toHaveCount(0);

    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A planned roll: the QI can't start it (batch:manage) and has nothing to finish yet.
    await expect(
      page.getByRole("button", { name: /Start roll|Cancel roll|Finish roll/ }),
    ).toHaveCount(0);

    await page.goto("/batches/new");
    await expect(page).toHaveURL("/forbidden");

    const res = await page.request.post("/api/v1/batches", {
      data: {
        rollCode: "X",
        shoeTypeId: "0199a000-0000-7000-8000-000000000001",
        receivedAt: "2026-01-01",
      },
    });
    expect(res.status()).toBe(403);
    expect((await page.request.get("/api/v1/batches")).status()).toBe(200);
  });
});

test("the API refuses anonymous callers with 401", async ({ request }) => {
  const res = await request.get("/api/v1/batches");
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
});
