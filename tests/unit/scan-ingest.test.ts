import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sniffImageType } from "@/server/lib/image-type";
import { createLocalStorage } from "@/server/lib/storage";
import { ingestFieldsSchema } from "@/server/validators/scan.validator";

const batchModel = {
  findPreparationBatchById: vi.fn(),
  listBatchesAtPreparation: vi.fn(),
  lockBatchRow: vi.fn(),
};
const cv = { getCvSettings: vi.fn(), updateActiveBatch: vi.fn() };
const scans = {
  nextScanSequence: vi.fn(async () => 4),
  insertScanWithDetections: vi.fn(
    async (data: Record<string, unknown>, _detections: Record<string, unknown>[]) => ({
      id: "scan1",
      ...data,
    }),
  ),
  findLatestScan: vi.fn(),
  findScanByCaptureId: vi.fn(async (_captureId: string): Promise<unknown> => null),
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/batch.model", () => batchModel);
vi.mock("@/server/models/cv-settings.model", () => cv);
vi.mock("@/server/models/scan.model", () => scans);
vi.mock("@/server/models/reference-data.model", () => ({
  listDefectTypes: async () => [
    { id: "t-cut", key: "cut", label: "Cut", isActive: true, outcome: "NOT_ACCEPTED" },
    { id: "t-hole", key: "hole", label: "Hole", isActive: true, outcome: "NOT_ACCEPTED" },
    { id: "t-crease", key: "crease", label: "Crease", isActive: true, outcome: "USABLE" },
  ],
}));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const { ingestScan } = await import("@/server/services/scan-ingest.service");
const { resolveCameraBatch } = await import("@/server/services/camera.service");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const prep = (id: string, startedAt = "2026-10-02T01:00:00Z") => ({
  id,
  code: `B-2026-${id}`,
  rollCode: "LR-1",
  status: "IN_PROGRESS",
  currentStage: "PREPARATION",
  shoeType: { name: "School Shoe" },
  stageLogs: [{ startedAt: new Date(startedAt) }],
});
const memoryStorage = () => {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    put: vi.fn(async (k: string, d: Uint8Array) => void files.set(k, d)),
    read: vi.fn(),
    remove: vi.fn(async (k: string) => void files.delete(k)),
  };
};
const now = new Date("2026-10-02T08:00:00.000Z");
const det = (classKey: string, confidence: number) => ({
  classKey,
  confidence,
  box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
});

beforeEach(() => {
  vi.clearAllMocks();
  cv.getCvSettings.mockResolvedValue({ foundAtOrAbove: 0.5, activeBatchId: null });
  batchModel.listBatchesAtPreparation.mockResolvedValue([prep("0001")]);
});

