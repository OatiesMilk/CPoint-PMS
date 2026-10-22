import { beforeEach, describe, expect, it, vi } from "vitest";

const batchModel = {
  findPreparationBatchById: vi.fn(),
  listBatchesAtPreparation: vi.fn(async () => []),
};
const cv = { getCvSettings: vi.fn(), updateActiveBatch: vi.fn() };
const scans = { findLatestScan: vi.fn() };

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/batch.model", () => batchModel);
vi.mock("@/server/models/cv-settings.model", () => cv);
vi.mock("@/server/models/scan.model", () => scans);
vi.mock("@/server/models/db", () => ({ runInTransaction: vi.fn() }));
vi.mock("@/server/services/audit.service", () => ({ recordAudit: vi.fn() }));

const { cameraStatus } = await import("@/server/services/camera.service");

const now = new Date("2026-10-19T08:00:00Z");
const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000);
const scan = (source: string, s: number, device: string | null = null) => ({
  id: "s1",
  createdAt: secondsAgo(s),
  source,
  modelVersion: "yolo-v1-1d729fb0",
  deviceToken: device ? { name: device } : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  cv.getCvSettings.mockResolvedValue({ activeBatchId: null, earlyModelNotice: true });
  scans.findLatestScan.mockResolvedValue(null);
});

describe("cameraStatus (Phase 20: no station check-in)", () => {
  it("is idle with no scans", async () => {
    const s = await cameraStatus(now);
    expect(s).toMatchObject({ state: "idle", lastScan: null });
  });

  it("is capturing when a Capture page scan arrived in the last minute", async () => {
    scans.findLatestScan.mockResolvedValue(scan("WEBCAM", 30));
    const s = await cameraStatus(now);
    expect(s.state).toBe("capturing");
    expect(s.lastScan).toMatchObject({ device: null, modelVersion: "yolo-v1-1d729fb0" });
  });

  it("names the device token when a recent scan came with one", async () => {
    scans.findLatestScan.mockResolvedValue(scan("WEBCAM", 30, "Prep camera"));
    const s = await cameraStatus(now);
    expect(s).toMatchObject({ state: "capturing", lastScan: { device: "Prep camera" } });
  });

  it("is idle once the last scan is over a minute old", async () => {
    scans.findLatestScan.mockResolvedValue(scan("PHONE", 61));
    expect((await cameraStatus(now)).state).toBe("idle");
  });

  it("tells the simulator apart, and goes idle after it stops", async () => {
    scans.findLatestScan.mockResolvedValue(scan("SIMULATOR", 5, "Simulator"));
    expect((await cameraStatus(now)).state).toBe("simulator");
    scans.findLatestScan.mockResolvedValue(scan("SIMULATOR", 90, "Simulator"));
    expect((await cameraStatus(now)).state).toBe("idle");
  });

  it("passes the early-model setting through", async () => {
    cv.getCvSettings.mockResolvedValue({ activeBatchId: null, earlyModelNotice: false });
    expect((await cameraStatus(now)).earlyModelNotice).toBe(false);
  });
});
