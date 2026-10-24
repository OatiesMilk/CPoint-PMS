import { beforeEach, describe, expect, it, vi } from "vitest";

const batches = {
  findBatchById: vi.fn(),
  findBatchDetail: vi.fn(),
  insertBatch: vi.fn(async (data: Record<string, unknown>) => ({ id: "b1", ...data })),
  updateBatchFields: vi.fn(async (id: string, data: Record<string, unknown>) => ({ id, ...data })),
  transitionBatch: vi.fn(async () => true),
  nextBatchNumber: vi.fn(async () => 7),
  listBatches: vi.fn(),
};
const logs = { openStageLog: vi.fn(), closeOpenStageLog: vi.fn() };
const refs = {
  findShoeType: vi.fn(async () => ({ id: "st1", isActive: true })),
  findSupplier: vi.fn(async () => ({ id: "sp1", isActive: true })),
  listActiveShoeTypes: vi.fn(),
  listActiveSuppliers: vi.fn(),
};
const recordAudit = vi.fn();

const inventory = {
  findInventoryItem: vi.fn(),
  applyStockDelta: vi.fn(async () => true),
  insertMovement: vi.fn(async () => ({ id: "m1" })),
  listRollMovementsForBatch: vi.fn(async () => [] as unknown[]),
  listRollItemsInStock: vi.fn(async () => []),
};

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/inventory.model", () => inventory);
vi.mock("@/server/models/batch.model", () => batches);
vi.mock("@/server/models/stage-log.model", () => logs);
vi.mock("@/server/models/reference-data.model", () => refs);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/batch.service");

const actor = { id: "fm1" };
const now = new Date("2026-10-02T08:00:00.000Z");
const values = {
  rollCode: "ROLL-88",
  shoeTypeId: "0199a000-0000-7000-8000-000000000001",
  receivedAt: "2026-10-01",
};

function batch(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    code: "B-2026-0007",
    status: "IN_PROGRESS",
    currentStage: "UPPER_MAKING",
    shoeTypeId: values.shoeTypeId,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("batch codes", () => {
  it("pads the yearly number to four digits", () => {
    expect(svc.formatBatchCode(2026, 7)).toBe("B-2026-0007");
    expect(svc.formatBatchCode(2026, 12345)).toBe("B-2026-12345");
  });

  it("numbers by the Manila year, so a New Year's Eve shift after 8 PM UTC counts as next year", async () => {
    await svc.createBatch(values, actor, new Date("2026-12-31T17:00:00.000Z"));
    expect(batches.nextBatchNumber).toHaveBeenCalledWith(2027, "tx");
    expect(batches.insertBatch).toHaveBeenCalledWith(
      expect.objectContaining({ code: "B-2027-0007" }),
      "tx",
    );
  });
});

describe("createBatch", () => {
  it("stores the date as a calendar date and audits the creation in the same transaction", async () => {
    await svc.createBatch(values, actor, now);
    expect(batches.insertBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rollCode: "ROLL-88",
        receivedAt: new Date("2026-10-01T00:00:00.000Z"),
        supplierId: null,
        createdById: "fm1",
      }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "batch.create", entityId: "b1" }),
    );
  });

  it("rejects an inactive shoe type", async () => {
    refs.findShoeType.mockResolvedValueOnce({ id: "st1", isActive: false });
    await expect(svc.createBatch(values, actor, now)).rejects.toMatchObject({ status: 422 });
    expect(batches.insertBatch).not.toHaveBeenCalled();
  });
});

