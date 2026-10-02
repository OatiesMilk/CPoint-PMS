import { expect, test } from "@playwright/test";

test("health endpoint reports app and database up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.checks).toEqual({ app: "up", database: "up" });
});

test("home page shows live status and the production line", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("System foundation is running");
  for (const stage of ["Preparation", "Upper Making", "Sole-ing", "Finishing"]) {
    await expect(page.getByText(stage, { exact: true })).toBeVisible();
  }
});

test("theme toggle switches and persists across reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
