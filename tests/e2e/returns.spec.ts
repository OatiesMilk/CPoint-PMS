import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  captureApi,
  createDeviceToken,
  createRoll,
  ensureRuleTypes,
  e2eKey,
  sampleJpeg,
  withDb,
} from "./cv-helpers";

// Phase 30C (D-106, D-110, C-9, C-37): a cut from 3 in is Not accepted; a finished roll's defects
// over 10% of its area are marked Returned to supplier by the system (D-116; D-112 before). The
// roll leaves stock at Finish roll whatever its Defect %, and nobody sends it back or keeps it in
// the app. The sample photo is 64 × 48 px; at widthIn 20 it
// covers 20 × 15 in.

const WIDTH_IN = 20;
/** A cut type of the tests' own: Not accepted from 3 in, 1% a roll each from 3 in. */
const CUT_30C = "e2e-30c-cut";

async function ensureCut30c() {
  await withDb((db) =>
    db.query(
      `INSERT INTO defect_types (id, key, label, "isActive", outcome, "notAcceptedFromIn", "flatSharePct",
         "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, 'E2E 30C cut', true, 'NOT_ACCEPTED', 3, 1, 950, now(), now())
       ON CONFLICT (key) DO UPDATE SET "isActive" = true, outcome = 'NOT_ACCEPTED',
         "notAcceptedFromIn" = 3, "flatSharePct" = 1`,
      [randomUUID(), CUT_30C],
    ),
  );
}

