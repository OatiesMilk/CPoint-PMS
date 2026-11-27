import { beforeEach, describe, expect, it, vi } from "vitest";

const row = (over: object = {}) => ({
  id: "t1",
  code: "BLC",
  supplierId: "sp1",
  isDefault: false,
  isActive: true,
  createdAt: new Date("2026-11-26T00:00:00Z"),
  supplier: { id: "sp1", name: "Bulacan Supplier A" },
  _count: { rolls: 0 },
  ...over,
});
const model = {
  listRollTags: vi.fn(async (): Promise<unknown[]> => []),
  findRollTag: vi.fn(async (): Promise<unknown> => row()),
  findRollTagByCode: vi.fn(async (): Promise<unknown> => null),
  findDefaultRollTag: vi.fn(async (): Promise<unknown> => null),
  insertRollTag: vi.fn(async (data: object) => row(data)),
  updateRollTag: vi.fn(async (_id: string, data: object) => row(data)),
  deleteRollTag: vi.fn(async (..._args: unknown[]) => undefined),
  clearOtherDefaults: vi.fn(async (..._args: unknown[]) => 0),
  countRollsMadeFrom: vi.fn(async (..._args: unknown[]) => 0),
};
const refs = {
  findSupplier: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({
    id: "sp1",
    name: "Bulacan Supplier A",
    isActive: true,
  })),
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/roll-tag.model", () => model);
vi.mock("@/server/models/reference-data.model", () => refs);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/roll-tag.service");
const FM = { id: "fm1" };

beforeEach(() => {
  vi.clearAllMocks();
  model.findRollTag.mockResolvedValue(row());
  model.findRollTagByCode.mockResolvedValue(null);
  model.countRollsMadeFrom.mockResolvedValue(0);
  refs.findSupplier.mockResolvedValue({ id: "sp1", name: "Bulacan Supplier A", isActive: true });
});

describe("addRollTag (Phase 42, D-139)", () => {
  it("adds a tag with its audit row in the same transaction, naming the supplier and no people", async () => {
    const tag = await svc.addRollTag({ code: "BLC", supplierId: "sp1", isDefault: false }, FM);
    expect(model.insertRollTag).toHaveBeenCalledWith(
      { code: "BLC", supplierId: "sp1", isDefault: false },
      "tx",
    );
    expect(tag).toMatchObject({ code: "BLC", supplierName: "Bulacan Supplier A", rolls: 0 });
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll_tag.create",
        entity: "RollTag",
        after: { code: "BLC", supplier: "Bulacan Supplier A", isDefault: false, isActive: true },
      }),
    );
    expect(model.clearOtherDefaults).not.toHaveBeenCalled();
  });

  it("makes a default the supplier's only one", async () => {
    await svc.addRollTag({ code: "BLC", supplierId: "sp1", isDefault: true }, FM);
    expect(model.clearOtherDefaults).toHaveBeenCalledWith("sp1", null, "tx");
    expect(model.insertRollTag).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: true }),
      "tx",
    );
  });

  it("refuses a code another tag has, under the code field, before saving", async () => {
    model.findRollTagByCode.mockResolvedValueOnce(row());
    await expect(
      svc.addRollTag({ code: "BLC", supplierId: null, isDefault: false }, FM),
    ).rejects.toMatchObject({
      status: 422,
      details: [{ path: ["code"], message: "BLC is already a roll tag. Choose another code." }],
    });
    expect(model.insertRollTag).not.toHaveBeenCalled();
  });

  it("turns the unique index race into the same field error", async () => {
    model.insertRollTag.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(
      svc.addRollTag({ code: "BLC", supplierId: null, isDefault: false }, FM),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["code"] }] });
  });

  it("needs a supplier for a default, and an active one", async () => {
    await expect(
      svc.addRollTag({ code: "BLC", supplierId: null, isDefault: true }, FM),
    ).rejects.toMatchObject({ details: [{ path: ["isDefault"] }] });
    refs.findSupplier.mockResolvedValueOnce({ id: "sp1", name: "Old", isActive: false });
    await expect(
      svc.addRollTag({ code: "BLC", supplierId: "sp1", isDefault: true }, FM),
    ).rejects.toMatchObject({ details: [{ path: ["supplierId"] }] });
    refs.findSupplier.mockResolvedValueOnce(null);
    await expect(
      svc.addRollTag({ code: "BLC", supplierId: "sp1", isDefault: false }, FM),
    ).rejects.toMatchObject({ details: [{ path: ["supplierId"] }] });
    expect(model.insertRollTag).not.toHaveBeenCalled();
  });
});

