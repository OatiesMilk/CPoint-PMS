import { beforeEach, describe, expect, it, vi } from "vitest";
import { Errors } from "@/server/lib/errors";

// GET /api/v1/scans/{id}/image (D-119): the Floor Manager only, checked on every load (run 1, F1).
const guard = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiCapture: vi.fn(),
  requireDevice: vi.fn(),
}));
const query = vi.hoisted(() => ({ getScanDetail: vi.fn() }));
const storage = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/server/policies/guard", () => guard);
vi.mock("@/server/services/scan-query.service", () => query);
vi.mock("@/server/lib/storage", () => ({ getStorage: () => storage }));
vi.mock("@/server/services/capture.service", () => ({ captureScan: vi.fn() }));
vi.mock("@/server/services/scan-ingest.service", () => ({ ingestScan: vi.fn() }));
vi.mock("@/server/services/camera.service", () => ({
  CAMERA_OPERATORS_FORBIDDEN: "Only the System Admin chooses who can capture.",
  setCameraOperator: vi.fn(),
}));

const { scanController } = await import("@/server/controllers/scan.controller");

const ID = "01a1ae64-e9f3-7602-b43d-a0ea8c973dce";
const ctx = { params: Promise.resolve({ id: ID }) };
const get = (headers: Record<string, string> = {}) =>
  scanController.image(new Request(`http://localhost/api/v1/scans/${ID}/image`, { headers }), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  guard.requireApiPermission.mockResolvedValue({ role: "FLOOR_MANAGER" });
  query.getScanDetail.mockResolvedValue({
    id: ID,
    imagePath: "scans/a.jpg",
    imageMime: "image/jpeg",
  });
  storage.read.mockResolvedValue(Buffer.from([1, 2, 3]));
});

describe("the scan image route", () => {
  it("asks for scan:read, the Floor Manager's permission", async () => {
    await get();
    expect(guard.requireApiPermission).toHaveBeenCalledWith("scan:read");
  });

  it("lets the browser keep a copy only if it asks again every time", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(res.headers.get("ETag")).toBe(`"${ID}"`);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("answers 304 without reading the file when the browser's copy is current", async () => {
    const res = await get({ "If-None-Match": `"${ID}"` });
    expect(res.status).toBe(304);
    expect(storage.read).not.toHaveBeenCalled();
  });

  it("refuses another role before anything else, even with a cached copy (403, not 304)", async () => {
    guard.requireApiPermission.mockRejectedValue(Errors.forbidden());
    const res = await get({ "If-None-Match": `"${ID}"` });
    expect(res.status).toBe(403);
    expect(query.getScanDetail).not.toHaveBeenCalled();
  });
});
