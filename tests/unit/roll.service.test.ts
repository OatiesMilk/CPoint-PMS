import { beforeEach, describe, expect, it, vi } from "vitest";

const rolls = {
  listRolls: vi.fn(),
  countVerdictsForRolls: vi.fn(async (): Promise<unknown[]> => []),
  countDefectsForRolls: vi.fn(async (): Promise<unknown[]> => []),
  countOpenRolls: vi.fn(async () => 0),
  findRollDetail: vi.fn(),
  listOpenRolls: vi.fn(async (): Promise<unknown[]> => []),
  listReadyRolls: vi.fn(async (): Promise<unknown[]> => []),
  listRollsUsedIn: vi.fn(async (): Promise<unknown[]> => []),
  findRollState: vi.fn(),
  insertRoll: vi.fn(),
  moveRoll: vi.fn(async (..._args: unknown[]) => true),
  nextRollCodeNumber: vi.fn(async () => 7),
  rollCodeTaken: vi.fn(async () => false),
  listRollShotMeasures: vi.fn(
    async (): Promise<{ defectAreaSqIn: number | null; flatSharePct: number | null }[]> => [],
  ),
  saveRollMeasure: vi.fn(async () => ({})),
};
const refs = {
  findSupplier: vi.fn(async (): Promise<unknown> => ({
    id: "sp1",
    name: "Marikina Leather Trading",
    code: "MLT",
    isActive: true,
  })),
  listActiveSuppliers: vi.fn(),
};
const LEATHER = {
  id: "it1",
  sku: "LR-002",
  name: "Brown suede",
  unit: "roll",
  category: "LEATHER_ROLL",
  isActive: true,
  supplierId: "sp1",
  quantityOnHand: 3,
};
const inventory = { findInventoryItem: vi.fn(async (): Promise<unknown> => LEATHER) };
const postMovement = vi.fn(async (..._args: unknown[]) => ({ onHandAfter: 4 }));
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/roll.model", () => rolls);
vi.mock("@/server/models/reference-data.model", () => refs);
vi.mock("@/server/models/inventory.model", () => inventory);
vi.mock("@/server/models/cv-settings.model", () => ({
  getCvSettings: vi.fn(async () => ({ foundAtOrAbove: 0.5, returnSharePct: 10 })),
}));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/services/inventory.service", () => ({ postMovement }));

const svc = await import("@/server/services/roll.service");

