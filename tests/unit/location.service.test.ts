import { beforeEach, describe, expect, it, vi } from "vitest";

const row = (over: object = {}) => ({
  id: "l1",
  code: "R1-B3",
  name: "Rack 1, bin 3",
  kind: "BIN",
  notes: null,
  isActive: true,
  sortOrder: 1,
  createdAt: new Date("2026-11-17T00:00:00Z"),
  _count: { rolls: 0 },
  ...over,
});
const model = {
  listLocations: vi.fn(async (): Promise<unknown[]> => []),
  findLocation: vi.fn(async (): Promise<unknown> => row()),
  findLocationByCode: vi.fn(async (): Promise<unknown> => null),
  insertLocation: vi.fn(async (data: object) => row(data)),
  updateLocation: vi.fn(async (_id: string, data: object) => row(data)),
  nextLocationSortOrder: vi.fn(async () => 4),
  countRollsIn: vi.fn(async () => 0),
  locationEverUsed: vi.fn(async () => false),
  listUsedLocationIds: vi.fn(async () => new Set<string>()),
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/location.model", () => model);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/location.service");
const FM = { id: "fm1" };

beforeEach(() => {
  vi.clearAllMocks();
  model.findLocation.mockResolvedValue(row());
  model.findLocationByCode.mockResolvedValue(null);
  model.countRollsIn.mockResolvedValue(0);
  model.locationEverUsed.mockResolvedValue(false);
});

describe("addLocation (Phase 32, D-128)", () => {
  it("adds it last, with its audit row in the same transaction", async () => {
    const added = await svc.addLocation(
      { code: "R1-B3", name: "Rack 1, bin 3", kind: "BIN", notes: null },
      FM,
    );
    expect(model.insertLocation).toHaveBeenCalledWith(
      expect.objectContaining({ code: "R1-B3", sortOrder: 4, createdById: "fm1" }),
      "tx",
    );
    expect(added).toMatchObject({ code: "R1-B3", rolls: 0, isActive: true });
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "location.add",
        entity: "StorageLocation",
        after: expect.objectContaining({ code: "R1-B3", kind: "BIN" }),
      }),
    );
  });

  it("refuses a code that is taken, under the code field", async () => {
    model.findLocationByCode.mockResolvedValueOnce(row());
    await expect(
      svc.addLocation({ code: "R1-B3", name: null, kind: "BIN", notes: null }, FM),
    ).rejects.toMatchObject({
      status: 422,
      details: [{ path: ["code"], message: "R1-B3 is already a location. Choose another code." }],
    });
    expect(model.insertLocation).not.toHaveBeenCalled();
  });
});

describe("editLocation", () => {
  it("renames it and audits before and after", async () => {
    await svc.editLocation("l1", { name: "Top shelf" }, FM);
    expect(model.updateLocation).toHaveBeenCalledWith("l1", { name: "Top shelf" }, "tx");
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "location.edit", before: expect.any(Object) }),
    );
  });

  it("keeps the code once rolls were kept there (A-79)", async () => {
    model.locationEverUsed.mockResolvedValueOnce(true);
    await expect(svc.editLocation("l1", { code: "R9-B9" }, FM)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/can’t change/),
    });
    expect(model.updateLocation).not.toHaveBeenCalled();
  });

  it("changes the code of a location never used, unless the new one is taken", async () => {
    await svc.editLocation("l1", { code: "R9-B9" }, FM);
    expect(model.updateLocation).toHaveBeenCalledWith("l1", { code: "R9-B9" }, "tx");
    model.findLocationByCode.mockResolvedValueOnce(row({ id: "l2", code: "R2-B1" }));
    await expect(svc.editLocation("l1", { code: "R2-B1" }, FM)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("deactivates only an empty location, and reactivates any", async () => {
    model.countRollsIn.mockResolvedValueOnce(2);
    await expect(svc.editLocation("l1", { isActive: false }, FM)).rejects.toMatchObject({
      status: 409,
      message: "R1-B3 still holds 2 rolls. Move them first.",
    });
    await svc.editLocation("l1", { isActive: false }, FM);
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({ action: "location.deactivate" }),
    );
    model.findLocation.mockResolvedValueOnce(row({ isActive: false }));
    await svc.editLocation("l1", { isActive: true }, FM);
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({ action: "location.reactivate" }),
    );
  });

  it("answers 404 for a location that doesn't exist", async () => {
    model.findLocation.mockResolvedValueOnce(null);
    await expect(svc.editLocation("nope", { name: "x" }, FM)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("listLocationsForManager", () => {
  it("marks the codes that are locked because rolls were kept there", async () => {
    model.listLocations.mockResolvedValueOnce([row(), row({ id: "l2", code: "R2-B1" })]);
    model.listUsedLocationIds.mockResolvedValueOnce(new Set(["l2"]));
    const list = await svc.listLocationsForManager();
    expect(list.map((l) => [l.code, l.codeLocked])).toEqual([
      ["R1-B3", false],
      ["R2-B1", true],
    ]);
  });
});
