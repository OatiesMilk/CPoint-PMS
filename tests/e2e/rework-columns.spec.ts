import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

/** The Repair Station board's columns fold away, remember it per browser, and never leave a gap. */
test("Board columns collapse, persist, and the next column moves up when stacked", async ({
  page,
}) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.inspector.email);
  await expect(page).toHaveURL(ACCOUNTS.inspector.home);

  // Stacked layout (narrow window).
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/rework");
  await page.evaluate(() => window.localStorage.removeItem("cpoint:rework:collapsed"));
  await page.reload();

  const waiting = page.getByRole("button", { name: /^To handle, \d+ sections?$/ });
  const repairing = page.getByRole("region", { name: "Being handled" });
  await expect(waiting).toHaveAttribute("aria-expanded", "true");
  const bodyId = (await waiting.getAttribute("aria-controls"))!;
  await expect(page.locator(`[id="${bodyId}"]`)).toBeVisible();

  await waiting.click();
  await expect(waiting).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(`[id="${bodyId}"]`)).toBeHidden();
  // The count stays readable in the header.
  await expect(page.getByRole("region", { name: "To handle" })).toContainText(/\(\d+\)/);

  // No gap: the next column starts about 1rem under the folded one.
  const folded = (await page.getByRole("region", { name: "To handle" }).boundingBox())!;
  const next = (await repairing.boundingBox())!;
  expect(next.y - (folded.y + folded.height)).toBeLessThan(20);

  // The choice survives a reload, and can be undone.
  await page.reload();
  await expect(waiting).toHaveAttribute("aria-expanded", "false");
  await waiting.click();
  await expect(waiting).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`[id="${bodyId}"]`)).toBeVisible();

  // Side by side on a wide window: the folded column keeps only its header height.
  await page.setViewportSize({ width: 1440, height: 900 });
  await waiting.click();
  const wide = (await page.getByRole("region", { name: "To handle" }).boundingBox())!;
  const other = (await repairing.boundingBox())!;
  expect(other.x).toBeGreaterThan(wide.x + wide.width);
  expect(wide.height).toBeLessThan(80);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);

  await page.evaluate(() => window.localStorage.removeItem("cpoint:rework:collapsed"));
});
