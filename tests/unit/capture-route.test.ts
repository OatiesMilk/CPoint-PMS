import { beforeEach, describe, expect, it, vi } from "vitest";
import { Errors } from "@/server/lib/errors";

const guard = {
  requireApiCapture: vi.fn(),
  requireApiPermission: vi.fn(),
  requireApiUser: vi.fn(),
  requireDevice: vi.fn(),
};
const capture = { captureScan: vi.fn() };
vi.mock("@/server/policies/guard", () => guard);
vi.mock("@/server/services/capture.service", () => capture);
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));

const { POST } = await import("@/app/api/v1/scans/capture/route");

const CAPTURE_ID = "0199f0a1-7c2e-4a51-9d3f-2b8c4e6a1f00";
const CARD = [
  [
    { x: 0.4, y: 0.4 },
    { x: 0.5, y: 0.4 },
    { x: 0.5, y: 0.5 },
    { x: 0.4, y: 0.5 },
  ],
];
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function request(fields: Record<string, string> = {}, image: Uint8Array | null = JPEG) {
  const form = new FormData();
  if (image)
    form.set("image", new Blob([image as BlobPart], { type: "image/jpeg" }), "capture.jpg");
  for (const [k, v] of Object.entries({
    captureId: CAPTURE_ID,
    markerCorners: JSON.stringify(CARD),
    ...fields,
  }))
    form.set(k, v);
  return new Request("http://localhost/api/v1/scans/capture", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  guard.requireApiCapture.mockResolvedValue({ id: "user-qi", role: "QUALITY_INSPECTOR" });
  capture.captureScan.mockResolvedValue({ scanId: "scan1", duplicate: false });
});

describe("POST /api/v1/scans/capture", () => {
  it("needs someone who may capture (D-075), and never a device token", async () => {
    const res = await POST(request());
    expect(res.status).toBe(201);
    expect(guard.requireApiCapture).toHaveBeenCalled();
    expect(guard.requireDevice).not.toHaveBeenCalled();
    expect(capture.captureScan).toHaveBeenCalledWith(
      { bytes: JPEG, type: { mime: "image/jpeg", ext: "jpg" } },
      { captureId: CAPTURE_ID, source: "WEBCAM", markerCorners: CARD },
      { id: "user-qi", role: "QUALITY_INSPECTOR" },
    );
  });

  it("answers 401 signed out and 403 for someone not allowed to capture", async () => {
    guard.requireApiCapture.mockRejectedValueOnce(Errors.unauthenticated());
    expect((await POST(request())).status).toBe(401);
    guard.requireApiCapture.mockRejectedValueOnce(Errors.forbidden());
    expect((await POST(request())).status).toBe(403);
    expect(capture.captureScan).not.toHaveBeenCalled();
  });

  it("answers a repeat with 200", async () => {
    capture.captureScan.mockResolvedValueOnce({ scanId: "scan1", duplicate: true });
    expect((await POST(request())).status).toBe(200);
  });

  it("names the field that's wrong", async () => {
    const missing = await POST(request({}, null));
    expect(missing.status).toBe(422);
    expect((await missing.json()).error.message).toMatch(/Attach the captured image/);

    const badId = await POST(request({ captureId: "capture-7" }));
    expect((await badId.json()).error.message).toMatch(/captureId must be the UUID/);

    const badSource = await POST(request({ source: "SIMULATOR" }));
    expect((await badSource.json()).error.message).toMatch(/source must be WEBCAM or PHONE/);

    // D-120: no marker card, no shot; nothing reaches the model.
    const noCard = await POST(request({ markerCorners: "" }));
    expect(noCard.status).toBe(422);
    expect((await noCard.json()).error.message).toMatch(/markerCorners is required/);
    expect(capture.captureScan).not.toHaveBeenCalled();
  });
});
