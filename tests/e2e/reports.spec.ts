import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  captureApi,
  createRoll,
  createDeviceToken,
  e2eKey,
  ensureRuleTypes,
  managerApi,
  sampleJpeg,
} from "./cv-helpers";

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

/**
 * Scans are posted with a capturedAt on a random day in 2025, so no other spec (they all scan
 * "now") touches that day. Earlier runs of this test may have, so the checks compare deltas.
 */
const day = `2025-${String(randomInt(1, 13)).padStart(2, "0")}-${String(randomInt(1, 29)).padStart(2, "0")}`;

async function scanOn(
  request: APIRequestContext,
  token: string,
  rollId: string,
  classKey: string,
  confidence: number,
) {
  await ensureRuleTypes();
  const res = await request.post("/api/v1/scans", {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
      detections: JSON.stringify([
        {
          classKey: e2eKey(classKey),
          confidence,
          box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        },
      ]),
      rollId,
      source: "SIMULATOR",
      capturedAt: `${day}T10:00:00+08:00`,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data as { scanId: string; verdict: string };
}

test("the quality report counts a day exactly, and its CSV matches", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const report = async () =>
    (await (await api.get(`/api/v1/reports/quality?from=${day}&to=${day}`)).json()).data;
  const before = await report();

  const roll = await createRoll(await captureApi(browser));
  const { token } = await createDeviceToken();
  await scanOn(request, token, roll.id, "cut", 0.3); // below found-at: PASS
  await scanOn(request, token, roll.id, "abrasion", 0.7); // Usable: PASS
  await scanOn(request, token, roll.id, "cut", 0.95); // Not accepted: REJECT
  const noType = await scanOn(request, token, roll.id, "e2e-report-class", 0.9);
  expect(noType.verdict).toBe("PASS"); // a class with no defect type is dropped (D-108)

  const after = await report();
  const delta = (k: string) => after.totals[k] - before.totals[k];
  expect({ scanned: delta("scanned"), pass: delta("pass"), reject: delta("reject") }).toEqual({
    scanned: 4,
    pass: 3,
    reject: 1,
  });
  expect(after).not.toHaveProperty("matrix");
  const defects = (r: typeof after, key: string) =>
    r.defects.find((d: { key: string }) => d.key === e2eKey(key))?.scans ?? 0;
  expect(defects(after, "cut") - defects(before, "cut")).toBe(2);
  expect(defects(after, "abrasion") - defects(before, "abrasion")).toBe(1);

  // The page shows the same numbers for that day.
  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/reports?view=quality&from=${day}&to=${day}`);
  await expect(page.getByTestId("total-scanned")).toHaveText(String(after.totals.scanned));
  // The tile's title is the share; the line under it is the count.
  const rejectTile = page
    .locator("[data-slot='card']")
    .filter({ has: page.getByTestId("total-reject") });
  await expect(rejectTile).toContainText(`${after.totals.reject} sections`);
  await expect(page.getByTestId("daily-table").getByRole("row", { name: day })).toContainText(
    String(after.totals.reject),
  );

  // The CSV: BOM, header, one row for the day, as a download.
  const csv = await api.get(`/api/v1/reports/daily.csv?from=${day}&to=${day}`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toContain(`cpoint-daily-${day}_${day}.csv`);
  const body = (await csv.body()).toString("utf8");
  expect(body.charCodeAt(0)).toBe(0xfeff);
  const lines = body.slice(1).trim().split("\r\n");
  expect(lines[0]).toBe("Date (Manila),Scanned,Pass,Reject (for salvage)");
  expect(lines[1]).toBe(
    `${day},${after.totals.scanned},${after.totals.pass},${after.totals.reject}`,
  );
});

test("the Floor Manager sees production against the quota in place of stage times (Phase 23)", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/reports?preset=7d");
  // The Floor Manager lands on Operations: production against the quota, and what's wrong.
  await expect(page.getByRole("link", { name: "Operations", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTestId("production-section")).toContainText("Production");
  await expect(
    page
      .getByTestId("ops-production-table")
      .or(page.getByText(/^No working days with batches yet\./)),
  ).toBeVisible();
  await expect(page.getByText("Time in each stage")).toHaveCount(0);
  await expect(page.getByText("On the floor now")).toHaveCount(0);
  await expect(page.getByTestId("flow-lanes")).toHaveCount(0);
  await expect(page.getByTestId("attention")).toContainText("What needs attention");
  await expect(page.getByTestId("repair-station")).toHaveCount(0);
  await expect(page.getByTestId("for-salvage")).toContainText("For salvage");
  await expect(page.getByTestId("stock-risk")).toBeVisible();
  await expect(page.getByTestId("supplier-quality")).toBeVisible();
  for (const kpi of ["kpi-pairs", "kpi-quota", "kpi-rolls", "kpi-rolls-open", "kpi-reject"])
    await expect(page.getByTestId(kpi)).toBeVisible();
  await expect(page.getByTestId("kpi-wip")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Stages CSV" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Production CSV" })).toBeVisible();
  for (const path of ["operations", "production"])
    expect((await page.request.get(`/api/v1/reports/${path}?preset=today`)).status()).toBe(200);
  // The repairs report left with the Repair Station (D-094).
  expect((await page.request.get("/api/v1/reports/repairs?preset=today")).status()).toBe(404);
  for (const csv of ["operations", "stock", "suppliers", "supplier-rolls", "production"])
    expect((await page.request.get(`/api/v1/reports/${csv}.csv?preset=today`)).status()).toBe(200);
  // stages.csv is gone with stage monitoring.
  expect((await page.request.get("/api/v1/reports/stages.csv?preset=today")).status()).toBe(404);
  const csv = await (await page.request.get("/api/v1/reports/production.csv?preset=7d")).text();
  expect(csv).toContain(
    "Date (Manila),Pairs finished,Failed inspection,% failed,Pairs passed,Daily quota,% of quota (passed)",
  );
  expect(csv).not.toContain("Shoe type");
  const ops = await (await page.request.get("/api/v1/reports/operations.csv?preset=today")).text();
  expect(ops).toContain("Rolls started,Rolls finished");
  // The purchasing card and the stock CSV's request column left with the module (D-091).
  await expect(page.getByRole("heading", { name: "Purchasing" })).toHaveCount(0);
  const stock = await (await page.request.get("/api/v1/reports/stock.csv?preset=today")).text();
  expect(stock).toContain("Days of cover,Status");
  expect(stock).not.toContain("Open request");

  // Range presets live in the URL.
  await page.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL("/reports?view=operations&preset=7d");
  await expect(page.getByTestId("report-range")).toContainText("7 days");
});

test("Reports are the Floor Manager's alone, and the FM home shows Rolls today (D-100)", async ({
  browser,
  page,
}) => {
  await signInAs(page, ACCOUNTS.inspector);
  await page.goto("/reports");
  await expect(page).toHaveURL("/forbidden");
  for (const path of [
    "/api/v1/reports/quality",
    "/api/v1/reports/operations",
    "/api/v1/reports/production.csv",
  ])
    expect((await page.request.get(path)).status(), path).toBe(403);

  const fm = await browser.newPage();
  await signInAs(fm, ACCOUNTS.manager);
  await expect(fm.getByTestId("rolls-today")).toContainText("Rolls today");
  await expect(fm.getByTestId("rolls-today-open")).toBeVisible();
  await expect(fm.getByText("Daily summary")).toBeVisible();
  await expect(fm.getByText("Latest scans")).toHaveCount(0);
  await fm.goto("/reports?view=quality");
  await expect(fm.getByTestId("total-scanned")).toBeVisible();
  expect((await fm.request.get("/api/v1/reports/quality")).status()).toBe(200);
  await fm.close();
});
