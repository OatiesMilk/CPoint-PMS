import { beforeEach, describe, expect, it, vi } from "vitest";

const inventory = {
  applyStockDelta: vi.fn(async () => true),
  findInventoryItem: vi.fn(),
  findInventoryItemBySku: vi.fn(async () => null),
  insertInventoryItem: vi.fn(),
  insertMovement: vi.fn(async () => ({ id: "m1" })),
  listInventoryItems: vi.fn(),
  listItemCodes: vi.fn(async () => [] as string[]),
  listMovements: vi.fn(),
  listRollItemsInStock: vi.fn(async () => []),
  listRollMovementsForRoll: vi.fn(async () => []),
  lowStockItems: vi.fn(),
  sumNewerDeltas: vi.fn(async () => 0),
  updateInventoryItem: vi.fn(),
};
const recordAudit = vi.fn();
const findSupplier = vi.fn();
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/inventory.model", () => inventory);
vi.mock("@/server/models/reference-data.model", () => ({ findSupplier }));
vi.mock("@/server/models/stock-update.model", () => ({
  lastUpdatedAt: vi.fn(async () => new Map()),
}));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/inventory.service");
const actor = { id: "fm1" };
const now = new Date("2026-10-03T08:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  sku: "LR-001",
  name: "Black cowhide",
  category: "LEATHER_ROLL",
  unit: "roll",
  quantityOnHand: 4,
  reorderLevel: 2,
  supplierId: "s1",
  supplier: { id: "s1", name: "Meycauayan Tannery" },
  isActive: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
const form = {
  sku: "LR-001",
  name: "Black cowhide",
  category: "LEATHER_ROLL" as const,
  unit: "roll",
  reorderLevel: 2,
  supplierId: "s1",
};

beforeEach(() => {
  vi.resetAllMocks();
  inventory.applyStockDelta.mockResolvedValue(true);
  inventory.findInventoryItemBySku.mockResolvedValue(null);
  inventory.insertMovement.mockResolvedValue({ id: "m1" });
  inventory.sumNewerDeltas.mockResolvedValue(0);
  findSupplier.mockResolvedValue({ id: "s1", isActive: true });
});

describe("items", () => {
  it("records opening stock as an IN movement in the create transaction", async () => {
    inventory.insertInventoryItem.mockResolvedValue(row({ quantityOnHand: 0 }));
    await svc.createItem({ ...form, openingStock: 5 }, actor, now);
    expect(inventory.applyStockDelta).toHaveBeenCalledWith("i1", 5, {}, "tx");
    expect(inventory.insertMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "IN", quantityDelta: 5, reason: "Opening stock" }),
      "tx",
    );
    expect(recordAudit.mock.calls.map((c) => c[1].action)).toEqual([
      "inventory.item.create",
      "inventory.movement.in",
    ]);
  });

  it("refuses a code another item uses, as a field error", async () => {
    inventory.findInventoryItemBySku.mockResolvedValueOnce({ id: "other" } as never);
    await expect(svc.createItem(form, actor, now)).rejects.toMatchObject({
      status: 422,
      details: [expect.objectContaining({ path: ["sku"] })],
    });
    expect(inventory.insertInventoryItem).not.toHaveBeenCalled();
  });

  it("never changes the quantity on edit", async () => {
    inventory.findInventoryItem.mockResolvedValue(row());
    inventory.updateInventoryItem.mockResolvedValue(row({ name: "Brown" }));
    await svc.updateItem("i1", { ...form, name: "Brown", openingStock: 99 }, actor);
    const data = inventory.updateInventoryItem.mock.calls[0][1];
    expect(data).not.toHaveProperty("quantityOnHand");
    expect(data).not.toHaveProperty("openingStock");
  });

  it("suggests the next code per category", async () => {
    inventory.listItemCodes.mockResolvedValueOnce(["NL-001", "NL-004"]);
    expect(await svc.suggestItemCode("NAILS")).toBe("NL-005");
    expect(inventory.listItemCodes).toHaveBeenCalledWith("NL");
  });
});

describe("leather roll supplier (Phase 29, D-102)", () => {
  it("saves the supplier on a leather roll", async () => {
    inventory.insertInventoryItem.mockResolvedValue(row());
    await svc.createItem(form, actor, now);
    expect(inventory.insertInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: "s1" }),
      "tx",
    );
  });

  it("refuses a supplier that is no longer active, as a field error", async () => {
    findSupplier.mockResolvedValueOnce({ id: "s1", isActive: false });
    await expect(svc.createItem(form, actor, now)).rejects.toMatchObject({
      status: 422,
      details: [expect.objectContaining({ path: ["supplierId"] })],
    });
  });

  it("keeps an item's deactivated supplier when it isn't changed", async () => {
    inventory.findInventoryItem.mockResolvedValue(row());
    inventory.updateInventoryItem.mockResolvedValue(row({ name: "Brown" }));
    findSupplier.mockResolvedValue({ id: "s1", isActive: false });
    await svc.updateItem("i1", { ...form, name: "Brown" }, actor);
    expect(findSupplier).not.toHaveBeenCalled();
  });
});

describe("postMovement", () => {
  const item = { id: "i1", sku: "NL-001", name: "Tacks", unit: "box", quantityOnHand: 4 };

  it("applies an Update stock line only to the stock the sheet saw, and never below zero", async () => {
    await svc.postMovement(
      "tx" as never,
      item,
      { type: "OUT", delta: -3, reason: "Used on the line", updateId: "u1" },
      actor,
      now,
    );
    expect(inventory.applyStockDelta).toHaveBeenCalledWith("i1", -3, { expected: 4, min: 3 }, "tx");
    expect(inventory.insertMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OUT", quantityDelta: -3, updateId: "u1" }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "inventory.movement.out",
        after: expect.objectContaining({ change: -3, quantityOnHand: 1 }),
      }),
    );
  });

  it("is STALE, naming the item, when the stock moved since the sheet loaded", async () => {
    inventory.applyStockDelta.mockResolvedValueOnce(false);
    inventory.findInventoryItem.mockResolvedValueOnce(row({ quantityOnHand: 9 }));
    await expect(
      svc.postMovement(
        "tx" as never,
        item,
        { type: "IN", delta: 2, reason: "Added", updateId: "u1" },
        actor,
        now,
      ),
    ).rejects.toMatchObject({ code: "STALE", message: expect.stringContaining("Tacks changed") });
    expect(inventory.insertMovement).not.toHaveBeenCalled();
  });

  it("refuses a deactivated item", async () => {
    inventory.applyStockDelta.mockResolvedValueOnce(false);
    inventory.findInventoryItem.mockResolvedValueOnce(row({ isActive: false }));
    await expect(
      svc.postMovement("tx" as never, item, { type: "IN", delta: 1, reason: "x" }, actor, now),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("deactivated") });
  });
});

describe("getItemDetail", () => {
  it("shows the balance after each entry, walking back from today's stock", async () => {
    inventory.findInventoryItem.mockResolvedValue(row({ quantityOnHand: 4 }));
    const m = (id: string, quantityDelta: number) => ({
      id,
      itemId: "i1",
      type: quantityDelta > 0 ? "IN" : "OUT",
      quantityDelta,
      reason: "x",
      createdAt: now,
      roll: null,
      createdBy: { name: "FM" },
    });
    inventory.listMovements.mockResolvedValue({
      rows: [m("c", -1), m("b", 3), m("a", 2)],
      total: 3,
    });
    const detail = await svc.getItemDetail("i1");
    expect(detail?.movements.map((x) => x.balanceAfter)).toEqual([4, 5, 2]);
  });
});
