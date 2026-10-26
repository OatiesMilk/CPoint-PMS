import { beforeEach, describe, expect, it, vi } from "vitest";

const model = {
  findItemsForUpdate: vi.fn(),
  getInventorySettings: vi.fn(async () => ({ reminderDays: [3, 5], updatedAt: new Date() })),
  insertStockUpdate: vi.fn(async () => ({ id: "u1" })),
  lastUpdatedAt: vi.fn(async () => new Map()),
  listRecentUpdates: vi.fn(async () => []),
  listSheetItems: vi.fn(async () => []),
  saveInventorySettings: vi.fn(async (d: { reminderDays: number[] }) => d),
  stockUpdateSavedOn: vi.fn(async () => false),
};
const postMovement = vi.fn(
  async (_tx: unknown, item: { quantityOnHand: number }, input: { delta: number }) => ({
    movementId: "m",
    onHandAfter: Math.round((item.quantityOnHand + input.delta) * 100) / 100,
  }),
);
const recordAudit = vi.fn();
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/stock-update.model", () => model);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/inventory.service", () => ({ postMovement }));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/stock-update.service");
const actor = { id: "fm1" };
// Wednesday 28 Oct 2026, 16:30 in Manila.
const now = new Date("2026-10-28T08:30:00.000Z");
const A = "0192f000-0000-7000-8000-00000000000a";
const B = "0192f000-0000-7000-8000-00000000000b";
const items = [
  { id: A, sku: "NL-001", name: "Tacks", unit: "box", quantityOnHand: 4, isActive: true },
  { id: B, sku: "TH-001", name: "Thread", unit: "spool", quantityOnHand: 10, isActive: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  model.findItemsForUpdate.mockResolvedValue(items);
});

describe("saveStockUpdate (Phase 29, D-102)", () => {
  it("saves every line in one transaction, in order, with one audit row", async () => {
    const result = await svc.saveStockUpdate(
      {
        lines: [
          { itemId: A, seenQuantity: 4, added: 6, used: 3, correction: -1, reason: "Recount" },
          { itemId: B, seenQuantity: 10, used: 2 },
        ],
      },
      actor,
      now,
    );
    expect(result).toEqual({ id: "u1", items: 2 });
    expect(model.insertStockUpdate).toHaveBeenCalledWith(
      { day: "2026-10-28", createdById: "fm1", note: null, createdAt: now },
      "tx",
    );
    // Each movement applies to the stock left by the one before it.
    expect(
      postMovement.mock.calls.map(([, item, input]) => {
        const i = input as { type: string; delta: number; updateId: string };
        return [(item as { quantityOnHand: number }).quantityOnHand, i.type, i.delta, i.updateId];
      }),
    ).toEqual([
      [4, "IN", 6, "u1"],
      [10, "OUT", -3, "u1"],
      [7, "ADJUST", -1, "u1"],
      [10, "OUT", -2, "u1"],
    ]);
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      action: "inventory.update",
      entity: "StockUpdate",
      entityId: "u1",
      after: {
        items: 2,
        entries: [
          { item: "NL-001 · Tacks", added: 6, used: 3, correction: -1, quantityOnHand: 6 },
          { item: "TH-001 · Thread", added: 0, used: 2, correction: 0, quantityOnHand: 8 },
        ],
      },
    });
  });

  it("refuses a leather roll line: its count follows its rolls (Phase 30A)", async () => {
    model.findItemsForUpdate.mockResolvedValue([
      ...items,
      {
        id: "0192f000-0000-7000-8000-00000000000c",
        sku: "LR-001",
        name: "Black cowhide",
        unit: "roll",
        quantityOnHand: 3,
        isActive: true,
        category: "LEATHER_ROLL",
      },
    ]);
    await expect(
      svc.saveStockUpdate(
        {
          lines: [
            { itemId: A, seenQuantity: 4, added: 1 },
            { itemId: "0192f000-0000-7000-8000-00000000000c", seenQuantity: 3, used: 1 },
          ],
        },
        actor,
        now,
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["lines", "0192f000-0000-7000-8000-00000000000c", "added"],
          message:
            "Black cowhide is counted from its rolls. Add or remove rolls on the item instead.",
        },
      ],
    });
    expect(model.insertStockUpdate).not.toHaveBeenCalled();
  });

  it("is STALE, naming the item, when its stock moved since the sheet loaded", async () => {
    await expect(
      svc.saveStockUpdate({ lines: [{ itemId: A, seenQuantity: 3, added: 1 }] }, actor, now),
    ).rejects.toMatchObject({
      code: "STALE",
      message: "Tacks changed while you were updating (now 4 boxes). Check it and save again.",
    });
    expect(model.insertStockUpdate).not.toHaveBeenCalled();
  });

  it("returns each line's problem under its own field and saves nothing", async () => {
    await expect(
      svc.saveStockUpdate(
        {
          lines: [
            { itemId: A, seenQuantity: 4, used: 9 },
            { itemId: B, seenQuantity: 10, correction: 1 },
          ],
        },
        actor,
        now,
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        { path: ["lines", A, "used"], message: expect.stringContaining("Only 4 boxes of Tacks") },
        { path: ["lines", B, "reason"], message: expect.stringContaining("Thread correction") },
      ],
    });
    expect(postMovement).not.toHaveBeenCalled();
  });
});

describe("the reminder (C-32)", () => {
  it("is due on a Wednesday until an update is saved", async () => {
    expect(await svc.stockUpdateReminder(now)).toEqual({ due: true, reminderDays: [3, 5] });
    model.stockUpdateSavedOn.mockResolvedValueOnce(true);
    expect((await svc.stockUpdateReminder(now)).due).toBe(false);
    // Thursday.
    expect((await svc.stockUpdateReminder(new Date("2026-10-29T02:00:00Z"))).due).toBe(false);
  });

  it("falls back to Wednesday and Friday with no settings row", async () => {
    model.getInventorySettings.mockResolvedValueOnce(null as never);
    expect(await svc.reminderDays()).toEqual([3, 5]);
  });

  it("saves new reminder days with an audit row", async () => {
    await svc.saveReminderDays([1, 4], actor);
    expect(model.saveInventorySettings).toHaveBeenCalledWith(
      { reminderDays: [1, 4], updatedById: "fm1" },
      "tx",
    );
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      action: "inventory.settings.update",
      before: { reminderDays: [3, 5] },
      after: { reminderDays: [1, 4] },
    });
  });
});
