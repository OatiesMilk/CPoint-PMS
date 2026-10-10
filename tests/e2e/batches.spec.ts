import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

const unique = () =>
  `E2E-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

async function createBatch(
  page: Page,
  rollCode: string,
  options: { quota?: string; shoe?: string } = {},
) {
  await page.goto("/batches/new");
  await page.getByLabel("Roll code").fill(rollCode);
  await page.getByLabel("Shoe type").selectOption({ label: options.shoe ?? "School Shoe" });
  if (options.quota) await page.getByLabel("Target quota").fill(options.quota);
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^B-\d{4}-\d{4,}$/);
  return page.url();
}

const timelineRows = (page: Page) => page.getByRole("table").locator("tbody tr");

test.describe("Floor Manager", () => {
  test.beforeEach(async ({ page }) => signInAs(page, ACCOUNTS.manager));

  test("runs a batch through all four stages to completion", async ({ page }) => {
    await createBatch(page, unique(), { quota: "480" });
    await expect(page.getByText("Planned", { exact: true })).toBeVisible();
    await expect(page.getByText("Production hasn’t started.")).toBeVisible();

    await page.getByRole("button", { name: "Start production" }).click();
    for (const next of ["Upper Making", "Sole-ing", "Finishing"]) {
      await page.getByRole("button", { name: `Move to ${next}` }).click();
      await expect(page.locator("[aria-current=step]")).toContainText(next);
    }
    await page.getByRole("button", { name: "Complete batch" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("can’t be moved back afterwards");
    await dialog.getByRole("button", { name: "Complete batch" }).click();

    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(timelineRows(page)).toHaveCount(4);
    await expect(page.getByRole("button", { name: /Move|Cancel batch/ })).toHaveCount(0);
  });

  test("moving back needs a reason, which then shows in the timeline", async ({ page }) => {
    await createBatch(page, unique());
    await page.getByRole("button", { name: "Start production" }).click();
    await page.getByRole("button", { name: "Move to Upper Making" }).click();
    await page.getByRole("button", { name: "Move back…" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Move back", exact: true }).click();
    await expect(
      dialog.getByText("Enter a reason for moving the batch back (at least 3 characters)."),
    ).toBeVisible();

    await dialog.getByLabel("Reason").fill("Wrong cutting guide used");
    await dialog.getByRole("button", { name: "Move back", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(timelineRows(page)).toHaveCount(3);
    await expect(timelineRows(page).last()).toContainText("Moved back: Wrong cutting guide used");
    await expect(page.locator("[aria-current=step]")).toContainText("Preparation");
  });

  test("cancelling asks for a reason and ends the batch", async ({ page }) => {
    await createBatch(page, unique());
    await page.getByRole("button", { name: "Cancel batch…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("Roll returned to supplier");
    await dialog.getByRole("button", { name: "Cancel batch" }).click();
    await expect(page.getByText("Cancelled: Roll returned to supplier")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start production" })).toHaveCount(0);
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
    await page.getByRole("button", { name: "Start production" }).click();
    await expect(page.getByRole("button", { name: "Move to Upper Making" })).toBeVisible();
    await page.goto(`${url}/edit`);
    await expect(page.getByLabel("Shoe type")).toBeDisabled();
    await expect(page.getByText("The shoe type is fixed once production starts.")).toBeVisible();
  });

  test("search narrows the list and survives a reload", async ({ page }) => {
    const roll = unique();
    await createBatch(page, roll, { shoe: "Topsider" });
    await page.goto("/batches");
    await page.getByLabel("Search").fill(roll);
    await expect(page).toHaveURL(new RegExp(`q=${roll}`));
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
    await page.reload();
    await expect(page.getByLabel("Search")).toHaveValue(roll);
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);

    await page.goto(`/batches?q=${roll}-NOPE`);
    await expect(page.getByText("No batches match these filters")).toBeVisible();
  });

  test("a stale stage is refused with 409 STALE", async ({ page }) => {
    const url = await createBatch(page, unique());
    const id = url.split("/").pop();
    await page.getByRole("button", { name: "Start production" }).click();
    await page.getByRole("button", { name: "Move to Upper Making" }).click();
    await expect(page.locator("[aria-current=step]")).toContainText("Upper Making");

    const res = await page.request.post(`/api/v1/batches/${id}/stages`, {
      data: { action: "advance", expectedStage: "PREPARATION" },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe("STALE");
  });
});

test.describe("Quality Inspector", () => {
  test("can view batches but not change them", async ({ page, browser }) => {
    // Create a batch as the Floor Manager in a separate session.
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
    await expect(page.getByRole("button", { name: /Start production|Cancel batch/ })).toHaveCount(
      0,
    );

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