const SC = { id: "sc1" };
const FM = { id: "fm1" };
const now = new Date("2026-10-26T02:00:00.000Z"); // 10:00 Manila, 26 Oct
const state = (over: object = {}) => ({
  id: "r1",
  code: "LR-MLT-007",
  tagCode: null,
  status: "OPEN",
  itemId: "it1",
  areaSqFt: 24.5,
  startedAt: new Date("2026-10-26T01:00:00Z"),
  startedById: "sc1",
  usedCheckInId: null,
  markedForReturn: false,
  returnDecision: null,
  supplier: { name: "Marikina Leather Trading" },
  item: { name: "Brown suede" },
  _count: { scans: 4 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  rolls.moveRoll.mockResolvedValue(true);
  rolls.findRollState.mockResolvedValue(state());
  rolls.nextRollCodeNumber.mockResolvedValue(7);
  rolls.rollCodeTaken.mockResolvedValue(false);
  inventory.findInventoryItem.mockResolvedValue(LEATHER);
});

describe("addRolls (Phase 30A, D-103)", () => {
  const values = {
    receivedOn: "2026-10-26",
    rolls: [
      { areaSqFt: 24.5, tagCode: "T-1" },
      { areaSqFt: 30, tagCode: undefined },
    ],
  };

  it("codes each roll from the supplier, adds it in stock and puts +1 on the ledger", async () => {
    rolls.nextRollCodeNumber.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
    rolls.insertRoll.mockImplementation(async (data: { code: string }) => ({
      id: `id-${data.code}`,
    }));
    postMovement
      .mockResolvedValueOnce({ onHandAfter: 4 })
      .mockResolvedValueOnce({ onHandAfter: 5 });
    const result = await svc.addRolls("it1", values, FM, now);
    expect(rolls.nextRollCodeNumber).toHaveBeenCalledWith("LR-MLT", "tx");
    expect(rolls.insertRoll).toHaveBeenNthCalledWith(
      1,
      {
        code: "LR-MLT-007",
        tagCode: "T-1",
        itemId: "it1",
        supplierId: "sp1",
        areaSqFt: 24.5,
        receivedAt: new Date("2026-10-26T00:00:00Z"),
        status: "IN_STOCK",
        createdById: "fm1",
        createdAt: now,
      },
      "tx",
    );
    expect(postMovement).toHaveBeenNthCalledWith(
      2,
      "tx",
      expect.objectContaining({ id: "it1", quantityOnHand: 4 }),
      { type: "IN", delta: 1, reason: "Roll LR-MLT-008 added", rollId: "id-LR-MLT-008" },
      FM,
      now,
    );
    expect(result).toEqual({
      added: [
        { id: "id-LR-MLT-007", code: "LR-MLT-007", areaSqFt: 24.5, tagCode: "T-1" },
        { id: "id-LR-MLT-008", code: "LR-MLT-008", areaSqFt: 30, tagCode: null },
      ],
      quantityOnHand: 5,
    });
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "roll.add", entity: "InventoryItem", entityId: "it1" }),
    );
  });

  it("skips a number whose code is already taken", async () => {
    rolls.nextRollCodeNumber.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
    rolls.rollCodeTaken.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    rolls.insertRoll.mockResolvedValue({ id: "x" });
    await svc.addRolls(
      "it1",
      { ...values, rolls: [{ areaSqFt: 10, tagCode: undefined }] },
      FM,
      now,
    );
    expect(rolls.insertRoll).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LR-MLT-008" }),
      "tx",
    );
  });

  it("refuses a day after today on its field", async () => {
    await expect(
      svc.addRolls("it1", { ...values, receivedOn: "2026-10-27" }, FM, now),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        { path: ["receivedOn"], message: "The day the rolls arrived can’t be after today." },
      ],
    });
  });

  it("refuses another material, a deactivated item and an item with no active supplier", async () => {
    inventory.findInventoryItem.mockResolvedValueOnce({ ...LEATHER, category: "NAILS" });
    await expect(svc.addRolls("it1", values, FM, now)).rejects.toMatchObject({
      status: 409,
      message: "Brown suede isn’t a leather roll item, so it has no rolls.",
    });
    inventory.findInventoryItem.mockResolvedValueOnce({ ...LEATHER, isActive: false });
    await expect(svc.addRolls("it1", values, FM, now)).rejects.toMatchObject({ status: 409 });
    inventory.findInventoryItem.mockResolvedValueOnce({ ...LEATHER, supplierId: null });
    await expect(svc.addRolls("it1", values, FM, now)).rejects.toMatchObject({
      message: expect.stringContaining("supplier first"),
    });
    refs.findSupplier.mockResolvedValueOnce({
      id: "sp1",
      name: "Old",
      code: "OLD",
      isActive: false,
    });
    await expect(svc.addRolls("it1", values, FM, now)).rejects.toMatchObject({ status: 409 });
    expect(rolls.insertRoll).not.toHaveBeenCalled();
  });
});

