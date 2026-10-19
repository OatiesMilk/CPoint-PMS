import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import type { ModelRunner } from "@/server/lib/cv/model-runner";

const ingest = {
  earlierCapture: vi.fn(async (): Promise<unknown> => null),
  ingestScan: vi.fn(async (..._args: unknown[]) => ({
    scanId: "scan1",
    batchId: "b1",
    batchCode: "B-2026-0001",
    sequence: 3,
    verdict: "REJECT",
    status: "DECIDED",
    duplicate: false,
  })),
};
const camera = {
  NO_BATCH_MESSAGE: "No batch is at Preparation. Start one on the Batches page, then scan again.",
  resolveCameraBatch: vi.fn(),
};
vi.mock("@/server/services/scan-ingest.service", () => ingest);
vi.mock("@/server/services/camera.service", () => camera);
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));

const { captureScan } = await import("@/server/services/capture.service");

const batch = (id: string, code: string) => ({
  id,
  code,
  rollCode: "LR-1",
  shoeType: { name: "School Shoe" },
  selection: "oldest",
});
const IMAGE = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff]),
  type: { mime: "image/jpeg", ext: "jpg" },
} as const;
const FIELDS = {
  captureId: "0199f0a1-7c2e-4a51-9d3f-2b8c4e6a1f00",
  batchId: "b1",
  source: "WEBCAM" as const,
};
const USER = { id: "user-qi" };
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
  camera.resolveCameraBatch.mockImplementation(async (id?: string) =>
    id === undefined || id === "b1" ? batch("b1", "B-2026-0001") : null,
  );
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
        batchId: "b1",
        captureId: FIELDS.captureId,
        modelVersion: "yolo-v1-1d729fb0",
        source: "WEBCAM",
        capturedAt: undefined,
      },
      { kind: "website", userId: "user-qi" },
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

  it("refuses with no batch at Preparation", async () => {
    camera.resolveCameraBatch.mockResolvedValue(null);
    await expect(captureScan(IMAGE, FIELDS, USER, fakeRunner())).rejects.toMatchObject({
      status: 409,
      code: "NO_BATCH_AT_PREPARATION",
    });
  });

  it("refuses before the model runs when the batch shown has left Preparation", async () => {
    camera.resolveCameraBatch.mockImplementation(async (id?: string) => {
      if (id) throw new AppError(409, "CONFLICT", "That batch isn't in progress at Preparation.");
      return batch("b2", "B-2026-0002");
    });
    const runner = fakeRunner();
    const error = await captureScan(IMAGE, FIELDS, USER, runner).catch((e: unknown) => e);
    expect(error).toMatchObject({
      status: 409,
      code: "BATCH_MOVED",
      message: expect.stringMatching(/The next scan goes to B-2026-0002\. Press Capture again\./),
      details: { current: { batchId: "b2", batchCode: "B-2026-0002" } },
    });
    expect(runner.detect).not.toHaveBeenCalled();
  });

  it("sends to the batch it showed while that batch is still at Preparation", async () => {
    camera.resolveCameraBatch.mockImplementation(async (id?: string) =>
      id ? batch(id, "B-2026-0001") : batch("b2", "B-2026-0002"),
    );
    await captureScan(IMAGE, FIELDS, USER, fakeRunner());
    expect(ingest.ingestScan.mock.calls[0][0]).toMatchObject({ batchId: "b1" });
  });
});
