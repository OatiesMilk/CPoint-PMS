import { randomBytes, randomInt, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  captureApi,
  createDeviceToken,
  createRoll,
  e2eKey,
  ensureRuleTypes,
  finishRoll,
  sampleJpeg,
  withDb,
} from "./cv-helpers";

/**
 * Phase 20: Supplier quality on the Floor Manager's Operations report, and the claim sheet. Since
 * D-117 it counts whole rolls on the day they were finished: the roll is moved onto a random day in
 * 2024, a year no other spec uses, so this supplier's numbers are its own.
 */
const day = `2024-${String(randomInt(1, 13)).padStart(2, "0")}-${String(randomInt(1, 29)).padStart(2, "0")}`;

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

async function scan(
  request: APIRequestContext,
  token: string,
  rollId: string,
  classKey: string,
  confidence: number,
) {
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
}

/**
 * A supplier of its own (with its short code, Phase 30A), one roll from it added in Inventory and
 * picked at Capture, three shots (two rejected), finished, and then set on `day` as a roll whose
 * defects cover 16.7% of it: Returned to supplier (D-116).
 */
async function rollWithRejects(api: APIRequestContext, request: APIRequestContext) {
  await ensureRuleTypes();
  const supplier = `E2E Tannery ${randomBytes(3).toString("hex").toUpperCase()}`;
  const supplierId = randomUUID();
  await withDb((db) =>
    db.query(
      `INSERT INTO suppliers (id, code, name, "isActive", "createdAt") VALUES ($1, $2, $3, true, now())`,
      [supplierId, `Q${randomBytes(2).toString("hex").toUpperCase()}`, supplier],
    ),
  );
  const tagCode = `E2E-SQ-${randomBytes(3).toString("hex").toUpperCase()}`;
  const roll = await createRoll(api, { supplierId, tagCode });
  const { token } = await createDeviceToken();
  await scan(request, token, roll.id, "hole", 0.95); // REJECT
  await scan(request, token, roll.id, "hole", 0.96); // REJECT
  await scan(request, token, roll.id, "cut", 0.3); // PASS
  await finishRoll(api, roll.id);
  await withDb((db) =>
    db.query(
      `UPDATE batches SET "finishedAt" = $2::timestamptz AT TIME ZONE 'UTC',
         "defectSharePct" = 16.7, "markedForReturn" = true, "returnDecision" = NULL WHERE id = $1`,
      [roll.id, `${day}T15:00:00+08:00`],
    ),
  );
  return { supplier, tagCode, roll };
}

test("Supplier quality counts the supplier's rolls returned, lists the roll, and the claim sheet shows the rejects", async ({
  browser,
  page,
  request,
}) => {
  const { supplier, tagCode, roll } = await rollWithRejects(await captureApi(browser), request);

  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/reports?view=operations&from=${day}&to=${day}`);
  const card = page.getByTestId("supplier-quality");
  await expect(card.getByText("Supplier quality", { exact: true })).toBeVisible();
  const row = card.getByTestId("supplier-table").getByRole("row", { name: new RegExp(supplier) });
  // Rolls 1, passed 0, returned 1, 100%, top defect "E2E hole"; no sections (D-117).
  await expect(row.getByRole("cell")).toHaveText([
    new RegExp(supplier),
    "1",
    "0",
    "1",
    "100%",
    "E2E hole",
  ]);
  await expect(card.getByRole("columnheader", { name: /Sections|Defect area/ })).toHaveCount(0);
  const rollRow = card
    .getByTestId("most-defects-rolls")
    .getByRole("row", { name: new RegExp(roll.code) });
  await expect(rollRow).toContainText(tagCode);
  await expect(rollRow).toContainText("16.7%");
  await expect(rollRow).toContainText("Returned to supplier");
  await expect(rollRow).toContainText("E2E hole 2");
  await expect(card).toContainText("never by person");

  const axe = await new AxeBuilder({ page })
    .include("[data-testid=supplier-quality]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  const csv = await page.request.get(`/api/v1/reports/supplier-rolls.csv?from=${day}&to=${day}`);
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  // The CSV starts with a UTF-8 byte-order mark so Excel reads it (report-rules.ts).
  expect(text.split("\n")[0]).toMatch(/^\uFEFF?Roll,Tag number,Supplier,/);
  expect(text.split("\n")[0]).toContain("Roll,Tag number,Supplier,Defect %,Status,Defects");
  expect(text).toContain(
    `${roll.code},${tagCode},${supplier},16.7,Returned to supplier,E2E hole 2`,
  );

  await rollRow.getByRole("link", { name: /Claim sheet/ }).click();
  await expect(page).toHaveURL(`/reports/claims/${roll.id}`);
  await expect(
    page.getByRole("heading", { name: `Claim sheet: roll ${roll.code}`, level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId("claim-summary")).toContainText("2 of 3 rejected");
  await expect(page.getByTestId("claim-sections").getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Save as PDF" })).toBeVisible();
  const claimAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(claimAxe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("only the Floor Manager opens claim sheets and the rolls CSV", async ({
  browser,
  page,
  request,
}) => {
  const { roll } = await rollWithRejects(await captureApi(browser), request);
  await signInAs(page, ACCOUNTS.inspector);
  await page.goto(`/reports/claims/${roll.id}`);
  await expect(page).toHaveURL(/\/forbidden/);
  expect((await page.request.get("/api/v1/reports/supplier-rolls.csv")).status()).toBe(403);
});

test("a claim sheet for a roll that doesn't exist is a 404", async ({ page }) => {
  await signInAs(page, ACCOUNTS.manager);
  // Reports has a loading.tsx, so the response streams with 200 before notFound() runs; the
  // not-found page is what the user sees.
  await page.goto(`/reports/claims/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "This page doesn’t exist" })).toBeVisible();
});