describe("editRollTag", () => {
  it("changes the code while no roll was made from it, and audits before and after", async () => {
    await svc.editRollTag("t1", { code: "BLX" }, FM);
    expect(model.updateRollTag).toHaveBeenCalledWith("t1", { code: "BLX" }, "tx");
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll_tag.update",
        before: expect.objectContaining({ code: "BLC" }),
        after: expect.objectContaining({ code: "BLX" }),
      }),
    );
  });

  it("locks the code once a roll was made from it", async () => {
    model.countRollsMadeFrom.mockResolvedValue(2);
    await expect(svc.editRollTag("t1", { code: "BLX" }, FM)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("2 rolls were made from BLC"),
    });
    expect(model.updateRollTag).not.toHaveBeenCalled();
  });

  it("checks the lock again inside the transaction", async () => {
    model.countRollsMadeFrom.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(svc.editRollTag("t1", { code: "BLX" }, FM)).rejects.toMatchObject({
      status: 409,
    });
    expect(model.updateRollTag).not.toHaveBeenCalled();
  });

  it("refuses a code another tag has", async () => {
    model.findRollTagByCode.mockResolvedValueOnce(row({ id: "t2", code: "BLX" }));
    await expect(svc.editRollTag("t1", { code: "BLX" }, FM)).rejects.toMatchObject({
      status: 422,
      details: [{ path: ["code"] }],
    });
  });

  it("changes the supplier and default even after rolls used it, and clears the supplier's other default", async () => {
    model.countRollsMadeFrom.mockResolvedValue(5);
    await svc.editRollTag("t1", { isDefault: true }, FM);
    expect(model.clearOtherDefaults).toHaveBeenCalledWith("sp1", "t1", "tx");
    expect(model.updateRollTag).toHaveBeenCalledWith("t1", { isDefault: true }, "tx");
  });

  it("moves a default tag to another supplier and makes it that supplier's one default", async () => {
    model.findRollTag.mockResolvedValue(row({ isDefault: true }));
    refs.findSupplier.mockResolvedValue({ id: "sp2", name: "Other", isActive: true });
    await svc.editRollTag("t1", { supplierId: "sp2" }, FM);
    expect(model.clearOtherDefaults).toHaveBeenCalledWith("sp2", "t1", "tx");
  });

  it("won't leave a default with no supplier", async () => {
    model.findRollTag.mockResolvedValue(row({ isDefault: true }));
    await expect(svc.editRollTag("t1", { supplierId: null }, FM)).rejects.toMatchObject({
      details: [{ path: ["isDefault"] }],
    });
  });

  it("deactivates a tag (it stops being a default) and reactivates it, each with its audit action", async () => {
    model.findRollTag.mockResolvedValue(row({ isDefault: true }));
    await svc.editRollTag("t1", { isActive: false }, FM);
    expect(model.updateRollTag).toHaveBeenLastCalledWith(
      "t1",
      { isActive: false, isDefault: false },
      "tx",
    );
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({ action: "roll_tag.deactivate" }),
    );
    model.findRollTag.mockResolvedValue(row({ isActive: false }));
    await svc.editRollTag("t1", { isActive: true }, FM);
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({ action: "roll_tag.reactivate" }),
    );
  });

  it("won't make a deactivated tag a default", async () => {
    model.findRollTag.mockResolvedValue(row({ isActive: false }));
    await expect(svc.editRollTag("t1", { isDefault: true }, FM)).rejects.toMatchObject({
      details: [{ path: ["isDefault"] }],
    });
  });

  it("answers 404 for a tag that doesn't exist", async () => {
    model.findRollTag.mockResolvedValue(null);
    await expect(svc.editRollTag("t1", { isActive: false }, FM)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("removeRollTag", () => {
  it("removes a tag no roll was made from, with its audit row", async () => {
    await svc.removeRollTag("t1", FM);
    expect(model.deleteRollTag).toHaveBeenCalledWith("t1", "tx");
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll_tag.delete",
        entity: "RollTag",
        before: expect.objectContaining({ code: "BLC" }),
      }),
    );
  });

  it("refuses a tag in use and says to deactivate it instead", async () => {
    model.countRollsMadeFrom.mockResolvedValue(1);
    await expect(svc.removeRollTag("t1", FM)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Deactivate it instead"),
    });
    expect(model.deleteRollTag).not.toHaveBeenCalled();
  });

  it("checks again inside the transaction", async () => {
    model.countRollsMadeFrom.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(svc.removeRollTag("t1", FM)).rejects.toMatchObject({ status: 409 });
    expect(model.deleteRollTag).not.toHaveBeenCalled();
  });
});

