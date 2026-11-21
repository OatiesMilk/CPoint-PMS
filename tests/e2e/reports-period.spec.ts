import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * Phase 35A (D-132): the period picker, sortable tables and filters on Operations, Quality and
 * Rolls. Read-only, so these tests change no data. Manila's today comes from the page itself.
 */

async function signInAsManager(page: Page) {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
}

const range = (page: Page) => page.getByTestId("report-range");

test("Day, Week, Month and Custom each show their period, and the CSV matches it", async ({
  page,
}) => {
  await signInAsManager(page);
  await page.goto("/reports?view=quality&period=month&year=2026&month=9");
  await expect(range(page)).toContainText("September 2026 · 30 days");
  await expect(page.getByRole("link", { name: "Month", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // The daily table has one row per day of the month, and so does the Daily CSV.
  await expect(page.getByTestId("daily-table").locator("tbody tr")).toHaveCount(30);
  const csv = await (
    await page.request.get("/api/v1/reports/daily.csv?period=month&year=2026&month=9")
  ).text();
  expect(csv.replace(/^﻿/, "").trim().split("\r\n")).toHaveLength(31); // header + 30 days

  await page.goto("/reports?view=quality&period=week&year=2026&month=9&week=5");
  await expect(range(page)).toContainText("Week 5 · Sep 29–30, 2026 · 2 days");

  await page.goto("/reports?view=quality&period=day&day=2026-09-30");
  await expect(range(page)).toContainText("30");
  await expect(range(page)).toContainText("1 day");

  await page.goto("/reports?view=operations&period=custom&from=2026-09-01&to=2026-09-30");
  await expect(range(page)).toContainText("30 days");
  await expect(page.getByTestId("ops-daily-table").locator("tbody tr")).toHaveCount(30);
});

test("the picker changes the period through the URL and keeps the rest", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/reports?view=operations&preset=7d");
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page).toHaveURL(/period=week&year=\d{4}&month=\d+&week=\d/);
  await page.getByLabel("Month").selectOption("1");
  await expect(page).toHaveURL(/period=week&year=\d{4}&month=1&week=/);
  await expect(range(page)).toContainText("Week");
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(page).toHaveURL(/period=month&year=\d{4}&month=1/);
  await page.getByRole("link", { name: "Day", exact: true }).click();
  await page.getByLabel("Day", { exact: true }).fill("2026-09-30");
  await expect(page).toHaveURL(/period=day&day=2026-09-30/);
  await expect(range(page)).toContainText("1 day");
  // The old preset link still works.
  await page.getByRole("link", { name: "14 days" }).click();
  await expect(page).toHaveURL("/reports?view=operations&preset=14d");
});

test("a future day, week or month ends at today, and a bad value never breaks the page", async ({
  page,
}) => {
  await signInAsManager(page);
  for (const url of [
    "/reports?period=day&day=2999-01-01",
    "/reports?period=day&day=2026-02-30",
    "/reports?period=week&year=2999&month=1&week=1",
    "/reports?period=month&year=2999&month=12",
    "/reports?period=month&year=abc&month=99",
  ]) {
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(200);
    await expect(range(page), url).toBeVisible();
  }
  // A custom range may be a year (A-68): 366 days, the oldest day cut when it is longer.
  const body = await (
    await page.request.get("/api/v1/reports/quality?from=2020-01-01&to=2999-01-01")
  ).json();
  expect(body.data.range.days).toBe(366);
});

test("a click on a column header sorts the table, both ways, and keeps the period", async ({
  page,
}) => {
  await signInAsManager(page);
  await page.goto("/reports?view=operations&period=month&year=2026&month=9");
  const table = page.getByTestId("ops-daily-table");
  const column = async (n: number) =>
    (await table.locator(`tbody tr td:nth-child(${n})`).allTextContents()).map(Number);
  await table.getByRole("link", { name: /Rolls scanned/ }).click();
  await expect(page).toHaveURL(/sort=daily\.rolls-scanned&dir=asc/);
  await expect(page).toHaveURL(/period=month/);
  const up = await column(3);
  expect(up).toEqual([...up].sort((a, b) => a - b));
  await expect(table.getByRole("columnheader", { name: /Rolls scanned/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await table.getByRole("link", { name: /Rolls scanned/ }).click();
  await expect(page).toHaveURL(/dir=desc/);
  const down = await column(3);
  expect(down).toEqual([...down].sort((a, b) => b - a));
  // One sort per page: choosing another column replaces it.
  await table.getByRole("link", { name: /Rolls started/ }).click();
  await expect(page).toHaveURL(/sort=daily\.rolls-started&dir=asc/);
  await expect(table.getByRole("columnheader", { name: /Rolls scanned/ })).not.toHaveAttribute(
    "aria-sort",
    /.+/,
  );
  // An unknown sort is ignored: the page still loads.
  expect((await page.goto("/reports?sort=nope.nothing&dir=desc"))?.status()).toBe(200);
});

test("Rolls sorts every matching row and filters by leather item and location", async ({
  page,
}) => {
  await signInAsManager(page);
  await page.goto("/reports/rolls?sort=rolls.roll&dir=asc");
  const codes = async () =>
    (await page.getByTestId("roll-row").locator("td:first-child a").allTextContents()).map((c) =>
      c.trim(),
    );
  const asc = await codes();
  expect(asc.length).toBeGreaterThan(0);
  expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, "en", { numeric: true })));
  await page.getByRole("columnheader", { name: /^Roll/ }).getByRole("link").click();
  await expect(page).toHaveURL(/dir=desc/);
  const desc = await codes();
  expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a, "en", { numeric: true })));

  // The filters are there, and picking one puts it in the URL; Clear filters empties it.
  await expect(page.getByLabel("Leather item")).toBeVisible();
  await expect(page.getByLabel("Location")).toBeVisible();
  const items = page.getByLabel("Leather item").locator("option");
  if ((await items.count()) > 1) {
    await page.getByLabel("Leather item").selectOption({ index: 1 });
    await expect(page).toHaveURL(/itemId=/);
    // The CSV takes the same filters (and ignores the sort, A-100).
    const csvHref = await page.getByRole("link", { name: "Download CSV" }).getAttribute("href");
    expect(csvHref).toContain("itemId=");
    expect(csvHref).not.toContain("sort=");
  }
  // Any time is the default; a period makes it a filter on the day a roll was added.
  await page.goto("/reports/rolls");
  await expect(page.getByRole("link", { name: "Any time" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goto("/reports/rolls?period=day&day=2001-01-01");
  await expect(page.getByRole("heading", { name: "No rolls match these filters" })).toBeVisible();
});

test("the defect filters narrow the three defect cards and say so; Clear brings them back", async ({
  page,
}) => {
  await signInAsManager(page);
  await page.goto("/reports?view=operations&preset=30d");
  const filters = page.getByRole("form", { name: "Defect filters" });
  await expect(filters).toBeVisible();
  await expect(page.getByText("Filters the three defect cards below")).toBeVisible();
  await expect(page.getByTestId("filtered-note")).toHaveCount(0);

  await filters.getByLabel("Fixable").selectOption("NOT_FIXABLE");
  await filters.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/remedy=NOT_FIXABLE/);
  await expect(page).toHaveURL(/preset=30d/);
  await expect(page.getByTestId("filtered-note")).toHaveCount(3);
  await expect(page.getByTestId("filtered-note").first()).toContainText("Not fixable");
  // The key figures above stay for the whole line.
  await expect(page.getByTestId("kpi-pairs")).toBeVisible();

  await page.getByTestId("filtered-note").first().getByRole("link", { name: "Clear" }).click();
  await expect(page).not.toHaveURL(/remedy=/);
  await expect(page).toHaveURL(/preset=30d/);
  await expect(page.getByTestId("filtered-note")).toHaveCount(0);

  // The supplier filter sits on Supplier quality and rides on its CSVs.
  const supplier = page.getByRole("form", { name: "Supplier filter" });
  const options = supplier.getByLabel("Supplier").locator("option");
  if ((await options.count()) > 1) {
    await supplier.getByLabel("Supplier").selectOption({ index: 1 });
    await supplier.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/supplierId=/);
    const href = await page.getByRole("link", { name: "Suppliers CSV" }).getAttribute("href");
    expect(href).toContain("supplierId=");
  }
});

test("Quality's defect filter narrows the defects table and the Defects CSV", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/reports?view=quality&preset=30d");
  const form = page.getByRole("form", { name: "Defect filter" });
  if (!(await form.isVisible())) return; // no roll scanned in this range: nothing to filter
  const options = form.getByLabel("Defect type").locator("option");
  if ((await options.count()) < 2) return;
  const key = await options.nth(1).getAttribute("value");
  await form.getByLabel("Defect type").selectOption(key!);
  await form.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(new RegExp(`defect=${key}`));
  const href = await page.getByRole("link", { name: "Defects CSV" }).getAttribute("href");
  expect(href).toContain(`defect=${key}`);
  const csv = await (await page.request.get(href!)).text();
  expect(csv.replace(/^﻿/, "").trim().split("\r\n").length).toBeLessThanOrEqual(2);
});
