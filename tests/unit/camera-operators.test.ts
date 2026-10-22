import { beforeEach, describe, expect, it, vi } from "vitest";

const users = {
  findUserById: vi.fn(),
  listCameraOperatorCandidates: vi.fn(),
  setCanCapture: vi.fn(),
};
const audit = { recordAudit: vi.fn() };

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/batch.model", () => ({}));
vi.mock("@/server/models/cv-settings.model", () => ({}));
vi.mock("@/server/models/scan.model", () => ({}));
vi.mock("@/server/models/user.model", () => users);
vi.mock("@/server/models/db", () => ({
  runInTransaction: vi.fn(async (fn: (tx: object) => unknown) => fn({})),
}));
vi.mock("@/server/services/audit.service", () => audit);

const { setCameraOperator } = await import("@/server/services/camera.service");

const FM = { id: "fm", role: "FLOOR_MANAGER" as const };
const constructor = (over: object = {}) => ({
  id: "sc1",
  email: "sc1@cpoint.local",
  role: "SHOE_CONSTRUCTOR",
  isActive: true,
  canCapture: false,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("allowing a constructor to capture (D-075)", () => {
  it("turns the switch on with one audit row", async () => {
    users.findUserById.mockResolvedValue(constructor());
    await expect(setCameraOperator("sc1", true, FM)).resolves.toEqual({
      id: "sc1",
      canCapture: true,
    });
    expect(users.setCanCapture).toHaveBeenCalledWith("sc1", true, {});
    expect(audit.recordAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "camera.capture_access.grant",
        before: { email: "sc1@cpoint.local", canCapture: false },
        after: { email: "sc1@cpoint.local", canCapture: true },
      }),
    );
  });

  it("writes nothing when the switch is already set", async () => {
    users.findUserById.mockResolvedValue(constructor({ canCapture: true }));
    await setCameraOperator("sc1", true, FM);
    expect(users.setCanCapture).not.toHaveBeenCalled();
    expect(audit.recordAudit).not.toHaveBeenCalled();
  });

  it("is for the Floor Manager and the System Admin only", async () => {
    await expect(
      setCameraOperator("sc1", true, { id: "qi", role: "QUALITY_INSPECTOR" }),
    ).rejects.toMatchObject({ status: 403 });
    users.findUserById.mockResolvedValue(constructor());
    await expect(
      setCameraOperator("sc1", true, { id: "ad", role: "SYSTEM_ADMIN" }),
    ).resolves.toMatchObject({ canCapture: true });
  });

  it("refuses anyone but an active Shoe Constructor, saying why", async () => {
    users.findUserById.mockResolvedValue(constructor({ role: "QUALITY_INSPECTOR" }));
    await expect(setCameraOperator("sc1", true, FM)).rejects.toThrow(
      /Only an active Shoe Constructor/,
    );
    users.findUserById.mockResolvedValue(constructor({ isActive: false }));
    await expect(setCameraOperator("sc1", true, FM)).rejects.toThrow(
      /Only an active Shoe Constructor/,
    );
    users.findUserById.mockResolvedValue(null);
    await expect(setCameraOperator("sc1", true, FM)).rejects.toMatchObject({ status: 404 });
  });
});
