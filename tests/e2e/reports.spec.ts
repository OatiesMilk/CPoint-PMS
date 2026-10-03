import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { createBatch, createDeviceToken, managerApi, sampleJpeg } from "./cv-helpers";

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
  batchId: string,
  classKey: string,
  confidence: number,
) {
  const res = await request.post("/api/v1/scans", {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
      detections: JSON.stringify([
        { classKey, confidence, box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
      ]),
      batchId,
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

  const batch = await createBatch(api);
  const { token } = await createDeviceToken();
  await scanOn(request, token, batch.id, "cut", 0.3); // PASS
  await scanOn(request, token, batch.id, "hole", 0.7); // REWORK
  const reject = await scanOn(request, token, batch.id, "cut", 0.95); // REJECT → overridden to REWORK
  const unknown = await scanOn(request, token, batch.id, "e2e-report-class", 0.9); // NEEDS_REVIEW → PASS
  expect(unknown.verdict).toBe("NEEDS_REVIEW");

  const override = await api.post(`/api/v1/scans/${reject.scanId}/decision`, {
    data: {
      verdict: "REWORK",
      reason: "Cut is shallow, can be repaired",
      expectedFinalVerdict: "REJECT",
    },
  });
  expect(override.status()).toBe(200);
  const resolve = await api.post(`/api/v1/scans/${unknown.scanId}/decision`, {
    data: { verdict: "PASS", expectedFinalVerdict: null },
  });
  expect(resolve.status()).toBe(200);

  const after = await report();
  const delta = (k: string) => after.totals[k] - before.totals[k];
  expect({
    scanned: delta("scanned"),
    pass: delta("pass"),
    rework: delta("rework"),
    reject: delta("reject"),
    pending: delta("pending"),
    overridden: delta("overridden"),
    aiDecided: delta("aiDecided"),
    agreed: delta("agreed"),
    personResolved: delta("personResolved"),
  }).toEqual({
    scanned: 4,
    pass: 2,
    rework: 2,
    reject: 0,
    pending: 0,
    overridden: 1,
    aiDecided: 3,
    agreed: 2,
    personResolved: 1,
  });
  const cell = (r: typeof after, ai: string, f: string) =>
    r.matrix.find((m: { ai: string }) => m.ai === ai).counts[f];
  expect(cell(after, "REJECT", "REWORK") - cell(before, "REJECT", "REWORK")).toBe(1);
  const defects = (r: typeof after, key: string) =>
    r.defects.find((d: { key: string }) => d.key === key)?.scans ?? 0;
  expect(defects(after, "cut") - defects(before, "cut")).toBe(2);
  expect(defects(after, "hole") - defects(before, "hole")).toBe(1);

  // The page shows the same numbers for that day.
  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/reports?from=${day}&to=${day}`);
  await expect(page.getByTestId("total-scanned")).toHaveText(String(after.totals.scanned));
  await expect(page.getByTestId("daily-table").getByRole("row", { name: day })).toContainText(
    String(after.totals.overridden),
  );

  // The CSV: BOM, header, one row for the day, as a download.
  const csv = await api.get(`/api/v1/reports/daily.csv?from=${day}&to=${day}`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toContain(`cpoint-daily-${day}_${day}.csv`);
  const body = (await csv.body()).toString("utf8");
  expect(body.charCodeAt(0)).toBe(0xfeff);
  const lines = body.slice(1).trim().split("\r\n");
  expect(lines[0]).toMatch(/^Date \(Manila\),Scanned,Pass,Rework,Reject/);
  expect(lines[1]).toMatch(
    new RegExp(`^${day},${after.totals.scanned},${after.totals.pass},${after.totals.rework},`),
  );
});

test("the Floor Manager sees time in each stage with the bottleneck", async ({ browser, page }) => {
  const api = await managerApi(browser);
  const batch = await createBatch(api);
  for (const stage of ["PREPARATION", "UPPER_MAKING", "SOLEING"]) {
    const res = await api.post(`/api/v1/batches/${batch.id}/stages`, {
      data: { action: "advance", expectedStage: stage },
    });
    expect(res.status()).toBe(200);
  }
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/reports?preset=today");
  const production = page.getByTestId("production-section");
  await expect(production).toContainText("Time in each stage");
  await expect(production.getByText("Bottleneck", { exact: true })).toHaveCount(1);
  expect((await page.request.get("/api/v1/reports/stages.csv?preset=today")).status()).toBe(200);

  // Range presets live in the URL.
  await page.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL("/reports?preset=7d");
  await expect(page.getByTestId("report-range")).toContainText("7 days");
});

test("the Quality Inspector gets quality reports only, and both homes show live numbers", async ({
  browser,
  page,
}) => {
  await signInAs(page, ACCOUNTS.inspector);
  await expect(page.getByTestId("agreement-card")).toContainText("Last 7 days");
  await expect(page.getByTestId("defects-today")).toBeVisible();
  await expect(page.getByText(/Phase 7/)).toHaveCount(0);

  await page.goto("/reports");
  await expect(page.getByTestId("report-range")).toBeVisible();
  await expect(page.getByTestId("production-section")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Stages CSV" })).toHaveCount(0);
  expect((await page.request.get("/api/v1/reports/production")).status()).toBe(403);
  expect((await page.request.get("/api/v1/reports/stages.csv")).status()).toBe(403);
  expect((await page.request.get("/api/v1/reports/quality")).status()).toBe(200);

  const fm = await browser.newPage();
  await signInAs(fm, ACCOUNTS.manager);
  await expect(fm.getByTestId("inspection-split")).toContainText("Today’s inspection split");
  await expect(fm.getByText("Daily summary")).toBeVisible();
  await expect(fm.getByText(/Phase 7/)).toHaveCount(0);
  await fm.close();
});