describe("picking and finishing at Capture", () => {
  it("picks a roll in stock: it is being scanned now, by this person (no name shown)", async () => {
    rolls.findRollState.mockResolvedValue(state({ status: "IN_STOCK", startedAt: null }));
    const roll = await svc.startRoll("r1", SC, now);
    expect(rolls.moveRoll).toHaveBeenCalledWith(
      "r1",
      "IN_STOCK",
      { status: "OPEN", startedAt: now, startedById: "sc1" },
      "tx",
    );
    expect(roll).toMatchObject({ id: "r1", code: "LR-MLT-007", mine: true, fromInventory: true });
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.start",
        after: { status: "OPEN", code: "LR-MLT-007" },
      }),
    );
  });

  it("refuses a roll someone else picked, by name, and STALE on a race", async () => {
    await expect(svc.startRoll("r1", SC, now)).rejects.toMatchObject({
      status: 409,
      message: "LR-MLT-007 is being scanned at Capture. Choose another roll.",
    });
    rolls.findRollState.mockResolvedValue(state({ status: "IN_STOCK" }));
    rolls.moveRoll.mockResolvedValue(false);
    await expect(svc.startRoll("r1", SC, now)).rejects.toMatchObject({ code: "STALE" });
  });

  it("finishes an open roll with shots and takes it off stock (−1, Phase 30E)", async () => {
    await expect(svc.finishRoll("r1", SC, now)).resolves.toEqual({
      id: "r1",
      code: "LR-MLT-007",
      status: "FINISHED",
      shots: 4,
      sharePct: null,
      limitPct: 10,
      marked: false,
      notMeasured: "no-shots",
    });
    expect(rolls.moveRoll).toHaveBeenCalledWith(
      "r1",
      "OPEN",
      { status: "FINISHED", finishedAt: now, finishedById: "sc1" },
      "tx",
    );
    expect(postMovement).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ id: "it1" }),
      { type: "OUT", delta: -1, reason: "Roll LR-MLT-007 scanned at Capture", rollId: "r1" },
      SC,
      now,
    );
  });

  it("finishes an old roll with no item without touching stock", async () => {
    rolls.findRollState.mockResolvedValue(state({ code: "R-2026-0003", itemId: null }));
    await svc.finishRoll("r1", SC, now);
    expect(postMovement).not.toHaveBeenCalled();
  });

  it("refuses to finish an empty roll and 404s an unknown one", async () => {
    rolls.findRollState.mockResolvedValue(state({ _count: { scans: 0 } }));
    await expect(svc.finishRoll("r1", SC, now)).rejects.toMatchObject({ status: 409 });
    rolls.findRollState.mockResolvedValue(null);
    await expect(svc.finishRoll("nope", SC, now)).rejects.toMatchObject({ status: 404 });
  });

  it("puts an empty roll back in stock; an old roll is cancelled instead", async () => {
    rolls.findRollState.mockResolvedValue(state({ _count: { scans: 0 } }));
    await expect(svc.putBackRoll("r1", SC, now)).resolves.toMatchObject({ status: "IN_STOCK" });
    expect(rolls.moveRoll).toHaveBeenCalledWith(
      "r1",
      "OPEN",
      { status: "IN_STOCK", startedAt: null, startedById: null },
      "tx",
    );
    rolls.findRollState.mockResolvedValue(
      state({ code: "R-2026-0003", itemId: null, _count: { scans: 0 } }),
    );
    await expect(svc.putBackRoll("r1", SC, now)).resolves.toMatchObject({ status: "CANCELLED" });
    expect(postMovement).not.toHaveBeenCalled();
  });

  it("won't put back a roll with shots", async () => {
    await expect(svc.putBackRoll("r1", SC, now)).rejects.toMatchObject({ status: 409 });
  });
});

describe("removeRoll (the Floor Manager)", () => {
  it("removes a roll from Inventory with its reason and takes it out of stock (−1)", async () => {
    rolls.findRollState.mockResolvedValue(state({ status: "IN_STOCK", _count: { scans: 0 } }));
    await svc.removeRoll("r1", "Water damage", FM, now);
    expect(rolls.moveRoll).toHaveBeenCalledWith(
      "r1",
      "IN_STOCK",
      {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: "fm1",
        cancelledReason: "Water damage",
      },
      "tx",
    );
    expect(postMovement).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ id: "it1" }),
      { type: "OUT", delta: -1, reason: "Roll LR-MLT-007 removed: Water damage", rollId: "r1" },
      FM,
      now,
    );
  });

  it("refuses a roll already scanned: it is off stock (Phase 30E)", async () => {
    rolls.findRollState.mockResolvedValue(state({ status: "FINISHED" }));
    await expect(svc.removeRoll("r1", "x", FM, now)).rejects.toMatchObject({
      status: 409,
      message: "LR-MLT-007 is already scanned.",
    });
  });

  it("closes an old open roll without touching stock", async () => {
    rolls.findRollState.mockResolvedValue(state({ code: "R-2026-0003", itemId: null }));
    await svc.removeRoll("r1", "Wrong supplier", FM, now);
    expect(postMovement).not.toHaveBeenCalled();
  });
});

describe("rolls ticked before Phase 30E (history)", () => {
  it("groups each batch's ticked rolls for the Batches page", async () => {
    rolls.listRollsUsedIn.mockResolvedValue([
      { id: "a", code: "LR-MLT-001", usedCheckInId: "c1" },
      { id: "b", code: "LR-MT-001", usedCheckInId: "c1" },
      { id: "c", code: "LR-MT-002", usedCheckInId: "c2" },
    ]);
    const map = await svc.rollsUsedByCheckIn(["c1", "c2"]);
    expect(map.get("c1")?.map((r) => r.code)).toEqual(["LR-MLT-001", "LR-MT-001"]);
    expect(map.get("c2")).toEqual([{ id: "c", code: "LR-MT-002" }]);
  });
});

