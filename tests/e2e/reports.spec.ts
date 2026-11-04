import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  captureApi,
  createRoll,
  createDeviceToken,
  e2eKey,
  ensureRuleTypes,
  finishRoll,
  managerApi,
  sampleJpeg,
  withDb,
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

/**
 * A roll finished at Capture, then moved onto `day` (a 2025 day no other spec uses) and marked
 * over the limit or not, so the report's numbers for that day are this test's own (D-117).
 */
async function finishedRollOn(
  sc: APIRequestContext,
  request: APIRequestContext,
  token: string,
  shots: [classKey: string, confidence: number][],
  returned: boolean,
) {
  const roll = await createRoll(sc);
  for (const [key, confidence] of shots) await scanOn(request, token, roll.id, key, confidence);
  await finishRoll(sc, roll.id);
  await withDb((db) =>
    db.query(
      `UPDATE batches SET "finishedAt" = $2::timestamptz AT TIME ZONE 'UTC',
         "markedForReturn" = $3, "returnDecision" = NULL WHERE id = $1`,
      [roll.id, `${day}T15:00:00+08:00`, returned],
    ),
  );
  return roll;
}

test("the quality report counts whole rolls on a day exactly, and its CSV matches (D-117)", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const report = async () =>
    (await (await api.get(`/api/v1/reports/quality?from=${day}&to=${day}`)).json()).data;
  const before = await report();

  const sc = await captureApi(browser);
  const { token } = await createDeviceToken();
  // One roll returned to supplier with a long cut on it; one passed, with an abrasion and a cut
  // below found-at that doesn't count.
  await finishedRollOn(
    sc,
    request,
    token,
    [
      ["cut", 0.95],
      ["cut", 0.97],
    ],
    true,
  );
  await finishedRollOn(
    sc,
    request,
    token,
    [
      ["abrasion", 0.7],
      ["cut", 0.3],
    ],
    false,
  );

  const after = await report();
  const delta = (k: string) => after.totals[k] - before.totals[k];
  expect({ rolls: delta("rolls"), passed: delta("passed"), returned: delta("returned") }).toEqual({
    rolls: 2,
    passed: 1,
    returned: 1,
  });
  const defect = (r: typeof after, key: string) =>
    r.defects.find((d: { key: string }) => d.key === e2eKey(key)) ?? { rolls: 0, returned: 0 };
  // Two cuts on one roll count once.
  expect(defect(after, "cut").rolls - defect(before, "cut").rolls).toBe(1);
  expect(defect(after, "cut").returned - defect(before, "cut").returned).toBe(1);
  expect(defect(after, "abrasion").rolls - defect(before, "abrasion").rolls).toBe(1);

  // The page shows the same numbers for that day, and no sections.
  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/reports?view=quality&from=${day}&to=${day}`);
  await expect(page.getByTestId("total-rolls")).toHaveText(String(after.totals.rolls));
  const returnedTile = page
    .locator("[data-slot='card']")
    .filter({ has: page.getByTestId("total-returned") });
  await expect(returnedTile).toContainText(
    `${after.totals.returned} ${after.totals.returned === 1 ? "roll" : "rolls"}`,
  );
  await expect(page.getByRole("heading", { name: "Rolls scanned per day" })).toBeVisible();
  await expect(page.getByText(/sections/i)).toHaveCount(0);
  await expect(page.getByTestId("daily-table").getByRole("row", { name: day })).toContainText(
    String(after.totals.returned),
  );

  // The CSV: BOM, header, one row for the day, as a download.
  const csv = await api.get(`/api/v1/reports/daily.csv?from=${day}&to=${day}`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toContain(`cpoint-daily-${day}_${day}.csv`);
  const body = (await csv.body()).toString("utf8");
  expect(body.charCodeAt(0)).toBe(0xfeff);
  const lines = body.slice(1).trim().split("\r\n");
  expect(lines[0]).toBe("Date (Manila),Rolls scanned,Scanning passed,Returned to supplier");
  expect(lines[1]).toBe(
    `${day},${after.totals.rolls},${after.totals.passed},${after.totals.returned}`,
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
  // Removed (D-117): the Rejected sections card and the Rolls finished and Rolls open tiles.
  await expect(page.getByTestId("for-salvage")).toHaveCount(0);
  // The card's title only: the claim sheet's help text still mentions the rejected sections.
  await expect(page.getByText("Rejected sections", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("stock-risk")).toBeVisible();
  await expect(page.getByTestId("supplier-quality")).toBeVisible();
  for (const kpi of ["kpi-pairs", "kpi-failed", "kpi-quota", "kpi-rolls-passed", "kpi-returned"])
    await expect(page.getByTestId(kpi)).toBeVisible();
  for (const kpi of ["kpi-rolls", "kpi-rolls-open", "kpi-reject"])
    await expect(page.getByTestId(kpi)).toHaveCount(0);
  const tile = (id: string) =>
    page.locator("[data-slot='card']").filter({ has: page.getByTestId(id) });
  await expect(tile("kpi-pairs")).toContainText(
    "all pairs the QI counted at Finish batch, failed ones included",
  );
  await expect(tile("kpi-returned")).toContainText(/\d+ of \d+ rolls? scanned/);
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
  expect(ops).toContain(
    "Date (Manila),Rolls started,Rolls scanned,Scanning passed,Returned to supplier",
  );
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
  await expect(fm.getByTestId("rolls-today")).toContainText("Rolls scanned");
  await expect(fm.getByTestId("rolls-today")).toContainText("Returned to supplier");
  await expect(fm.getByTestId("rolls-today")).not.toContainText("Sections");
  await expect(fm.getByText("Daily summary")).toBeVisible();
  await expect(fm.getByText("Latest scans")).toHaveCount(0);
  await fm.goto("/reports?view=quality");
  await expect(fm.getByTestId("total-rolls")).toBeVisible();
  expect((await fm.request.get("/api/v1/reports/quality")).status()).toBe(200);
  await fm.close();
});