describe("updateBatch", () => {
  it("locks the shoe type after production starts", async () => {
    batches.findBatchById.mockResolvedValue(batch());
    await expect(
      svc.updateBatch(
        "b1",
        { ...values, shoeTypeId: "0199a000-0000-7000-8000-000000000002" },
        actor,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("refuses edits to a completed batch", async () => {
    batches.findBatchById.mockResolvedValue(
      batch({ status: "COMPLETED", currentStage: "FINISHING" }),
    );
    await expect(svc.updateBatch("b1", values, actor)).rejects.toMatchObject({ status: 409 });
  });

  it("audits before and after", async () => {
    batches.findBatchById.mockResolvedValue(
      batch({ status: "PLANNED", currentStage: "PREPARATION" }),
    );
    await svc.updateBatch("b1", { ...values, notes: "Grade A" }, actor);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "batch.update",
        before: expect.anything(),
        after: expect.objectContaining({ notes: "Grade A" }),
      }),
    );
  });
});

describe("transitionBatchStage (the roll lifecycle, D-082)", () => {
  it("start opens Preparation without closing anything", async () => {
    batches.findBatchById.mockResolvedValue(
      batch({ status: "PLANNED", currentStage: "PREPARATION" }),
    );
    const result = await svc.transitionBatchStage(
      "b1",
      { action: "start", expectedStage: "PREPARATION" },
      actor,
      now,
    );
    expect(result).toEqual({
      code: "B-2026-0007",
      status: "IN_PROGRESS",
      currentStage: "PREPARATION",
    });
    expect(logs.closeOpenStageLog).not.toHaveBeenCalled();
    expect(logs.openStageLog).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "PREPARATION" }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "batch.start" }),
    );
  });

  it("finish roll closes the open log, opens nothing and audits batch.finish", async () => {
    batches.findBatchById.mockResolvedValue(batch({ currentStage: "PREPARATION" }));
    const result = await svc.finishRoll("b1", { expectedStage: "PREPARATION" }, actor, now);
    expect(result).toEqual({
      code: "B-2026-0007",
      status: "COMPLETED",
      currentStage: "PREPARATION",
    });
    expect(batches.transitionBatch).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ status: "IN_PROGRESS", currentStage: "PREPARATION" }),
      { status: "COMPLETED", currentStage: "PREPARATION" },
      "tx",
    );
    expect(logs.closeOpenStageLog).toHaveBeenCalledWith("b1", "fm1", now, "tx");
    expect(logs.openStageLog).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "batch.finish",
        before: { status: "IN_PROGRESS", currentStage: "PREPARATION" },
      }),
    );
  });

  it("finishes a batch started before rolls were tracked, where it is", async () => {
    batches.findBatchById.mockResolvedValue(batch({ currentStage: "UPPER_MAKING" }));
    const result = await svc.finishRoll("b1", { expectedStage: "UPPER_MAKING" }, actor, now);
    expect(result.status).toBe("COMPLETED");
    expect(result.currentStage).toBe("UPPER_MAKING");
  });

  it("returns 409 STALE when the page showed another stage", async () => {
    batches.findBatchById.mockResolvedValue(batch({ currentStage: "SOLEING" }));
    await expect(
      svc.finishRoll("b1", { expectedStage: "PREPARATION" }, actor, now),
    ).rejects.toMatchObject({ status: 409, code: "STALE" });
    expect(batches.transitionBatch).not.toHaveBeenCalled();
  });

  it("returns 409 STALE when someone else finished it between read and write", async () => {
    batches.findBatchById.mockResolvedValue(batch({ currentStage: "PREPARATION" }));
    batches.transitionBatch.mockResolvedValueOnce(false);
    await expect(
      svc.finishRoll("b1", { expectedStage: "PREPARATION" }, actor, now),
    ).rejects.toMatchObject({
      status: 409,
      code: "STALE",
      message: "This roll was already changed by someone else. Refresh to see where it is now.",
    });
    expect(logs.closeOpenStageLog).not.toHaveBeenCalled();
  });

  it("refuses a roll that is already finished as a 409 conflict", async () => {
    batches.findBatchById.mockResolvedValue(
      batch({ status: "COMPLETED", currentStage: "PREPARATION" }),
    );
    await expect(
      svc.finishRoll("b1", { expectedStage: "PREPARATION" }, actor, now),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "This roll is already finished.",
    });
  });

  it("refuses to finish a planned roll", async () => {
    batches.findBatchById.mockResolvedValue(
      batch({ status: "PLANNED", currentStage: "PREPARATION" }),
    );
    await expect(
      svc.finishRoll("b1", { expectedStage: "PREPARATION" }, actor, now),
    ).rejects.toMatchObject({ status: 409, message: "Start the roll first." });
  });

  it("404s for an unknown batch", async () => {
    batches.findBatchById.mockResolvedValue(null);
    await expect(
      svc.finishRoll("nope", { expectedStage: "PREPARATION" }, actor, now),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("cancelBatch", () => {
  it("closes the open log and stores the reason", async () => {
    batches.findBatchById.mockResolvedValue(batch());
    await svc.cancelBatch("b1", { reason: "Roll returned to supplier" }, actor, now);
    expect(batches.transitionBatch).toHaveBeenCalledWith(
      "b1",
      expect.anything(),
      {
        status: "CANCELLED",
        currentStage: "UPPER_MAKING",
        cancelledReason: "Roll returned to supplier",
      },
      "tx",
    );
    expect(logs.closeOpenStageLog).toHaveBeenCalled();
    expect(logs.openStageLog).not.toHaveBeenCalled();
  });
});

describe("finishing and cancelling (Phase 25: no Repair Station)", () => {
  it("finishes a roll at Preparation", async () => {
    batches.findBatchById.mockResolvedValue(batch({ currentStage: "PREPARATION" }));
    await svc.finishRoll("b1", { expectedStage: "PREPARATION" }, actor, now);
    expect(batches.transitionBatch).toHaveBeenCalled();
  });

  it("cancels a batch with no repair rows to close", async () => {
    batches.findBatchById.mockResolvedValue(batch());
    await svc.cancelBatch("b1", { reason: "Roll returned" }, actor, now);
    expect(recordAudit).not.toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "rework.cancel" }),
    );
  });
});

