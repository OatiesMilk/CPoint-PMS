import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import type { ModelRunner } from "@/server/lib/cv/model-runner";

const ingest = {
  earlierCapture: vi.fn(async (): Promise<unknown> => null),
  ingestScan: vi.fn(async (..._args: unknown[]) => ({
    scanId: "scan1",
    rollId: "b1",
    rollCode: "R-2026-0001",
    sequence: 3,
    verdict: "REJECT",
    duplicate: false,
    defects: [],
  })),
  rollScaleFor: vi.fn(async (..._args: unknown[]) => ({ widthIn: 16.84, shot: 1 })),
};
const rolls = { resolveCaptureRoll: vi.fn() };
vi.mock("@/server/services/scan-ingest.service", () => ingest);
vi.mock("@/server/services/roll.service", () => rolls);
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));

const { captureScan } = await import("@/server/services/capture.service");

const IMAGE = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff]),
  type: { mime: "image/jpeg", ext: "jpg" },
} as const;
const FIELDS = {
  captureId: "0199f0a1-7c2e-4a51-9d3f-2b8c4e6a1f00",
  rollId: "b1",
  source: "WEBCAM" as const,
  markerCorners: [
    [
      { x: 0.4, y: 0.4 },
      { x: 0.5, y: 0.4 },
      { x: 0.5, y: 0.5 },
      { x: 0.4, y: 0.5 },
    ],
  ] as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ][],
};
const USER = { id: "user-sc" };
const SEEN = [
  { classKey: "cut", confidence: 0.91, box: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } },
];

function fakeRunner(state: "ready" | "missing" = "ready"): ModelRunner & {
  detect: ReturnType<typeof vi.fn>;
} {
  return {
    status: async () =>
      state === "ready"
        ? { state, modelVersion: "yolo-v1-1d729fb0" }
        : { state, message: "The camera model isn't installed on the server." },
    detect: vi.fn(async () => ({
      detections: SEEN,
      modelVersion: "yolo-v1-1d729fb0",
      inferenceMs: 700,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rolls.resolveCaptureRoll.mockResolvedValue({
    id: "b1",
    code: "R-2026-0001",
    selection: "chosen",
  });
});

describe("captureScan", () => {
  it("runs the model, then the one decision path with the website as the origin", async () => {
    const runner = fakeRunner();
    const result = await captureScan(IMAGE, FIELDS, USER, runner);

    expect(runner.detect).toHaveBeenCalledWith(IMAGE.bytes);
    expect(ingest.ingestScan).toHaveBeenCalledWith(
      {
        image: IMAGE,
        detections: SEEN,
        rollId: "b1",
        captureId: FIELDS.captureId,
        modelVersion: "yolo-v1-1d729fb0",
        source: "WEBCAM",
        capturedAt: undefined,
        markerCorners: FIELDS.markerCorners,
        scaleFromRoll: true,
      },
      { kind: "website", userId: "user-sc" },
      expect.any(Date),
    );
    expect(result).toMatchObject({ scanId: "scan1", verdict: "REJECT", detections: SEEN });
  });

  it("answers a repeat without running the model again", async () => {
    ingest.earlierCapture.mockResolvedValueOnce({ scanId: "scan-first", duplicate: true });
    const runner = fakeRunner();
    const result = await captureScan(IMAGE, FIELDS, USER, runner);
    expect(result).toMatchObject({ scanId: "scan-first", duplicate: true, detections: [] });
    expect(runner.detect).not.toHaveBeenCalled();
    expect(ingest.ingestScan).not.toHaveBeenCalled();
  });

  it("answers 503 with the fix when the model isn't installed", async () => {
    await expect(captureScan(IMAGE, FIELDS, USER, fakeRunner("missing"))).rejects.toMatchObject({
      status: 503,
      code: "MODEL_UNAVAILABLE",
    });
    expect(ingest.ingestScan).not.toHaveBeenCalled();
  });

  it("checks the chosen roll from the website, before the model runs", async () => {
    await captureScan(IMAGE, FIELDS, USER, fakeRunner());
    expect(rolls.resolveCaptureRoll).toHaveBeenCalledWith("b1", "website");
  });

  it("a shot without the card needs the roll's scale, checked before the model runs (D-121)", async () => {
    const noCard = { ...FIELDS, markerCorners: undefined };
    await captureScan(IMAGE, noCard, USER, fakeRunner());
    expect(ingest.rollScaleFor).toHaveBeenCalledWith("b1", null);
    expect(ingest.ingestScan).toHaveBeenCalledWith(
      expect.objectContaining({ markerCorners: null, scaleFromRoll: true }),
      expect.anything(),
      expect.any(Date),
    );

    ingest.rollScaleFor.mockRejectedValueOnce(
      new AppError(422, "MARKER_REQUIRED", "markerCorners is required for this shot: …"),
    );
    const runner = fakeRunner();
    await expect(captureScan(IMAGE, noCard, USER, runner)).rejects.toMatchObject({
      status: 422,
      code: "MARKER_REQUIRED",
    });
    expect(runner.detect).not.toHaveBeenCalled();
  });

  it("with the card, doesn't look up the roll's scale", async () => {
    await captureScan(IMAGE, FIELDS, USER, fakeRunner());
    expect(ingest.rollScaleFor).not.toHaveBeenCalled();
  });

  it("refuses without a chosen roll (Phase 26)", async () => {
    rolls.resolveCaptureRoll.mockRejectedValue(
      new AppError(409, "NO_ROLL_CHOSEN", "Choose the roll this shot belongs to."),
    );
    const runner = fakeRunner();
    await expect(
      captureScan(IMAGE, { ...FIELDS, rollId: undefined }, USER, runner),
    ).rejects.toMatchObject({ status: 409, code: "NO_ROLL_CHOSEN" });
    expect(runner.detect).not.toHaveBeenCalled();
  });

  it("refuses before the model runs when the chosen roll was finished or cancelled", async () => {
    rolls.resolveCaptureRoll.mockRejectedValue(
      new AppError(409, "ROLL_CLOSED", "R-2026-0001 is finished or cancelled."),
    );
    const runner = fakeRunner();
    await expect(captureScan(IMAGE, FIELDS, USER, runner)).rejects.toMatchObject({
      status: 409,
      code: "ROLL_CLOSED",
    });
    expect(runner.detect).not.toHaveBeenCalled();
    expect(ingest.ingestScan).not.toHaveBeenCalled();
  });
});
