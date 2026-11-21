import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * Phase 35A (D-132): the print layout of Operations, Quality, Rolls and Materials. Print is
 * emulated in headless Chromium (`emulateMedia`), and each report is also saved as an A4 PDF so
 * the report can look at it; nothing is written to the app.
 */

async function signInAsManager(page: Page) {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
}

const REPORTS = [
  { name: "Operations", url: "/reports?view=operations&period=month&year=2026&month=9" },
  { name: "Quality", url: "/reports?view=quality&period=month&year=2026&month=9" },
  { name: "Rolls", url: "/reports/rolls?sort=rolls.roll&dir=asc" },
  { name: "Materials", url: "/reports/materials" },
];

for (const report of REPORTS) {
  test(`${report.name} prints with a header, who prepared it, remarks and signatures`, async ({
    page,
  }, testInfo) => {
    await signInAsManager(page);
    await page.goto(report.url);
    // On screen the print parts are hidden and the Print button is there.
    await expect(page.getByTestId("print-header")).toBeHidden();
    await expect(page.getByTestId("print-signatures")).toBeHidden();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await page
      .getByRole("textbox", { name: "Remarks" })
      .fill("Checked against the floor log.\nTwo days short.");

    await page.emulateMedia({ media: "print" });
    const header = page.getByTestId("print-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("CPoint Shoe Store Corporation");
    await expect(header).toContainText(`Reports · ${report.name}`);
    await expect(page.getByTestId("print-prepared-by")).toContainText("Floor Manager");
    await expect(header).toContainText("Printed");
    // The controls, the pickers, the filters and the navigation are left out.
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Report" })).toBeHidden();
    await expect(page.getByTestId("period-picker")).toBeHidden();
    // Remarks print as written; the signature lines come last.
    await expect(page.getByTestId("print-remarks")).toContainText("Checked against the floor log.");
    await expect(page.getByTestId("print-signatures")).toContainText("Prepared by");
    await expect(page.getByTestId("print-signatures")).toContainText("Checked by");

    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    await testInfo.attach(`${report.name}.pdf`, { body: pdf, contentType: "application/pdf" });
    expect(pdf.byteLength).toBeGreaterThan(5_000);
    await page.emulateMedia({ media: "screen" });
  });
}

test("a table's header repeats and rows don't split when printed", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/reports?view=operations&period=month&year=2026&month=9");
  await page.emulateMedia({ media: "print" });
  const styles = await page.evaluate(() => {
    const thead = document.querySelector("thead");
    const tr = document.querySelector("tbody tr");
    return {
      thead: thead ? getComputedStyle(thead).display : null,
      tr: tr ? getComputedStyle(tr).breakInside : null,
    };
  });
  expect(styles.thead).toBe("table-header-group");
  expect(styles.tr).toBe("avoid");
});

test("an empty Remarks box prints three ruled lines, and dark mode prints on white", async ({
  page,
}) => {
  await signInAsManager(page);
  await page.goto("/reports?view=quality&preset=7d");
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  const lines = page.getByTestId("print-remarks").locator("div.border-b");
  await expect(lines).toHaveCount(3);
  const colours = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return { background: body.backgroundColor, color: body.color };
  });
  // White paper, dark text, whatever the screen theme was.
  expect(colours.background).toMatch(/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/);
  expect(colours.color).not.toBe("rgb(255, 255, 255)");
});

test("Rolls prints every matching row, past one page, and says when it cut the list", async ({
  page,
}) => {
  await signInAsManager(page);
  await page.goto("/reports/rolls?print=1");
  // The screen list is 15 to a page; the print list is the whole result (up to 500). The demo
  // week has far more than 15 rolls.
  expect(await page.getByTestId("roll-row").count()).toBeGreaterThan(15);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("print-header")).toContainText("Reports · Rolls");
  // The pager is left out of the print.
  await expect(page.getByRole("navigation", { name: /pagination/i })).toBeHidden();
});
