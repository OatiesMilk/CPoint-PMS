import { randomBytes, randomInt, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  createDeviceToken,
  e2eKey,
  ensureRuleTypes,
  managerApi,
  sampleJpeg,
  shoeTypeId,
  withDb,
} from "./cv-helpers";

/**
 * Phase 20: Supplier quality on the Floor Manager's Operations report, and the claim sheet. Scans
 * go on a random day in 2024, a year no other spec scans in, so this supplier's numbers are its own.
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
  batchId: string,
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
      batchId,
      source: "SIMULATOR",
      capturedAt: `${day}T10:00:00+08:00`,
    },
  });
  expect(res.status()).toBe(201);
}

/** A supplier of its own, one batch (one roll) from it, and three sections: two rejected. */
async function rollWithRejects(api: APIRequestContext, request: APIRequestContext) {
  await ensureRuleTypes();
  const supplier = `E2E Tannery ${randomBytes(3).toString("hex").toUpperCase()}`;
  const supplierId = randomUUID();
  await withDb((db) =>
    db.query(
      `INSERT INTO suppliers (id, name, "isActive", "createdAt") VALUES ($1, $2, true, now())`,
      [supplierId, supplier],
    ),
  );
  const rollCode = `E2E-SQ-${randomBytes(3).toString("hex").toUpperCase()}`;
  const res = await api.post("/api/v1/batches", {
    data: { rollCode, shoeTypeId: await shoeTypeId(), supplierId, receivedAt: "2024-01-02" },
  });
  expect(res.status()).toBe(201);
  const batch = (await res.json()).data as { id: string; code: string };
  const started = await api.post(`/api/v1/batches/${batch.id}/stages`, {
    data: { action: "start", expectedStage: "PREPARATION" },
  });
  expect(started.status()).toBe(200);
  const { token } = await createDeviceToken();
  await scan(request, token, batch.id, "hole", 0.95); // REJECT
  await scan(request, token, batch.id, "hole", 0.96); // REJECT
  await scan(request, token, batch.id, "cut", 0.3); // PASS
  return { supplier, rollCode, batch };
}

test("Supplier quality lists the supplier and its roll, and the claim sheet shows the rejects", async ({
  browser,
  page,
  request,
}) => {
  const api = await managerApi(browser);
  const { supplier, rollCode, batch } = await rollWithRejects(api, request);

  await signInAs(page, ACCOUNTS.manager);
  await page.goto(`/reports?view=operations&from=${day}&to=${day}`);
  const card = page.getByTestId("supplier-quality");
  await expect(card.getByText("Supplier quality", { exact: true })).toBeVisible();
  const row = card.getByTestId("supplier-table").getByRole("row", { name: new RegExp(supplier) });
  // Rolls 1, Sections 3, Fixable 0%, Reject 67%, top defect "E2E hole".
  await expect(row).toContainText("67%");
  await expect(row).toContainText("E2E hole");
  const roll = card.getByTestId("rejected-rolls").getByRole("row", { name: new RegExp(rollCode) });
  await expect(roll).toContainText("2 of 3");
  await expect(roll).toContainText("E2E hole 2");
  await expect(card).toContainText("never by person");

  const axe = await new AxeBuilder({ page })
    .include("[data-testid=supplier-quality]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  const csv = await page.request.get(`/api/v1/reports/supplier-rolls.csv?from=${day}&to=${day}`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(`${rollCode},${batch.code},${supplier},3,2,E2E hole 2`);

  await roll.getByRole("link", { name: /Claim sheet/ }).click();
  await expect(page).toHaveURL(`/reports/claims/${batch.id}`);
  await expect(
    page.getByRole("heading", { name: `Claim sheet: roll ${rollCode}`, level: 1 }),
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
  const api = await managerApi(browser);
  const { batch } = await rollWithRejects(api, request);
  await signInAs(page, ACCOUNTS.inspector);
  await page.goto(`/reports/claims/${batch.id}`);
  await expect(page).toHaveURL(/\/forbidden/);
  expect((await page.request.get("/api/v1/reports/supplier-rolls.csv")).status()).toBe(403);
});

test("a claim sheet for a batch that doesn't exist is a 404", async ({ page }) => {
  await signInAs(page, ACCOUNTS.manager);
  // Reports has a loading.tsx, so the response streams with 200 before notFound() runs; the
  // not-found page is what the user sees.
  await page.goto(`/reports/claims/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "This page doesn’t exist" })).toBeVisible();
});