/** A shot from a calibrated phone (or not, with widthIn null). */
async function postMeasured(
  request: APIRequestContext,
  token: string,
  rollId: string,
  detections: {
    classKey: string;
    confidence: number;
    box: { x: number; y: number; width: number; height: number };
  }[],
  widthIn: number | null = WIDTH_IN,
) {
  await ensureRuleTypes();
  const res = await request.post("/api/v1/scans", {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
      detections: JSON.stringify(detections),
      rollId,
      source: "SIMULATOR",
      ...(widthIn === null ? {} : { widthIn: String(widthIn) }),
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data as { verdict: string; defects: { lengthIn: number | null }[] };
}

/** A hole box of 0.2 × 0.2: 4 × 3 in, 12 sq in, counted by its area. */
const hole = {
  classKey: e2eKey("hole"),
  confidence: 0.9,
  box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
};

/** A roll of 1 sq ft (144 sq in) with two such holes: 24 sq in, 16.7%, over the 10% limit. */
async function markedRoll(browser: Parameters<typeof captureApi>[0], request: APIRequestContext) {
  const sc = await captureApi(browser);
  const roll = await createRoll(sc, { areaSqFt: 1 });
  const { token } = await createDeviceToken();
  // A leather of its own with one roll on hand: Finish roll takes it to 0.
  await postMeasured(request, token, roll.id, [hole]);
  await postMeasured(request, token, roll.id, [hole]);
  const res = await sc.post(`/api/v1/rolls/${roll.id}/finish`, { data: {} });
  expect(res.status()).toBe(200);
  const data = (await res.json()).data;
  expect(data).toMatchObject({ marked: true, limitPct: 10, notMeasured: null });
  expect(data.sharePct).toBeCloseTo(16.67, 1);
  return roll;
}

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

test.describe("the 3-inch line (C-37)", () => {
  test("a cut under 3 in is Usable, from 3 in Not accepted; uncalibrated is Not accepted", async ({
    browser,
    request,
  }) => {
    await ensureCut30c();
    const sc = await captureApi(browser);
    const roll = await createRoll(sc);
    const { token } = await createDeviceToken();
    // 0.1 × 0.1 → 2 × 1.5 in, 2.5 in long; 0.15 × 0.12 → 3 × 1.8 in, 3.5 in long.
    const short = {
      classKey: CUT_30C,
      confidence: 0.9,
      box: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
    };
    const long = { ...short, box: { x: 0.1, y: 0.1, width: 0.15, height: 0.12 } };
    const a = await postMeasured(request, token, roll.id, [short]);
    expect(a.verdict).toBe("PASS");
    expect(a.defects[0].lengthIn).toBeCloseTo(2.5, 2);
    expect((await postMeasured(request, token, roll.id, [long])).verdict).toBe("REJECT");
    expect((await postMeasured(request, token, roll.id, [short], null)).verdict).toBe("REJECT");
  });
});

test.describe("Returned to supplier (D-116)", () => {
  test.beforeEach(async ({ page }) => signInAs(page, ACCOUNTS.manager));

  test("a roll over the limit leaves stock at Finish roll and reads Returned to supplier, with no decision", async ({
    browser,
    page,
    request,
  }) => {
    const roll = await markedRoll(browser, request);
    const stored = await withDb(async (db) => {
      const r = await db.query(
        `SELECT b.status::text, b."markedForReturn", b."returnDecision"::text AS decision,
           i."quantityOnHand"::float AS "onHand"
         FROM batches b JOIN inventory_items i ON i.id = b."itemId" WHERE b.id = $1`,
        [roll.id],
      );
      return r.rows[0];
    });
    expect(stored).toEqual({
      status: "FINISHED",
      markedForReturn: true,
      decision: null,
      onHand: 0,
    });

    // No To return band or filter any more.
    await page.goto("/reports/rolls");
    await expect(page.getByText(/waiting for your decision/)).toHaveCount(0);
    await expect(
      page.getByLabel("Status").locator("option", { hasText: "Waiting for your decision" }),
    ).toHaveCount(0);
    await page.goto(`/reports/rolls?q=${encodeURIComponent(roll.code)}`);
    const row = page.getByTestId("roll-row").filter({ hasText: roll.code });
    await expect(row).toContainText("16.7%");
    await expect(row).toContainText("Returned to supplier");
    await expect(row).not.toContainText("Too many defects");
    await expect(row).toContainText(roll.item);

    await row.getByRole("link", { name: roll.code, exact: true }).click();
    await expect(
      page.getByText(
        /Returned to supplier: defects cover 16\.7% of this roll, over the 10% limit\./,
      ),
    ).toBeVisible();
    await page.goto(`/reports/rolls?status=RETURNED&q=${encodeURIComponent(roll.code)}`);
    await expect(page.getByTestId("roll-row").filter({ hasText: roll.code })).toHaveCount(1);
    await page.goto(`/reports/rolls?status=PASSED&q=${encodeURIComponent(roll.code)}`);
    await expect(page.getByText("No rolls match these filters")).toBeVisible();
    await page.goto(`/reports/rolls/${roll.id}`);
    await expect(page.getByRole("heading", { name: "How damaged is this roll?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Largest defects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send back to supplier…" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Keep and use…" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Remove/ })).toHaveCount(0);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // The claim sheet still carries the findings.
    await page.getByRole("link", { name: "Claim sheet" }).click();
    await expect(page.getByRole("heading", { name: "How damaged is this roll?" })).toBeVisible();
    await expect(page.getByTestId("defect-share")).toHaveText("16.7%");
    // Exact: the Returned to supplier line above also says "over the 10% limit" (run 1 F3).
    await expect(page.getByText("Over the 10% limit", { exact: true })).toBeVisible();
  });

  test("the Floor Manager's old decision route is gone", async ({ browser }) => {
    const sc = await captureApi(browser);
    const roll = await createRoll(sc);
    const res = await sc.post(`/api/v1/rolls/${roll.id}/return-decision`, {
      data: { decision: "KEPT", note: "x" },
    });
    expect(res.status()).toBe(404);
  });
});

test("the System Admin sets the Returned to supplier limit and each type's length limit", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.admin);
  await page.goto("/admin/settings?tab=thresholds");
  const limit = page.getByLabel("Mark a roll Returned to supplier when defects cover more than");
  await expect(limit).toBeVisible();
  await limit.fill("0");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText(/^Enter a percentage from 1 to 100/)).toBeVisible();

  await page.goto("/admin/settings?tab=defects");
  await expect(page.getByRole("columnheader", { name: "Counts toward the roll" })).toBeVisible();
});