describe("resolveCaptureRoll: where a shot goes", () => {
  it("takes the roll chosen at Capture while it is being scanned", async () => {
    await expect(svc.resolveCaptureRoll("r1", "website")).resolves.toEqual({
      id: "r1",
      code: "LR-MLT-007",
      selection: "chosen",
    });
  });

  it("refuses a chosen roll that was finished or put back, naming it", async () => {
    rolls.findRollState.mockResolvedValue(state({ status: "IN_STOCK" }));
    await expect(svc.resolveCaptureRoll("r1", "website")).rejects.toMatchObject({
      status: 409,
      code: "ROLL_CLOSED",
      message: expect.stringMatching(/^LR-MLT-007 isn’t being scanned any more/),
    });
  });

  it("needs a chosen roll from the website", async () => {
    await expect(svc.resolveCaptureRoll(undefined, "website")).rejects.toMatchObject({
      status: 409,
      code: "NO_ROLL_CHOSEN",
    });
    expect(rolls.listOpenRolls).not.toHaveBeenCalled();
  });

  it("sends a device token's scan to the roll open the longest, or refuses with none", async () => {
    rolls.listOpenRolls.mockResolvedValue([
      state({ id: "new", startedAt: new Date("2026-10-26T01:00:00Z") }),
      state({ id: "old", code: "LR-MT-001", startedAt: new Date("2026-10-25T01:00:00Z") }),
    ]);
    await expect(svc.resolveCaptureRoll(undefined, "device")).resolves.toEqual({
      id: "old",
      code: "LR-MT-001",
      selection: "oldest",
    });
    rolls.listOpenRolls.mockResolvedValue([]);
    await expect(svc.resolveCaptureRoll(undefined, "device")).rejects.toMatchObject({
      status: 409,
      code: "NO_OPEN_ROLL",
    });
  });
});

