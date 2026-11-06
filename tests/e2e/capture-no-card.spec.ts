import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { ACCOUNTS, signIn } from "./helpers";
import { addInventoryRoll, makeConstructor } from "./cv-helpers";

const MODEL = process.env.CV_MODEL_PATH ?? "cv/models/yolo-v1.onnx";
const hasModel = existsSync(MODEL) && existsSync(MODEL.replace(/\.onnx$/, ".json"));

/**
 * A square card for a picture of this size, as fractions: its side is 40% of the shorter edge, so
 * it looks square at any aspect ratio (QA run 2: the 64 × 48 sample's corners on a 1280 × 720
 * picture read as tilted, 422).
 */
const cardFor = (width: number, height: number) => {
  const side = Math.min(width, height) * 0.4;
  const [x0, y0] = [width * 0.3, height * 0.2];
  const pt = (x: number, y: number) => ({ x: x / width, y: y / height });
  return [[pt(x0, y0), pt(x0 + side, y0), pt(x0 + side, y0 + side), pt(x0, y0 + side)]];
};

/** A plain leather-brown photo of this size (the server reads the size, D-121). */
const jpegOf = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#7a4a26" } })
    .jpeg()
    .toBuffer();

// Capture without the scale marker card (D-120): Chromium's own fake camera, a test pattern with
// no card. Its own file, because launch options apply to a whole file (QA run 1, F2).
test.use({
  permissions: ["camera"],
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test("without the card Capture stays off, says to show it and links the printable card", async ({
  page,
}) => {
  const sc = await makeConstructor({ canCapture: true });
  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL(ACCOUNTS.constructor.home);
  await expect(page.getByLabel("Live camera picture")).toBeVisible();
  const status = page.getByTestId("marker-status");
  await expect(status).toContainText("Show the marker card to capture.");
  await expect(status.getByRole("link", { name: "Print the marker card" })).toHaveAttribute(
    "href",
    "/cpoint-scale-marker-2in.pdf",
  );
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Set up this phone" })).toHaveCount(0);
  const pdf = await page.request.get("/cpoint-scale-marker-2in.pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
});

test("a roll shows its scanning timer from Start scanning (D-121)", async ({ page }) => {
  const sc = await makeConstructor({ canCapture: true });
  await page.goto("/login");
  await signIn(page, sc.email);
  // Wait for the session before using page.request (QA run 1: a 401 when it went too early).
  await expect(page).toHaveURL(ACCOUNTS.constructor.home);
  const roll = await addInventoryRoll();
  expect((await page.request.post(`/api/v1/rolls/${roll.id}/start`, { data: {} })).status()).toBe(
    200,
  );
  await page.reload();
  await expect(page.getByTestId("capture-roll-line")).toContainText(roll.code);
  // mm:ss, counting up (or paused for lunch, which doesn't count).
  await expect(page.getByTestId("scanning-timer")).toContainText(/Scanning time \d{2}:\d{2}/);
});

test("after the roll's first shot with the card, Capture works without it (D-121)", async ({
  page,
}) => {
  test.skip(!hasModel, "Needs cv/models/yolo-v1.onnx (export-onnx).");
  const sc = await makeConstructor({ canCapture: true });
  await page.goto("/login");
  await signIn(page, sc.email);
  // Wait for the session before using page.request (QA run 1: a 401 when it went too early).
  await expect(page).toHaveURL(ACCOUNTS.constructor.home);
  const roll = await addInventoryRoll();
  expect((await page.request.post(`/api/v1/rolls/${roll.id}/start`, { data: {} })).status()).toBe(
    200,
  );
  await page.reload();
  const video = page.getByLabel("Live camera picture");
  await expect(video).toBeVisible();
  await expect(page.getByTestId("marker-status")).toContainText("Show the marker card to capture.");
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeDisabled();

  // The first shot, with the card, from a picture the size of this camera's.
  // The camera's own size, once it is playing.
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  const size = await video.evaluate((v: HTMLVideoElement) => [v.videoWidth, v.videoHeight]);
  const first = await page.request.post("/api/v1/scans/capture", {
    multipart: {
      image: {
        name: "capture.jpg",
        mimeType: "image/jpeg",
        buffer: await jpegOf(size[0], size[1]),
      },
      captureId: randomUUID(),
      source: "WEBCAM",
      rollId: roll.id,
      markerCorners: JSON.stringify(cardFor(size[0], size[1])),
    },
  });
  expect(first.status()).toBe(201);
  await page.reload();
  const status = page.getByTestId("marker-status");
  await expect(status).toContainText("Scale set at the first shot");
  await expect(status).toContainText("The card can come off the leather.");
  const button = page.getByRole("button", { name: "Capture", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByTestId("capture-roll-line")).toContainText("2 shots");

  // Read the card again: the next shot needs the card once more.
  await status.getByRole("button", { name: "Read the card again" }).click();
  await expect(status).toContainText("Show the marker card to capture.");
  await expect(button).toBeDisabled();
});
