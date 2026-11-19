import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, navLabels, signIn } from "./helpers";
import {
  addInventoryRoll,
  adminApi,
  captureApi,
  createRoll,
  inspectorApi,
  makeConstructor,
  managerApi,
  MARKER_ON_SAMPLE,
  sampleJpeg,
  withDb,
} from "./cv-helpers";

// The Capture page (Phase 18; Phase 26: constructors' phones; Phase 30A: rolls are picked from
// Inventory, then scanned and finished there). The
// model files are git-ignored, so CI has none: the tests that need a real capture run only where
// `python -m cpoint_cv export-onnx` has been run (Dylan's laptop).
const MODEL = process.env.CV_MODEL_PATH ?? "cv/models/yolo-v1.onnx";
const hasModel = existsSync(MODEL) && existsSync(MODEL.replace(/\.onnx$/, ".json"));

// Chromium's fake camera with no permission prompt. It plays a still of leather with the printed
// marker card on it (D-120: no card, no shot). Chromium's own test pattern, which has no card, is
// in capture-no-card.spec.ts: launch options apply to a whole file (QA run 1, F2).
const MARKER_VIDEO = path.join(process.cwd(), "tests/e2e/fixtures/marker-card.y4m");
test.use({
  permissions: ["camera"],
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${MARKER_VIDEO}`,
    ],
  },
});

async function capture(api: APIRequestContext, captureId: string, rollId?: string) {
  return api.post("/api/v1/scans/capture", {
    multipart: {
      image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
      captureId,
      source: "PHONE",
      markerCorners: JSON.stringify(MARKER_ON_SAMPLE),
      ...(rollId ? { rollId } : {}),
    },
  });
}

/** A fresh constructor with camera access, signed in on this page. */
async function signInCapturer(page: Page) {
  const sc = await makeConstructor({ canCapture: true });
  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL(ACCOUNTS.constructor.home);
  return sc;
}

test.describe("capture API (Phase 26)", () => {
  test("only a constructor with camera access may capture; the QI, the FM and the Admin may not", async ({
    browser,
    request,
  }) => {
    // Four sign-ins on a dev server (QA run 1 timed out at the fourth after 30 s).
    test.setTimeout(60_000);
    const anonymous = await request.post("/api/v1/scans/capture", {
      multipart: { captureId: randomUUID() },
    });
    expect(anonymous.status()).toBe(401);
    for (const api of [
      await adminApi(browser),
      await inspectorApi(browser),
      await managerApi(browser),
    ]) {
      expect((await capture(api, randomUUID())).status()).toBe(403);
      expect((await api.post(`/api/v1/rolls/${randomUUID()}/start`, { data: {} })).status()).toBe(
        403,
      );
      expect((await api.get("/api/v1/rolls/ready")).status()).toBe(403);
      expect((await api.get("/api/v1/rolls/plan")).status()).toBe(403);
    }

    const sc = await captureApi(browser);
    const bad = await sc.post("/api/v1/scans/capture", {
      multipart: {
        image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
        captureId: "capture-7",
      },
    });
    expect(bad.status()).toBe(422);
    expect((await bad.json()).error.message).toMatch(/captureId must be the UUID/);

    // D-121: a roll's first shot carries the marker card's corners; without them nothing is
    // saved. (Without the model files the model check comes first.)
    const roll = await createRoll(sc);
    const noCard = await sc.post("/api/v1/scans/capture", {
      multipart: {
        image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
        captureId: randomUUID(),
        rollId: roll.id,
      },
    });
    if (hasModel) {
      expect(noCard.status()).toBe(422);
      expect((await noCard.json()).error).toMatchObject({
        code: "MARKER_REQUIRED",
        message: expect.stringMatching(
          /markerCorners is required for this shot: Show the marker card for this roll's first shot/,
        ),
      });
    } else {
      expect(noCard.status()).toBe(503);
    }
  });

  test("the card once per roll: later shots take the first shot's scale (D-121)", async ({
    browser,
  }) => {
    test.skip(!hasModel, "Needs cv/models/yolo-v1.onnx (export-onnx).");
    const sc = await captureApi(browser);
    const roll = await createRoll(sc);
    expect((await capture(sc, randomUUID(), roll.id)).status()).toBe(201);
    const later = await sc.post("/api/v1/scans/capture", {
      multipart: {
        image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
        captureId: randomUUID(),
        source: "PHONE",
        rollId: roll.id,
      },
    });
    expect(later.status()).toBe(201);
    const scans = await withDb(async (db) => {
      const res = await db.query(
        `SELECT sequence, "widthIn", "thresholdsSnapshot"->>'scaleFromShot' AS "from"
           FROM scans WHERE "batchId" = $1 ORDER BY sequence`,
        [roll.id],
      );
      return res.rows as { sequence: number; widthIn: number; from: string | null }[];
    });
    expect(scans).toHaveLength(2);
    expect(scans[1].widthIn).toBeCloseTo(scans[0].widthIn, 6);
    expect(scans[1].from).toBe("1");

    // The open roll tells Capture its scale, and the line after Finish roll its time.
    const open = (await (await sc.get("/api/v1/rolls/open")).json()).data as {
      id: string;
      scale: { width: number; height: number; shot: number } | null;
    }[];
    expect(open.find((r) => r.id === roll.id)?.scale).toMatchObject({
      width: 64,
      height: 48,
      shot: 2,
    });
    const done = await sc.post(`/api/v1/rolls/${roll.id}/finish`, { data: {} });
    expect((await done.json()).data.scanningMs).toEqual(expect.any(Number));
  });

  test("a shot needs a chosen open roll; a finished roll takes no more shots", async ({
    browser,
  }) => {
    const sc = await captureApi(browser);
    const none = await capture(sc, randomUUID());
    // Without the model files the model check comes first (503); with them, the roll is named.
    if (hasModel) {
      expect(none.status()).toBe(409);
      expect((await none.json()).error.code).toBe("NO_ROLL_CHOSEN");
    } else {
      expect(none.status()).toBe(503);
    }

    const roll = await createRoll(sc);
    const empty = await sc.post(`/api/v1/rolls/${roll.id}/finish`, { data: {} });
    expect(empty.status()).toBe(409);
    expect((await empty.json()).error.message).toBe(
      "A roll needs at least one shot to finish. Put it back instead.",
    );
    // Put back: picked by mistake, it waits in Inventory to be scanned again (Phase 30A).
    const back = await sc.post(`/api/v1/rolls/${roll.id}/cancel`, { data: {} });
    expect(back.status()).toBe(200);
    expect((await back.json()).data).toMatchObject({ status: "IN_STOCK" });
    const late = await capture(sc, randomUUID(), roll.id);
    expect(late.status()).toBe(hasModel ? 409 : 503);
  });

  test("a roll is picked from Inventory, once; nobody types a new roll (Phase 30A)", async ({
    browser,
  }) => {
    const sc = await captureApi(browser);
    // Starting a roll by typing its supplier is gone.
    expect((await sc.post("/api/v1/rolls", { data: { supplierId: randomUUID() } })).status()).toBe(
      405,
    );
    const roll = await addInventoryRoll({ areaSqFt: 31.25 });
    const ready = (await (await sc.get("/api/v1/rolls/ready")).json()).data as {
      id: string;
      areaSqFt: number;
    }[];
    expect(ready.find((r) => r.id === roll.id)).toMatchObject({ areaSqFt: 31.25 });

    const first = await sc.post(`/api/v1/rolls/${roll.id}/start`, { data: {} });
    expect(first.status()).toBe(200);
    expect((await first.json()).data).toMatchObject({ code: roll.code, shots: 0, mine: true });
    const again = await sc.post(`/api/v1/rolls/${roll.id}/start`, { data: {} });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.message).toBe(
      `${roll.code} is being scanned at Capture. Choose another roll.`,
    );
    const open = (await (await sc.get("/api/v1/rolls/open")).json()).data as { id: string }[];
    expect(open.some((r) => r.id === roll.id)).toBe(true);
    expect((await sc.post(`/api/v1/rolls/${randomUUID()}/start`, { data: {} })).status()).toBe(404);
  });

  test("without the model files the app answers 503 with where to put them", async ({
    browser,
  }) => {
    test.skip(hasModel, "The model is installed here.");
    const sc = await captureApi(browser);
    const roll = await createRoll(sc);
    const res = await capture(sc, randomUUID(), roll.id);
    expect(res.status()).toBe(503);
    expect((await res.json()).error.message).toMatch(/yolo-v1\.onnx and yolo-v1\.json/);
  });

  test("a shot is decided by the app; a retry returns the same scan; no person on it", async ({
    browser,
  }) => {
    test.skip(!hasModel, "Needs cv/models/yolo-v1.onnx (export-onnx).");
    const sc = await captureApi(browser);
    const roll = await createRoll(sc);
    const captureId = randomUUID();

    const first = await capture(sc, captureId, roll.id);
    expect(first.status()).toBe(201);
    const data = (await first.json()).data;
    expect(data).toMatchObject({
      duplicate: false,
      rollId: roll.id,
      modelVersion: expect.stringMatching(/^yolo-/),
      defects: expect.any(Array),
    });

    const again = await capture(sc, captureId, roll.id);
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
    expect(row.scan).toEqual({ deviceTokenId: null, source: "PHONE" });
    expect(row.audit).toEqual([{ actorType: "USER", n: 1 }]);

    // All of it is in: finish it. A finished roll is refused before the model runs.
    expect((await sc.post(`/api/v1/rolls/${roll.id}/finish`, { data: {} })).status()).toBe(200);
    const late = await capture(sc, randomUUID(), roll.id);
    expect(late.status()).toBe(409);
    expect((await late.json()).error.code).toBe("ROLL_CLOSED");
  });
});

test.describe("Capture's counter (Phase 30D, D-118)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows today's rolls scanned against the plan and the next planned days", async ({
    page,
    browser,
  }) => {
    const api = await captureApi(browser);
    const res = await api.get("/api/v1/rolls/plan");
    expect(res.status()).toBe(200);
    const days = (await res.json()).data as {
      day: string;
      isToday: boolean;
      kind: string;
      planned: number | null;
      scanned: number;
      label: string;
    }[];
    // Today first, whatever its plan, then planned days only, in order, five at most.
    expect(days.length).toBeGreaterThanOrEqual(1);
    expect(days.length).toBeLessThanOrEqual(5);
    expect(days[0].isToday).toBe(true);
    for (const [i, d] of days.slice(1).entries()) {
      expect(d).toMatchObject({ isToday: false, kind: "PLANNED", scanned: 0 });
      expect(d.day > days[i].day).toBe(true);
    }

    await signInCapturer(page);
    const counter = page.getByTestId("plan-counter");
    await expect(counter).toContainText(`Today, ${days[0].label}`);
    const today = page.getByTestId("plan-today");
    if (days[0].kind === "PLANNED")
      await expect(today).toContainText(/^Leather rolls scanned \d+(\/\d+)?/);
    else if (days[0].kind === "NON_WORKING")
      await expect(today).toContainText("Today is marked Non-working / Holiday.");
    else await expect(today).toContainText("The Floor Manager hasn’t planned today yet.");
    if (days.length > 1) {
      const ahead = page.getByTestId("plan-ahead").getByRole("listitem");
      await expect(ahead).toHaveCount(days.length - 1);
      await expect(ahead.first()).toContainText(days[1].label);
      await expect(ahead.first()).toContainText(
        days[1].planned === null
          ? "Leather rolls scanned 0"
          : `Leather rolls scanned 0/${days[1].planned}`,
      );
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="plan-counter"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test.describe("Capture on a phone (Phase 26)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a constructor picks a roll from Inventory, sees it in large text, and finishes or puts it back", async ({
    page,
  }) => {
    const roll = await addInventoryRoll({ areaSqFt: 24.5 });
    const code = roll.code;
    await signInCapturer(page);
    // No sidebar on a phone; with Find roll (Phase 32) a capturer has two pages, so the phone bar
    // has its Pages menu.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Pages" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Capture", level: 1 })).toBeVisible();
    // No page scrolls sideways at phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );

    // Other tests' rolls may be open (the dropdown lists every open roll); pick our own. There is
    // nothing to type: no supplier, no tag (Phase 30A).
    const another = page.getByRole("button", { name: "Start another roll" });
    if (await another.isVisible()) await another.click();
    await expect(page.getByRole("heading", { name: "Start a roll" })).toBeVisible();
    await expect(page.getByLabel("Supplier")).toHaveCount(0);
    // Phase 30E (D-113): the leather first, then the roll on the table by its code.
    const onTable = page.getByLabel("Roll on the table");
    await expect(onTable).toBeDisabled();
    await page.getByRole("button", { name: "Start scanning" }).click();
    await expect(page.getByText("Choose the leather you’re scanning.")).toBeVisible();
    await page.getByLabel("Leather", { exact: true }).selectOption(roll.item);
    await page.getByRole("button", { name: "Start scanning" }).click();
    await expect(
      page.getByText("Choose the roll on the table. Its code is on its label."),
    ).toBeVisible();
    await expect(onTable).toContainText(`${code} · 24.5 sq ft`);
    await onTable.selectOption(roll.id);
    await page.getByRole("button", { name: "Start scanning" }).click();

    const line = page.getByTestId("capture-roll-line");
    await expect(line).toContainText(`Roll ${code}`);
    await expect(line).toContainText("24.5 sq ft");
    await expect(line).toContainText("0 shots");
    await expect(page.getByRole("combobox", { name: "Roll" })).toContainText(code);

    // The Capture button sits at the bottom of the screen, in reach of a thumb.
    const button = page.getByRole("button", { name: "Capture", exact: true });
    const box = (await button.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(844 - 120);
    expect(box.height).toBeGreaterThanOrEqual(44);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    if (!hasModel) {
      await expect(button).toBeDisabled();
      // An empty roll can't be finished, only put back in Inventory.
      await expect(page.getByRole("button", { name: "Finish roll" })).toBeDisabled();
      await page.getByRole("button", { name: "Put roll back" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Put roll back" }).click();
      await expect(
        page.getByText(`${code} is back with the rolls waiting to be scanned.`),
      ).toBeVisible();
      return;
    }

    await expect(page.getByLabel("Live camera picture")).toBeVisible();
    await expect(page.getByTestId("marker-status")).toContainText("Marker card found");
    await button.click();
    await expect(page.getByText(new RegExp(`Shot #1 · ${code}`))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Pass: this part|Reject: this part/)).toBeVisible();
    await expect(line).toContainText("1 shot");
    await page.getByRole("button", { name: "Finish roll" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Is all of ${code} scanned?`);
    await dialog.getByRole("button", { name: "Finish roll" }).click();
    await expect(
      page.getByText(`${code} is finished with 1 shot. It is taken off the ${roll.item} stock.`),
    ).toBeVisible();
  });

  test("a constructor without camera access is told who grants it", async ({ page }) => {
    const sc = await makeConstructor();
    await page.goto("/login");
    await signIn(page, sc.email);
    await expect(page).toHaveURL(ACCOUNTS.constructor.home);
    await expect(page.getByTestId("no-camera-access")).toHaveText(
      "Ask the System Admin for camera access.",
    );
    await expect(page.getByRole("button", { name: "Capture", exact: true })).toHaveCount(0);
    await page.goto("/batches");
    await expect(page).toHaveURL(/\/forbidden/);
  });
});

test.describe("Capture page on a desktop", () => {
  test("the QI and the Floor Manager no longer capture (C-18)", async ({ page }) => {
    for (const account of [ACCOUNTS.inspector, ACCOUNTS.manager, ACCOUNTS.admin]) {
      await page.goto("/login");
      await signIn(page, account.email);
      await expect(page).toHaveURL(account.home);
      expect(await navLabels(page)).not.toContain("Capture");
      await page.goto("/camera/capture");
      await expect(page).toHaveURL(/\/forbidden/);
      // Leave the app first: a request still in flight (the QI's batch notices, Phase 27) could
      // set the session cookie again after it's cleared, and /login would then redirect home.
      await page.goto("about:blank");
      await page.context().clearCookies();
    }
  });

  test("the Roll dropdown lists every open roll and says where the shot goes", async ({
    browser,
    page,
  }) => {
    const other = await captureApi(browser);
    const theirs = await createRoll(other, { tagCode: "LR-OTHER" });
    await signInCapturer(page);
    await page.goto("/camera/capture");
    const select = page.getByRole("combobox", { name: "Roll" });
    await expect(select.locator("option", { hasText: theirs.code })).toHaveCount(1);
    await select.selectOption(theirs.id);
    await expect(page.getByTestId("capture-roll-line")).toContainText(`Roll ${theirs.code}`);
    // Remembered on this browser.
    await page.reload();
    await expect(page.getByTestId("capture-roll-line")).toContainText(`Roll ${theirs.code}`);
  });
});

test.describe("the marker card on the live picture (D-120)", () => {
  test("with the card in view, Capture says the shot will be measured", async ({ page }) => {
    await signInCapturer(page);
    await expect(page.getByLabel("Live camera picture")).toBeVisible();
    await expect(page.getByTestId("marker-status")).toContainText(
      /Marker card found\. This shot will be measured \(16\.\d in across\)/,
      { timeout: 15_000 },
    );
  });
});

test.describe("Floor view (D-074)", () => {
  test("fills the screen with the live camera, shows the chosen roll and Esc leaves", async ({
    browser,
    page,
  }) => {
    await signInCapturer(page);
    // A roll to capture into (started by another constructor; the dropdown lists every open roll).
    const roll = await createRoll(await captureApi(browser));
    await page.goto("/camera/capture");
    await page.getByRole("combobox", { name: "Roll" }).selectOption(roll.id);
    await page.getByRole("button", { name: "Floor view" }).click();

    const floor = page.getByRole("region", { name: "Floor view" });
    await expect(floor).toBeVisible();
    await expect(floor.getByText(`Roll ${roll.code}`)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    if (hasModel) {
      await expect(floor.getByLabel("Live camera picture")).toBeVisible();
      await page.keyboard.press("Space"); // the station's capture key
      const band = floor.getByRole("status").filter({ hasText: /Shot #\d+/ });
      await expect(band).toContainText(/Pass|Reject/, { timeout: 30_000 });
    } else {
      await expect(floor.getByRole("alert")).toContainText("Capture is off.");
    }

    // Remembered on this browser: a reload opens straight into Floor view.
    await page.reload();
    await expect(page.getByRole("region", { name: "Floor view" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Capture", level: 1 })).toBeVisible();
  });
});

test.describe("camera access is given by the System Admin (D-075, Phase 26)", () => {
  test("the Admin gives a constructor camera access in Users; the FM can't", async ({
    browser,
    page,
  }) => {
    const sc = await makeConstructor();
    const fm = await managerApi(browser);
    const refused = await fm.put(`/api/v1/camera/operators/${sc.id}`, {
      data: { canCapture: true },
    });
    expect(refused.status()).toBe(403);
    await page.goto("/login");
    await signIn(page, ACCOUNTS.admin.email);
    await expect(page).toHaveURL(ACCOUNTS.admin.home);
    await page.goto("/admin/users");
    await page.getByLabel("Search").fill(sc.email);
    const row = page.getByRole("row", { name: sc.email });
    await row.getByRole("button", { name: /More actions/ }).click();
    await page.getByRole("menuitem", { name: "Give camera access" }).click();
    await expect(page.getByText(/can now capture rolls on their phone/)).toBeVisible();
    await expect(row).toContainText("Camera");

    const allowed = await withDb(
      async (db) =>
        (await db.query(`SELECT "canCapture" FROM users WHERE id = $1`, [sc.id])).rows[0]
          .canCapture,
    );
    expect(allowed).toBe(true);
    await withDb((db) => db.query(`UPDATE users SET "isActive" = false WHERE id = $1`, [sc.id]));
  });
});
