import { beforeEach, describe, expect, it, vi } from "vitest";

const batchModel = {
  findPreparationBatchById: vi.fn(),
  listBatchesAtPreparation: vi.fn(async () => []),
};
const cv = { getCvSettings: vi.fn(), updateActiveBatch: vi.fn() };
const scans = { findLatestScan: vi.fn() };
const tokens = { findLatestUsedCameraToken: vi.fn() };

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/batch.model", () => batchModel);
vi.mock("@/server/models/cv-settings.model", () => cv);
vi.mock("@/server/models/scan.model", () => scans);
vi.mock("@/server/models/api-token.model", () => tokens);
vi.mock("@/server/models/db", () => ({ runInTransaction: vi.fn() }));
vi.mock("@/server/services/audit.service", () => ({ recordAudit: vi.fn() }));

const { cameraStatus } = await import("@/server/services/camera.service");

const now = new Date("2026-10-19T08:00:00Z");
const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000);
const scan = (source: string, s: number) => ({
  id: "s1",
  createdAt: secondsAgo(s),
  source,
  modelVersion: "yolo-v1-1d729fb0",
  deviceToken: { name: "Prep station" },
});
const token = (s: number, lastSource = "WEBCAM") => ({
  id: "t1",
  name: "Prep station",
  lastUsedAt: secondsAgo(s),
  scans: [{ source: lastSource }],
});

beforeEach(() => {
  vi.clearAllMocks();
  cv.getCvSettings.mockResolvedValue({ activeBatchId: null, earlyModelNotice: true });
  scans.findLatestScan.mockResolvedValue(null);
  tokens.findLatestUsedCameraToken.mockResolvedValue(null);
});

describe("cameraStatus (D-054)", () => {
  it("is not connected with no scans and no check-in", async () => {
    const s = await cameraStatus(now);
    expect(s).toMatchObject({ state: "not_connected", lastScan: null, station: null });
  });

  it("is a camera station when a station scan arrived in the last minute", async () => {
    scans.findLatestScan.mockResolvedValue(scan("WEBCAM", 30));
    tokens.findLatestUsedCameraToken.mockResolvedValue(token(30));
    const s = await cameraStatus(now);
    expect(s.state).toBe("camera");
    expect(s.lastScan?.modelVersion).toBe("yolo-v1-1d729fb0");
  });

  it("waits between captures while the station keeps checking in", async () => {
    scans.findLatestScan.mockResolvedValue(scan("WEBCAM", 600));
    tokens.findLatestUsedCameraToken.mockResolvedValue(token(90));
    const s = await cameraStatus(now);
    expect(s).toMatchObject({ state: "waiting", station: { name: "Prep station" } });
  });

  it("waits before the first capture too", async () => {
    tokens.findLatestUsedCameraToken.mockResolvedValue({ ...token(10), scans: [] });
    expect((await cameraStatus(now)).state).toBe("waiting");
  });

  it("is not connected once the last check-in is over 2 minutes old", async () => {
    scans.findLatestScan.mockResolvedValue(scan("WEBCAM", 600));
    tokens.findLatestUsedCameraToken.mockResolvedValue(token(121));
    expect((await cameraStatus(now)).state).toBe("not_connected");
  });

  it("doesn't read a finished simulator run as a waiting station", async () => {
    scans.findLatestScan.mockResolvedValue(scan("SIMULATOR", 90));
    tokens.findLatestUsedCameraToken.mockResolvedValue(token(90, "SIMULATOR"));
    expect((await cameraStatus(now)).state).toBe("not_connected");
    scans.findLatestScan.mockResolvedValue(scan("SIMULATOR", 5));
    expect((await cameraStatus(now)).state).toBe("simulator");
  });

  it("passes the early-model setting through", async () => {
    cv.getCvSettings.mockResolvedValue({ activeBatchId: null, earlyModelNotice: false });
    expect((await cameraStatus(now)).earlyModelNotice).toBe(false);
  });
});