describe("image checks", () => {
  it("recognises JPEG, PNG and WebP by magic bytes only", () => {
    expect(sniffImageType(JPEG)?.mime).toBe("image/jpeg");
    expect(
      sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext,
    ).toBe("png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.ext).toBe("webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("ingest fields", () => {
  it("parses detections JSON and defaults the source", () => {
    const f = ingestFieldsSchema.parse({ detections: JSON.stringify([det("cut", 0.7)]) });
    expect(f.source).toBe("WEBCAM");
    expect(f.detections[0].classKey).toBe("cut");
  });

  it.each([
    ["not json", "{oops"],
    [
      "box outside the image",
      JSON.stringify([{ ...det("cut", 0.7), box: { x: 0.9, y: 0, width: 0.3, height: 0.1 } }]),
    ],
    ["confidence over 1", JSON.stringify([det("cut", 1.2)])],
  ])("rejects %s", (_label, detections) => {
    expect(ingestFieldsSchema.safeParse({ detections }).success).toBe(false);
  });
  it("accepts an optional captureId and names the field when it isn't a UUID", () => {
    const id = "0199f0a1-7c2e-7a51-9d3f-2b8c4e6a1f00";
    expect(ingestFieldsSchema.parse({ captureId: id }).captureId).toBe(id);
    expect(ingestFieldsSchema.parse({}).captureId).toBeUndefined();
    const bad = ingestFieldsSchema.safeParse({ captureId: "capture-7" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toMatch(/^captureId must be a UUID/);
  });
});

describe("local storage", () => {
  it("writes inside its root and refuses keys that escape it", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cpoint-"));
    const storage = createLocalStorage(root);
    await storage.put("scans/2026/10/a.jpg", JPEG);
    expect(await readFile(path.join(root, "scans/2026/10/a.jpg"))).toEqual(Buffer.from(JPEG));
    await expect(storage.put("../escape.jpg", JPEG)).rejects.toThrow(/unsafe/);
    await expect(storage.put("/etc/passwd", JPEG)).rejects.toThrow(/unsafe/);
    await expect(storage.put("scans/2026/10/a.jpg", JPEG)).rejects.toThrow(); // never overwrites
  });
});

describe("resolveCameraBatch (D-020)", () => {
  it("prefers the batch picked on the Camera page", async () => {
    cv.getCvSettings.mockResolvedValue({ activeBatchId: "0002" });
    batchModel.findPreparationBatchById.mockResolvedValue(prep("0002"));
    expect(await resolveCameraBatch()).toMatchObject({ id: "0002", selection: "selected" });
  });

  it("falls back to the oldest batch at Preparation when the picked one has moved on", async () => {
    cv.getCvSettings.mockResolvedValue({ activeBatchId: "0002" });
    batchModel.findPreparationBatchById.mockResolvedValue({
      ...prep("0002"),
      currentStage: "UPPER_MAKING",
    });
    expect(await resolveCameraBatch()).toMatchObject({ id: "0001", selection: "oldest" });
  });

  it("returns null when nothing is at Preparation", async () => {
    batchModel.listBatchesAtPreparation.mockResolvedValue([]);
    expect(await resolveCameraBatch()).toBeNull();
  });

  it("refuses an explicit batch that isn't at Preparation", async () => {
    batchModel.findPreparationBatchById.mockResolvedValue({ ...prep("0003"), status: "PLANNED" });
    await expect(resolveCameraBatch("0003")).rejects.toMatchObject({ status: 409 });
  });
});

describe("ingestScan", () => {
  const ingest = (detections: ReturnType<typeof det>[], storage = memoryStorage()) =>
    ingestScan(
      {
        image: { bytes: JPEG, type: { mime: "image/jpeg", ext: "jpg" } },
        detections,
        source: "SIMULATOR",
      },
      { id: "tok1" },
      now,
      storage,
    );

  it("stores the image, numbers the scan under a row lock and snapshots the rule", async () => {
    const storage = memoryStorage();
    const result = await ingest([det("cut", 0.3)], storage);
    expect(result).toEqual({
      scanId: "scan1",
      batchId: "0001",
      batchCode: "B-2026-0001",
      sequence: 4,
      verdict: "PASS",
      duplicate: false,
    });
    expect(batchModel.lockBatchRow).toHaveBeenCalledWith("0001", "tx");
    const [data, detections] = scans.insertScanWithDetections.mock.calls[0];
    expect(data).toMatchObject({
      imagePath: expect.stringMatching(/^scans\/2026\/10\/[0-9a-f-]{36}\.jpg$/),
      thresholdsSnapshot: {
        foundAtOrAbove: 0.5,
        outcomes: { cut: "NOT_ACCEPTED", hole: "NOT_ACCEPTED", crease: "USABLE" },
      },
      aiVerdict: "PASS",
      finalVerdict: "PASS",
      deviceTokenId: "tok1",
    });
    expect(detections[0]).toMatchObject({
      defectTypeId: "t-cut",
      rawClassKey: "cut",
      isUnknownClass: false,
    });
    expect(storage.files.size).toBe(1);
  });

  it("gives Reject for a found Not accepted type and Pass for a Usable one, final at once", async () => {
    expect((await ingest([det("hole", 0.7)])).verdict).toBe("REJECT");
    expect(scans.insertScanWithDetections.mock.calls[0][0]).toMatchObject({
      aiVerdict: "REJECT",
      finalVerdict: "REJECT",
    });
    expect((await ingest([det("crease", 0.95)])).verdict).toBe("PASS");
    const data = scans.insertScanWithDetections.mock.calls[1][0];
    expect(data).toMatchObject({ aiVerdict: "PASS", finalVerdict: "PASS" });
    for (const gone of ["status", "decidedAt", "decidedById", "isOverride"])
      expect(data).not.toHaveProperty(gone);
  });

  it("rejects an unknown class and flags it (A-12)", async () => {
    const result = await ingest([det("scratch", 0.99)]);
    expect(result).toMatchObject({ verdict: "REJECT" });
    expect(result).not.toHaveProperty("status");
    const [data, detections] = scans.insertScanWithDetections.mock.calls[0];
    expect(data).toMatchObject({ aiVerdict: "REJECT", finalVerdict: "REJECT" });
    expect(detections[0]).toMatchObject({
      defectTypeId: null,
      rawClassKey: "scratch",
      isUnknownClass: true,
    });
  });

  it("answers 409 without storing anything when no batch is at Preparation", async () => {
    batchModel.listBatchesAtPreparation.mockResolvedValue([]);
    const storage = memoryStorage();
    await expect(ingest([], storage)).rejects.toMatchObject({ status: 409 });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("removes the stored image when the database write fails", async () => {
    scans.insertScanWithDetections.mockRejectedValueOnce(new Error("db down"));
    const storage = memoryStorage();
    await expect(ingest([], storage)).rejects.toThrow("db down");
    expect(storage.remove).toHaveBeenCalled();
    expect(storage.files.size).toBe(0);
  });

  it("audits the scan as the device", async () => {
    await ingest([det("cut", 0.95)]);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        actor: { type: "DEVICE", tokenId: "tok1" },
        action: "scan.create",
      }),
    );
  });
});

describe("ingestScan with a captureId (D-051)", () => {
  const CAPTURE = "0199f0a1-7c2e-7a51-9d3f-2b8c4e6a1f00";
  const ingest = (storage = memoryStorage(), device = { id: "tok1" }) =>
    ingestScan(
      {
        image: { bytes: JPEG, type: { mime: "image/jpeg", ext: "jpg" } },
        detections: [det("hole", 0.7)],
        source: "WEBCAM",
        captureId: CAPTURE,
      },
      device,
      now,
      storage,
    );
  const earlier = {
    id: "scan-first",
    sequence: 2,
    aiVerdict: "REJECT",
    deviceTokenId: "tok1",
    batch: { id: "0001", code: "B-2026-0001" },
  };

  it("stores the captureId on a new scan", async () => {
    const result = await ingest();
    expect(result.duplicate).toBe(false);
    expect(scans.insertScanWithDetections.mock.calls[0][0]).toMatchObject({ captureId: CAPTURE });
  });

  it("returns the first scan for a repeat and writes nothing", async () => {
    scans.findScanByCaptureId.mockResolvedValueOnce(earlier);
    const storage = memoryStorage();
    expect(await ingest(storage)).toEqual({
      scanId: "scan-first",
      batchId: "0001",
      batchCode: "B-2026-0001",
      sequence: 2,
      verdict: "REJECT",
      duplicate: true,
    });
    expect(storage.put).not.toHaveBeenCalled();
    expect(scans.insertScanWithDetections).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("returns the first scan even when its batch has since left Preparation", async () => {
    scans.findScanByCaptureId.mockResolvedValueOnce(earlier);
    batchModel.listBatchesAtPreparation.mockResolvedValue([]);
    expect(await ingest()).toMatchObject({ scanId: "scan-first", duplicate: true });
  });

  it("refuses another camera's captureId with 409", async () => {
    scans.findScanByCaptureId.mockResolvedValueOnce({ ...earlier, deviceTokenId: "tok2" });
    await expect(ingest()).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/Another camera already sent a scan with this captureId/),
    });
  });

  it("answers as the first copy when two copies race on the unique index", async () => {
    scans.findScanByCaptureId.mockResolvedValueOnce(null).mockResolvedValueOnce(earlier);
    scans.insertScanWithDetections.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    const storage = memoryStorage();
    expect(await ingest(storage)).toMatchObject({ scanId: "scan-first", duplicate: true });
    expect(storage.files.size).toBe(0);
  });
});

describe("ingestScan from the website's Capture page (Phase 18)", () => {
  const CAPTURE = "0199f0a1-7c2e-7a51-9d3f-2b8c4e6a1f01";
  const website = { kind: "website", userId: "user-qi" } as const;
  const ingest = () =>
    ingestScan(
      {
        image: { bytes: JPEG, type: { mime: "image/jpeg", ext: "jpg" } },
        detections: [det("cut", 0.95)],
        source: "PHONE",
        captureId: CAPTURE,
        modelVersion: "yolo-v1-1d729fb0",
      },
      website,
      now,
      memoryStorage(),
    );
  const earlier = {
    id: "scan-first",
    sequence: 2,
    aiVerdict: "REJECT",
    status: "DECIDED",
    deviceTokenId: null,
    batch: { id: "0001", code: "B-2026-0001" },
  };

  it("stores no device token and no person on the scan (D-008)", async () => {
    await ingest();
    const row = scans.insertScanWithDetections.mock.calls[0][0];
    expect(row).toMatchObject({ deviceTokenId: null, source: "PHONE", captureId: CAPTURE });
    expect(Object.keys(row).some((k) => /user|person|capturedBy/i.test(k))).toBe(false);
  });

  it("records the signed-in person in the audit log only", async () => {
    await ingest();
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        actor: { type: "USER", userId: "user-qi" },
        action: "scan.create",
        after: expect.objectContaining({ origin: "website", verdict: "REJECT" }),
      }),
    );
  });

  it("returns the first scan for a website repeat", async () => {
    scans.findScanByCaptureId.mockResolvedValueOnce(earlier);
    expect(await ingest()).toMatchObject({ scanId: "scan-first", duplicate: true });
    expect(scans.insertScanWithDetections).not.toHaveBeenCalled();
  });

  it("refuses a station's captureId sent from the website", async () => {
    scans.findScanByCaptureId.mockResolvedValueOnce({ ...earlier, deviceTokenId: "tok1" });
    await expect(ingest()).rejects.toMatchObject({ status: 409 });
  });
});
