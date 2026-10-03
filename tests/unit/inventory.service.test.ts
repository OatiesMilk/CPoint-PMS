import { beforeEach, describe, expect, it, vi } from "vitest";

const inventory = {
  applyStockDelta: vi.fn(async () => true),
  findInventoryItem: vi.fn(),
  findInventoryItemBySku: vi.fn(async () => null),
  findMovement: vi.fn(),
  findReversal: vi.fn(async () => null),
  insertInventoryItem: vi.fn(),
  insertMovement: vi.fn(async () => ({ id: "m1" })),
  listInventoryItems: vi.fn(),
  listItemCodes: vi.fn(async () => [] as string[]),
  listMovements: vi.fn(),
  listRollItemsInStock: vi.fn(async () => []),
  listRollMovementsForBatch: vi.fn(async () => []),
  lowStockItems: vi.fn(),
  sumNewerDeltas: vi.fn(async () => 0),
  updateInventoryItem: vi.fn(),
};
const recordAudit = vi.fn();
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/inventory.model", () => inventory);
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
};

beforeEach(() => vi.clearAllMocks());

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

describe("recordMovement", () => {
  it("uses stock with a guard against going below zero, and audits it", async () => {
    inventory.findInventoryItem.mockResolvedValue(row());
    const result = await svc.recordMovement("i1", { type: "OUT", quantity: 3 }, actor, now);
    expect(inventory.applyStockDelta).toHaveBeenCalledWith("i1", -3, { min: 3 }, "tx");
    expect(result).toMatchObject({ onHandAfter: 1, message: "Used 3 rolls of Black cowhide." });
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "inventory.movement.out",
        before: { quantityOnHand: 4 },
        after: expect.objectContaining({ change: -3, quantityOnHand: 1 }),
      }),
    );
  });

  it("refuses using more than is on hand before touching the database", async () => {
    inventory.findInventoryItem.mockResolvedValue(row({ quantityOnHand: 1 }));
    await expect(
      svc.recordMovement("i1", { type: "OUT", quantity: 2 }, actor, now),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Only 1 roll") });
    expect(inventory.applyStockDelta).not.toHaveBeenCalled();
  });

  it("answers 409 when another usage took the stock first (conditional update missed)", async () => {
    inventory.findInventoryItem
      .mockResolvedValueOnce(row({ quantityOnHand: 2 }))
      .mockResolvedValueOnce(row({ quantityOnHand: 0 }));
    inventory.applyStockDelta.mockResolvedValueOnce(false);
    await expect(
      svc.recordMovement("i1", { type: "OUT", quantity: 2 }, actor, now),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Only 0 rolls") });
    expect(inventory.insertMovement).not.toHaveBeenCalled();
  });

  it("applies a stock count only to the stock the counter saw", async () => {
    inventory.findInventoryItem.mockResolvedValue(row());
    await svc.recordMovement(
      "i1",
      { type: "ADJUST", counted: 3, expectedQuantity: 4, reason: "Monthly count" },
      actor,
      now,
    );
    expect(inventory.applyStockDelta).toHaveBeenCalledWith("i1", -1, { expected: 4 }, "tx");

    inventory.applyStockDelta.mockResolvedValueOnce(false);
    await expect(
      svc.recordMovement(
        "i1",
        { type: "ADJUST", counted: 3, expectedQuantity: 4, reason: "Monthly count" },
        actor,
        now,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });

  it("refuses movements on a deactivated item", async () => {
    inventory.findInventoryItem.mockResolvedValue(row({ isActive: false }));
    await expect(
      svc.recordMovement("i1", { type: "IN", quantity: 1 }, actor, now),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("reverseMovement (Undo)", () => {
  const movement = (overrides: Record<string, unknown> = {}) => ({
    id: "m1",
    itemId: "i1",
    type: "IN",
    quantityDelta: 3,
    reason: "Delivery received",
    createdAt: new Date(now.getTime() - 5_000),
    batch: null,
    createdBy: { name: "FM" },
    item: row({ quantityOnHand: 7 }),
    ...overrides,
  });

  it("records the opposite movement with an Undo note", async () => {
    inventory.findMovement.mockResolvedValue(movement());
    await svc.reverseMovement("m1", actor, now);
    expect(inventory.insertMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OUT",
        quantityDelta: -3,
        reason: "Undo: Delivery received",
      }),
      "tx",
    );
  });

  it("refuses stock counts, old entries and double undo", async () => {
    inventory.findMovement.mockResolvedValueOnce(movement({ type: "ADJUST" }));
    await expect(svc.reverseMovement("m1", actor, now)).rejects.toMatchObject({ status: 409 });
    inventory.findMovement.mockResolvedValueOnce(
      movement({ createdAt: new Date(now.getTime() - 3_600_000) }),
    );
    await expect(svc.reverseMovement("m1", actor, now)).rejects.toMatchObject({ status: 409 });
    inventory.findMovement.mockResolvedValueOnce(movement());
    inventory.findReversal.mockResolvedValueOnce({ id: "m2" } as never);
    await expect(svc.reverseMovement("m1", actor, now)).rejects.toMatchObject({
      message: "This entry was already undone.",
    });
    expect(inventory.insertMovement).not.toHaveBeenCalled();
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
      batch: null,
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
