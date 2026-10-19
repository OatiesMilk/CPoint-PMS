import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, navLabels, signIn } from "./helpers";
import { adminApi, createBatch, inspectorApi, managerApi, sampleJpeg, withDb } from "./cv-helpers";

// The Capture page (Phase 18). The model files are git-ignored, so CI has none: the tests that need
// a real capture run only where `python -m cpoint_cv export-onnx` has been run (Dylan's laptop).
const MODEL = process.env.CV_MODEL_PATH ?? "cv/models/yolo-v1.onnx";
const hasModel = existsSync(MODEL) && existsSync(MODEL.replace(/\.onnx$/, ".json"));

// Chromium's fake camera: a moving test pattern, and no permission prompt.
test.use({
  permissions: ["camera"],
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

async function capture(api: Awaited<ReturnType<typeof inspectorApi>>, captureId: string) {
  return api.post("/api/v1/scans/capture", {
    multipart: {
      image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
      captureId,
      source: "WEBCAM",
    },
  });
}

test.describe("capture API", () => {
  test("only the QI and the FM may capture; fields are named when wrong", async ({
    browser,
    request,
  }) => {
    const anonymous = await request.post("/api/v1/scans/capture", {
      multipart: { captureId: randomUUID() },
    });
    expect(anonymous.status()).toBe(401);

    const admin = await adminApi(browser);
    expect((await capture(admin, randomUUID())).status()).toBe(403);

    const inspector = await inspectorApi(browser);
    const bad = await inspector.post("/api/v1/scans/capture", {
      multipart: {
        image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
        captureId: "capture-7",
      },
    });
    expect(bad.status()).toBe(422);
    expect((await bad.json()).error.message).toMatch(/captureId must be the UUID/);
  });

  test("without the model files the app answers 503 with where to put them", async ({
    browser,
  }) => {
    test.skip(hasModel, "The model is installed here.");
    await createBatch(await managerApi(browser));
    const res = await capture(await inspectorApi(browser), randomUUID());
    expect(res.status()).toBe(503);
    expect((await res.json()).error.message).toMatch(/yolo-v1\.onnx and yolo-v1\.json/);
  });

  test("a capture is decided by the app; a retry returns the same scan; no person on it", async ({
    browser,
  }) => {
    test.skip(!hasModel, "Needs cv/models/yolo-v1.onnx (export-onnx).");
    await createBatch(await managerApi(browser));
    const inspector = await inspectorApi(browser);
    const captureId = randomUUID();

    const first = await capture(inspector, captureId);
    expect(first.status()).toBe(201);
    const data = (await first.json()).data;
    expect(data).toMatchObject({ duplicate: false, modelVersion: expect.stringMatching(/^yolo-/) });

    const again = await capture(inspector, captureId);
    expect(again.status()).toBe(200);
    expect((await again.json()).data).toMatchObject({ scanId: data.scanId, duplicate: true });

    const row = await withDb(async (db) => {
      const scan = await db.query(`SELECT "deviceTokenId", source FROM scans WHERE id = $1`, [
        data.scanId,
      ]);
      const audit = await db.query(
        `SELECT "actorType", count(*)::int n FROM audit_logs WHERE "entityId" = $1 AND action = 'scan.create' GROUP BY "actorType"`,
        [data.scanId],
      );
      return { scan: scan.rows[0], audit: audit.rows };
    });
    expect(row.scan).toEqual({ deviceTokenId: null, source: "WEBCAM" });
    expect(row.audit).toEqual([{ actorType: "USER", n: 1 }]);
  });
});

test.describe("Capture page", () => {
  test("the QI sees the live camera and the batch, and gets the app's verdict", async ({
    browser,
    page,
  }) => {
    await createBatch(await managerApi(browser));
    await page.goto("/login");
    await signIn(page, ACCOUNTS.inspector.email);
    await expect(page).toHaveURL(ACCOUNTS.inspector.home);
    expect(await navLabels(page)).toContain("Capture");

    await page.getByRole("link", { name: "Capture sections" }).click();
    await expect(page.getByRole("heading", { name: "Capture", level: 1 })).toBeVisible();
    await expect(page.getByText(/Next scan goes to/)).toBeVisible();
    const button = page.getByRole("button", { name: "Capture", exact: true });

    if (!hasModel) {
      await expect(page.getByText(/The camera model isn’t installed on the server/)).toBeVisible();
      await expect(button).toBeDisabled();
      return;
    }
    await expect(page.getByLabel("Live camera picture")).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByText(/Section #\d+/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Open scan" })).toBeVisible();
  });

  test("the page passes axe (WCAG 2.1 A/AA)", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, ACCOUNTS.manager.email);
    await expect(page).toHaveURL(ACCOUNTS.manager.home);
    await page.goto("/camera/capture");
    await expect(page.getByRole("heading", { name: "Capture", level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("the System Admin has no Capture page", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, ACCOUNTS.admin.email);
    await expect(page).toHaveURL(ACCOUNTS.admin.home);
    expect(await navLabels(page)).not.toContain("Capture");
    await page.goto("/camera/capture");
    await expect(page).toHaveURL(/\/forbidden/);
  });
});
