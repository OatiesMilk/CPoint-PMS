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

// Phase 30C (D-106, D-110, C-9, C-36, C-37): a cut from 3 in is Not accepted; a finished roll's
// defects over 10% of its area mark it Return to supplier; the Floor Manager returns it or keeps it.
// The sample photo is 64 × 48 px; at widthIn 20 it covers 20 × 15 in.

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

test.describe("Return to supplier (Floor Manager)", () => {
  test.beforeEach(async ({ page }) => signInAs(page, ACCOUNTS.manager));

  test("a marked roll waits in To return; Keep needs a reason and lets it be ticked", async ({
    browser,
    page,
    request,
  }) => {
    const roll = await markedRoll(browser, request);

    await page.goto("/reports/rolls?toReturn=1");
    const row = page.getByTestId("roll-row").filter({ hasText: roll.code });
    await expect(row).toContainText("16.7%");
    await expect(row).toContainText("Too many defects");

    await row.getByRole("link", { name: roll.code, exact: true }).click();
    await expect(
      page.getByText(/This roll has too many defects \(16\.7%, over 10%\)\./),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "How damaged is this roll?" })).toBeVisible();
    await expect(page.getByText("16.7% of this roll has defects. The limit is 10%.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Largest defects" })).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await page.getByRole("button", { name: "Keep and use…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Keep ${roll.code}?`);
    await dialog.getByRole("button", { name: "Keep roll" }).click();
    await expect(dialog.getByText(/^Write why you’re keeping it/)).toBeVisible();
    // Esc closes the dialog without saving, and never shows the Send back one (QA 30C F1).
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/back to the supplier\?/)).toHaveCount(0);
    await page.getByRole("button", { name: "Keep and use…" }).click();
    await expect(dialog.getByText(/^Write why you’re keeping it/)).toHaveCount(0);
    await dialog.getByLabel("Why are you keeping it?").fill("The holes are at one edge");
    await dialog.getByRole("button", { name: "Keep roll" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Why it was kept: The holes are at one edge")).toBeVisible();

    const stored = await withDb(async (db) => {
      const r = await db.query(
        `SELECT status::text, "markedForReturn", "returnDecision"::text AS decision FROM batches WHERE id = $1`,
        [roll.id],
      );
      return r.rows[0];
    });
    expect(stored).toEqual({ status: "FINISHED", markedForReturn: true, decision: "KEPT" });
  });

  test("Returned to supplier takes it out of stock and the claim sheet carries the findings", async ({
    browser,
    page,
    request,
  }) => {
    const roll = await markedRoll(browser, request);
    const onHand = () =>
      withDb(async (db) =>
        Number(
          (
            await db.query(`SELECT "quantityOnHand" FROM inventory_items WHERE id = $1`, [
              roll.itemId,
            ])
          ).rows[0].quantityOnHand,
        ),
      );
    const before = await onHand();

    await page.goto(`/reports/rolls/${roll.id}`);
    await page.getByRole("button", { name: "Send back to supplier…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Send ${roll.code} back to the supplier?`);
    await dialog.getByLabel("Note (optional)").fill("Claim no. 1042");
    await dialog.getByRole("button", { name: "Send back", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/Sent back to the supplier on/)).toBeVisible();
    expect(await onHand()).toBe(before - 1);

    await page.getByRole("link", { name: "Claim sheet" }).click();
    await expect(page.getByRole("heading", { name: "How damaged is this roll?" })).toBeVisible();
    await expect(page.getByText(/16\.7% of this roll has defects/)).toBeVisible();
    await expect(page.getByText("Note: Claim no. 1042")).toBeVisible();
  });
});

test("a marked roll is named on Reports → Rolls until the Floor Manager decides", async ({
  browser,
  page,
  request,
}) => {
  // Left undecided on purpose, so a manual check finds a roll in To return afterwards.
  const roll = await markedRoll(browser, request);
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/reports/rolls");
  await expect(
    page.getByText(/too many defects and (is|are) waiting for your decision\./),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Show (it|them)$/ }).click();
  await expect(page).toHaveURL(/toReturn=1/);
  await expect(page.getByTestId("roll-row").filter({ hasText: roll.code })).toHaveCount(1);
  // The Status filter shows the To return choice.
  await expect(page.getByLabel("Status")).toHaveValue("to-return");
});

test("the System Admin sets the supplier limit and each type's length limit", async ({ page }) => {
  await signInAs(page, ACCOUNTS.admin);
  await page.goto("/admin/settings?tab=thresholds");
  await expect(page.getByLabel("Send a roll back when defects cover more than")).toBeVisible();
  await page.getByLabel("Send a roll back when defects cover more than").fill("0");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText(/^Enter a percentage from 1 to 100/)).toBeVisible();

  await page.goto("/admin/settings?tab=defects");
  await expect(page.getByRole("columnheader", { name: "Counts toward the roll" })).toBeVisible();
});