describe("leather roll from inventory (D-023)", () => {
  const roll = (quantityOnHand: number) => ({
    id: "0199a000-0000-7000-8000-0000000000aa",
    sku: "LR-001",
    name: "Black cowhide",
    category: "LEATHER_ROLL",
    unit: "roll",
    quantityOnHand,
    reorderLevel: 1,
    isActive: true,
  });

  it("takes one roll in the batch-create transaction, linked to the batch", async () => {
    inventory.findInventoryItem.mockResolvedValue(roll(3));
    await svc.createBatch({ ...values, rollItemId: roll(3).id }, actor, now);
    expect(inventory.applyStockDelta).toHaveBeenCalledWith(roll(3).id, -1, { min: 1 }, "tx");
    expect(inventory.insertMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OUT",
        quantityDelta: -1,
        batchId: "b1",
        reason: "Used for batch B-2026-0007",
      }),
      "tx",
    );
  });

  it("fails the whole create with a field error when no roll is left", async () => {
    inventory.findInventoryItem.mockResolvedValue(roll(0));
    inventory.applyStockDelta.mockResolvedValueOnce(false);
    await expect(
      svc.createBatch({ ...values, rollItemId: roll(0).id }, actor, now),
    ).rejects.toMatchObject({
      status: 422,
      details: [{ path: ["rollItemId"], message: expect.stringContaining("Only 0 rolls") }],
    });
    expect(inventory.insertMovement).not.toHaveBeenCalled();
  });

  it("refuses an item that isn't an active leather roll", async () => {
    inventory.findInventoryItem.mockResolvedValue({ ...roll(5), category: "NAILS" });
    await expect(
      svc.createBatch({ ...values, rollItemId: roll(5).id }, actor, now),
    ).rejects.toMatchObject({ status: 422 });
    expect(batches.insertBatch).not.toHaveBeenCalled();
  });

  const taken = [
    {
      id: "m1",
      type: "OUT",
      quantityDelta: -1,
      item: { id: "r1", sku: "LR-001", name: "Black", unit: "roll" },
    },
  ];

  it("returns the roll when a planned batch is cancelled", async () => {
    batches.findBatchById.mockResolvedValue(
      batch({ status: "PLANNED", currentStage: "PREPARATION" }),
    );
    inventory.listRollMovementsForBatch.mockResolvedValueOnce(taken);
    inventory.findInventoryItem.mockResolvedValue({ ...roll(2), id: "r1" });
    await svc.cancelBatch("b1", { reason: "Order cancelled" }, actor, now);
    expect(inventory.insertMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "r1",
        type: "IN",
        quantityDelta: 1,
        reason: "Returned: batch B-2026-0007 cancelled before production",
      }),
      "tx",
    );
  });

  it("keeps the roll used once production has started", async () => {
    batches.findBatchById.mockResolvedValue(batch());
    inventory.listRollMovementsForBatch.mockResolvedValue(taken);
    await svc.cancelBatch("b1", { reason: "Roll returned" }, actor, now);
    expect(inventory.insertMovement).not.toHaveBeenCalled();
    inventory.listRollMovementsForBatch.mockResolvedValue([]);
  });
});
