import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sniffImageType } from "@/server/lib/image-type";
import { createLocalStorage } from "@/server/lib/storage";
import { ingestFieldsSchema } from "@/server/validators/scan.validator";

const rollModel = { lockOpenRoll: vi.fn(async (..._args: unknown[]) => true) };
const rollService = { resolveCaptureRoll: vi.fn() };
const cv = { getCvSettings: vi.fn() };
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
vi.mock("@/server/models/roll.model", () => rollModel);
vi.mock("@/server/services/roll.service", () => rollService);
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

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
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
  cv.getCvSettings.mockResolvedValue({ foundAtOrAbove: 0.5 });
  rollService.resolveCaptureRoll.mockResolvedValue({
    id: "0001",
    code: "R-2026-0001",
    selection: "oldest",
  });
  rollModel.lockOpenRoll.mockResolvedValue(true);
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
      rollId: "0001",
      rollCode: "R-2026-0001",
      sequence: 4,
      verdict: "PASS",
      duplicate: false,
      defects: [{ label: "Cut", confidence: 0.3, effect: null, lengthIn: null }],
    });
    expect(rollService.resolveCaptureRoll).toHaveBeenCalledWith(undefined, "device");
    expect(rollModel.lockOpenRoll).toHaveBeenCalledWith("0001", "tx");
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
    });
    expect(detections[0]).not.toHaveProperty("isUnknownClass");
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

  it("drops a class with no defect type: not stored, no effect on the verdict (D-108)", async () => {
    const result = await ingest([det("scratch", 0.99), det("crease", 0.8)]);
    expect(result).toMatchObject({ verdict: "PASS" });
    expect(result.defects).toEqual([
      { label: "Crease", confidence: 0.8, effect: "USABLE", lengthIn: null },
    ]);
    const [data, detections] = scans.insertScanWithDetections.mock.calls[0];
    expect(data).toMatchObject({ aiVerdict: "PASS", finalVerdict: "PASS" });
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({ defectTypeId: "t-crease", rawClassKey: "crease" });
  });

  it("says what each found defect did, for the Capture page (Phase 26)", async () => {
    const result = await ingest([det("hole", 0.7), det("crease", 0.6), det("stain", 0.9)]);
    expect(result.defects).toEqual([
      { label: "Hole", confidence: 0.7, effect: "NOT_ACCEPTED", lengthIn: null },
      { label: "Crease", confidence: 0.6, effect: "USABLE", lengthIn: null },
    ]);
  });

  it("answers 409 without storing anything when no roll is open", async () => {
    rollService.resolveCaptureRoll.mockRejectedValue(
      Object.assign(new Error("No roll is open."), { status: 409, code: "NO_OPEN_ROLL" }),
    );
    const storage = memoryStorage();
    await expect(ingest([], storage)).rejects.toMatchObject({ status: 409 });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("refuses a shot when the roll was finished or cancelled meanwhile, and keeps no image", async () => {
    rollModel.lockOpenRoll.mockResolvedValue(false);
    const storage = memoryStorage();
    await expect(ingest([], storage)).rejects.toMatchObject({ status: 409, code: "ROLL_CLOSED" });
    expect(scans.insertScanWithDetections).not.toHaveBeenCalled();
    expect(storage.files.size).toBe(0);
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
    roll: { id: "0001", code: "R-2026-0001" },
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
      rollId: "0001",
      rollCode: "R-2026-0001",
      sequence: 2,
      verdict: "REJECT",
      duplicate: true,
      defects: [],
    });
    expect(storage.put).not.toHaveBeenCalled();
    expect(scans.insertScanWithDetections).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("returns the first scan even when its roll has since been finished", async () => {
    scans.findScanByCaptureId.mockResolvedValueOnce(earlier);
    rollService.resolveCaptureRoll.mockRejectedValue(new Error("closed"));
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
  const website = { kind: "website", userId: "user-sc" } as const;
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

  it("needs the roll chosen at Capture (Phase 26)", async () => {
    await ingest();
    expect(rollService.resolveCaptureRoll).toHaveBeenCalledWith(undefined, "website");
  });
  const earlier = {
    id: "scan-first",
    sequence: 2,
    aiVerdict: "REJECT",
    deviceTokenId: null,
    roll: { id: "0001", code: "R-2026-0001" },
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
        actor: { type: "USER", userId: "user-sc" },
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

describe("measuring at ingest (Phase 30C)", () => {
  it("stores each defect's length and area and the shot's union from the phone's calibration", async () => {
    const sharp = (await import("sharp")).default;
    // 2000 × 1000 px at 20 in across, so 10 in high: a 0.2 × 0.2 box is 4 × 2 in.
    const photo = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: "#7a4a26" },
    })
      .jpeg()
      .toBuffer();
    const result = await ingestScan(
      {
        image: { bytes: new Uint8Array(photo), type: { mime: "image/jpeg", ext: "jpg" } },
        detections: [
          det("hole", 0.9),
          { ...det("crease", 0.8), box: { x: 0.2, y: 0.1, width: 0.2, height: 0.2 } },
        ],
        source: "PHONE",
        widthIn: 20,
      },
      { id: "tok1" },
      now,
      memoryStorage(),
    );
    expect(result.defects[0].lengthIn).toBeCloseTo(Math.hypot(4, 2), 6);
    const [data, detections] = scans.insertScanWithDetections.mock.calls[0];
    expect(data).toMatchObject({
      imageWidth: 2000,
      imageHeight: 1000,
      widthIn: 20,
      flatSharePct: 0,
    });
    // Two 8 sq in boxes that overlap by 4 sq in: 12 sq in, the overlap counted once (C-35).
    expect(data.defectAreaSqIn).toBeCloseTo(12, 6);
    expect(detections[0].areaSqIn).toBeCloseTo(8, 6);
    expect(data.thresholdsSnapshot).toMatchObject({
      widthIn: 20,
      lengthLimits: {},
      flatShares: {},
    });
  });

  it("measures nothing from a phone that isn't calibrated", async () => {
    await ingestScan(
      {
        image: { bytes: JPEG, type: { mime: "image/jpeg", ext: "jpg" } },
        detections: [det("hole", 0.9)],
        source: "SIMULATOR",
      },
      { id: "tok1" },
      now,
      memoryStorage(),
    );
    const [data, detections] = scans.insertScanWithDetections.mock.calls[0];
    expect(data).toMatchObject({ widthIn: null, defectAreaSqIn: null, flatSharePct: null });
    expect(detections[0]).toMatchObject({ lengthIn: null, areaSqIn: null });
  });
});