describe("rolls at Capture", () => {
  it("lists every roll being scanned and marks only the viewer's own, with no name (D-008)", async () => {
    rolls.listOpenRolls.mockResolvedValue([
      state({ id: "a", startedById: "sc1" }),
      state({ id: "b", startedById: "sc2" }),
    ]);
    const list = await svc.openRollsForCapture(SC);
    expect(list.map((r) => [r.id, r.mine])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(Object.keys(list[0]).sort()).toEqual(
      [
        "areaSqFt",
        "code",
        "fromInventory",
        "id",
        "item",
        "mine",
        "shots",
        "startedAt",
        "supplier",
        "tagCode",
      ].sort(),
    );
  });

  it("lists the rolls waiting to be scanned with their item and area", async () => {
    rolls.listReadyRolls.mockResolvedValue([state({ status: "IN_STOCK", startedAt: null })]);
    await expect(svc.readyRollsForCapture()).resolves.toEqual([
      {
        id: "r1",
        code: "LR-MLT-007",
        tagCode: null,
        supplier: "Marikina Leather Trading",
        item: "Brown suede",
        areaSqFt: 24.5,
      },
    ]);
  });
});

describe("Reports → Rolls and a leather item's rolls (D-008)", () => {
  const listRow = {
    id: "r1",
    code: "LR-MLT-007",
    tagCode: null,
    status: "FINISHED",
    areaSqFt: 24.5,
    receivedAt: now,
    createdAt: now,
    startedAt: now,
    finishedAt: now,
    cancelledAt: null,
    usedAt: null,
    supplier: { id: "sp1", name: "Marikina Leather Trading" },
    item: { id: "it1", sku: "LR-002", name: "Brown suede" },
    _count: { scans: 10 },
  };

  it("adds the passed and rejected counts and carries no person", async () => {
    rolls.listRolls.mockResolvedValue({ rows: [listRow], total: 1 });
    rolls.countVerdictsForRolls.mockResolvedValue([
      { rollId: "r1", finalVerdict: "PASS", _count: { _all: 8 } },
      { rollId: "r1", finalVerdict: "REJECT", _count: { _all: 2 } },
    ]);
    const result = await svc.listRollsForReport({ status: "RETURNED", days: 7 }, now);
    expect(result).toMatchObject({ total: 1, page: 1, pageCount: 1 });
    expect(result.rows[0]).toMatchObject({ passed: 8, rejected: 2, areaSqFt: 24.5 });
    const [filters, page] = rolls.listRolls.mock.calls[0];
    expect(filters).toMatchObject({ reportStatus: "RETURNED" });
    expect(filters.since.toISOString()).toBe("2026-10-19T16:00:00.000Z"); // 20 Oct, Manila
    expect(page).toEqual({ skip: 0, take: 15 });
    for (const key of Object.keys(result.rows[0]))
      expect(key).not.toMatch(/user|createdBy|finishedBy|cancelledBy|usedBy|email/i);
  });

  it("lists an item's rolls with the defects found, from found-at", async () => {
    rolls.listRolls.mockResolvedValue({ rows: [listRow], total: 1 });
    rolls.countDefectsForRolls.mockResolvedValue([
      { rollId: "r1", label: "Cut", detections: BigInt(2) },
      { rollId: "r1", label: "Hole", detections: BigInt(1) },
    ]);
    const result = await svc.listItemRolls("it1", { page: 1 });
    expect(rolls.listRolls.mock.calls[0][0]).toMatchObject({ itemId: "it1" });
    expect(rolls.countDefectsForRolls).toHaveBeenCalledWith(["r1"], 0.5);
    expect(result.rows[0]).toMatchObject({ defectsFound: "Cut 2, Hole 1", canRemove: false });
  });

  it("lets the Floor Manager remove a roll in stock or being scanned from its page", async () => {
    const detail = (status: string, item: object | null = { id: "it1" }) => ({
      ...state({ status }),
      item,
      areaSqFt: 24.5,
      scans: [{ finalVerdict: "PASS" }, { finalVerdict: "REJECT" }],
    });
    rolls.findRollDetail.mockResolvedValue(detail("IN_STOCK"));
    await expect(svc.getRollDetail("r1")).resolves.toMatchObject({
      passed: 1,
      rejected: 1,
      areaSqFt: 24.5,
      canRemove: true,
    });
    for (const status of ["FINISHED", "USED"]) {
      rolls.findRollDetail.mockResolvedValue(detail(status));
      expect((await svc.getRollDetail("r1"))?.canRemove).toBe(false);
    }
    rolls.findRollDetail.mockResolvedValue(detail("FINISHED", null));
    expect((await svc.getRollDetail("r1"))?.canRemove).toBe(false);
  });
});

describe("the defect share and the supplier limit (Phase 30C, D-110)", () => {
  it("works out the share at Finish roll and marks a roll over the limit", async () => {
    // 24.5 sq ft = 3,528 sq in: 300 sq in is 8.5%, plus eight cuts from 3 in at 1% each.
    rolls.listRollShotMeasures.mockResolvedValue([
      { defectAreaSqIn: 200, flatSharePct: 5 },
      { defectAreaSqIn: 100, flatSharePct: 3 },
    ]);
    await expect(svc.finishRoll("r1", SC, now)).resolves.toMatchObject({
      sharePct: 16.5,
      limitPct: 10,
      marked: true,
      notMeasured: null,
    });
    expect(rolls.saveRollMeasure).toHaveBeenCalledWith(
      "r1",
      { defectAreaSqIn: 300, defectSharePct: 16.5, returnLimitPct: 10, markedForReturn: true },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.finish",
        after: expect.objectContaining({ defectSharePct: 16.5, markedForReturn: true }),
      }),
    );
  });

  it("leaves a roll with a shot from an uncalibrated phone not measured and unmarked (A-28)", async () => {
    rolls.listRollShotMeasures.mockResolvedValue([
      { defectAreaSqIn: 900, flatSharePct: 0 },
      { defectAreaSqIn: null, flatSharePct: null },
    ]);
    await expect(svc.finishRoll("r1", SC, now)).resolves.toMatchObject({
      sharePct: null,
      marked: false,
      notMeasured: "unscaled",
    });
    expect(rolls.saveRollMeasure).toHaveBeenCalledWith(
      "r1",
      { defectAreaSqIn: null, defectSharePct: null, returnLimitPct: 10, markedForReturn: false },
      "tx",
    );
  });
});