describe("a supplier's first tag", () => {
  it("is its short code, as its default, audited when someone made it", async () => {
    const tag = await svc.seedSupplierTag(
      { id: "sp1", name: "Bulacan Supplier A", code: "BSA" },
      "tx" as never,
      FM,
    );
    expect(model.insertRollTag).toHaveBeenCalledWith(
      { code: "BSA", supplierId: "sp1", isDefault: true },
      "tx",
    );
    expect(tag).toMatchObject({ code: "BSA", isDefault: true });
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "roll_tag.create" }),
    );
  });

  it("is skipped, with no audit, when a tag has that code already or no actor is given", async () => {
    model.findRollTagByCode.mockResolvedValueOnce(row({ code: "BSA" }));
    expect(
      await svc.seedSupplierTag({ id: "sp1", name: "X", code: "BSA" }, "tx" as never, FM),
    ).toBeNull();
    expect(model.insertRollTag).not.toHaveBeenCalled();
    await svc.seedSupplierTag({ id: "sp1", name: "X", code: "BSB" }, "tx" as never);
    expect(model.insertRollTag).toHaveBeenCalledTimes(1);
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

describe("listing", () => {
  it("lists tags for the manager with their lock, and the active ones as dropdown options", async () => {
    model.listRollTags.mockResolvedValue([
      row({ _count: { rolls: 3 } }),
      row({ id: "t2", code: "MLT", supplierId: null, supplier: null, isDefault: true }),
    ]);
    const forManager = await svc.listRollTagsForManager();
    expect(forManager.map((t) => [t.code, t.codeLocked])).toEqual([
      ["BLC", true],
      ["MLT", false],
    ]);
    const options = await svc.listRollTagOptions();
    expect(model.listRollTags).toHaveBeenLastCalledWith({ activeOnly: true });
    expect(options[1]).toEqual({
      id: "t2",
      code: "MLT",
      supplierId: null,
      supplierName: null,
      isDefault: true,
    });
  });

  it("ensureRollTag keeps an existing tag and adds a missing one", async () => {
    model.findRollTagByCode.mockResolvedValueOnce(row());
    await svc.ensureRollTag({ code: "BLC", supplierId: null, isDefault: false }, FM);
    expect(model.insertRollTag).not.toHaveBeenCalled();
    await svc.ensureRollTag({ code: "BLC", supplierId: null, isDefault: false }, FM);
    expect(model.insertRollTag).toHaveBeenCalledTimes(1);
  });
});
