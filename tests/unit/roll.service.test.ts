import { beforeEach, describe, expect, it, vi } from "vitest";

const rolls = {
  listRolls: vi.fn(),
  listRollFinishes: vi.fn(async (): Promise<unknown[]> => []),
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
  listRollTimes: vi.fn(async (): Promise<unknown[]> => []),
  // Phase 32: where rolls are kept.
  lastTakenFrom: vi.fn(async (): Promise<Map<string, string | null>> => new Map()),
  insertRollMove: vi.fn(async (..._args: unknown[]) => ({ id: "m1" })),
  setRollLocation: vi.fn(async (..._args: unknown[]) => true),
  listRollMoves: vi.fn(async (): Promise<unknown[]> => []),
  findRollsByIds: vi.fn(async (): Promise<unknown[]> => []),
  findRollsByCodeOrTag: vi.fn(async (): Promise<unknown[]> => []),
  listRollsInLocation: vi.fn(async (): Promise<unknown[]> => []),
  listInStockRollIds: vi.fn(async (): Promise<string[]> => []),
  // Phase 35B: the Floor Manager's corrections.
  updateRollDetails: vi.fn(async (..._args: unknown[]) => true),
};
const locations = {
  findLocation: vi.fn(async (): Promise<unknown> => null),
  findLocationByCode: vi.fn(async (): Promise<unknown> => null),
};
// Lunch 11:00 to 12:00 from the start (D-121's timer leaves it out).
const listLunchBreaks = vi.fn(async (): Promise<unknown[]> => [
  { effectiveFrom: "2026-01-01", startTime: "11:00", endTime: "12:00" },
]);
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
vi.mock("@/server/models/location.model", () => locations);
vi.mock("@/server/models/reference-data.model", () => refs);
vi.mock("@/server/models/inventory.model", () => inventory);
vi.mock("@/server/models/production.model", () => ({ listLunchBreaks }));
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
  scans: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  rolls.moveRoll.mockResolvedValue(true);
  rolls.findRollState.mockResolvedValue(state());
  rolls.nextRollCodeNumber.mockResolvedValue(7);
  rolls.rollCodeTaken.mockResolvedValue(false);
  rolls.updateRollDetails.mockResolvedValue(true);
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
        // Phase 32: no location chosen, so not placed and no move row.
        locationId: null,
        locatedAt: null,
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
      { status: "OPEN", startedAt: now, startedById: "sc1", locationId: null, locatedAt: null },
      "tx",
    );
    expect(roll).toMatchObject({ id: "r1", code: "LR-MLT-007", mine: true, fromInventory: true });
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.start",
        after: { status: "OPEN", code: "LR-MLT-007", location: null },
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
      scanningMs: 60 * 60_000, // 09:00 to 10:00 Manila (D-121)
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
      {
        status: "IN_STOCK",
        startedAt: null,
        startedById: null,
        locationId: null,
        locatedAt: null,
      },
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

describe("updateRoll: the Floor Manager's corrections (Phase 35B, A-104)", () => {
  const STAMP = new Date("2026-10-25T08:00:00.000Z");
  const input = (over: object = {}) => ({
    expectedUpdatedAt: STAMP.toISOString(),
    reason: "Read the tag upside down",
    ...over,
  });
  const rollRow = (over: object = {}) =>
    state({
      status: "IN_STOCK",
      receivedAt: new Date("2026-10-20T00:00:00Z"),
      returnNote: null,
      updatedAt: STAMP,
      tagCode: "T-1",
      ...over,
    });
  beforeEach(() => rolls.findRollState.mockResolvedValue(rollRow()));

  it("saves only what changed, and audits the old and the new value with the reason", async () => {
    const r = await svc.updateRoll(
      "r1",
      input({ tagCode: "T-9", receivedOn: "2026-10-20", areaSqFt: "30" }),
      FM,
      now,
    );
    expect(r).toEqual({ id: "r1", code: "LR-MLT-007", changed: ["tagCode", "areaSqFt"] });
    // The received day was the same, so it is not written.
    expect(rolls.updateRollDetails).toHaveBeenCalledWith(
      "r1",
      STAMP,
      { tagCode: "T-9", areaSqFt: 30 },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.update",
        entity: "Roll",
        before: { tagCode: "T-1", areaSqFt: 24.5 },
        after: {
          code: "LR-MLT-007",
          tagCode: "T-9",
          areaSqFt: 30,
          reason: "Read the tag upside down",
        },
      }),
    );
  });

  it("changes the received day as a date, never after today", async () => {
    await svc.updateRoll("r1", input({ receivedOn: "2026-10-22" }), FM, now);
    expect(rolls.updateRollDetails).toHaveBeenCalledWith(
      "r1",
      STAMP,
      { receivedAt: new Date("2026-10-22T00:00:00Z") },
      "tx",
    );
    await expect(
      svc.updateRoll("r1", input({ receivedOn: "2026-10-27" }), FM, now),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        { path: ["receivedOn"], message: "The day the rolls arrived can’t be after today." },
      ],
    });
  });

  it("refuses the area once the roll is finished, and names why", async () => {
    for (const status of ["FINISHED", "USED", "RETURNED"]) {
      rolls.findRollState.mockResolvedValue(rollRow({ status }));
      await expect(svc.updateRoll("r1", input({ areaSqFt: "30" }), FM, now)).rejects.toMatchObject({
        status: 422,
        details: [
          {
            path: ["areaSqFt"],
            message:
              "The area can't change after Finish roll: the defect share and the return mark were worked out from it.",
          },
        ],
      });
    }
    // The tag still changes after Finish roll.
    rolls.findRollState.mockResolvedValue(rollRow({ status: "FINISHED" }));
    await svc.updateRoll("r1", input({ tagCode: "T-2" }), FM, now);
    expect(rolls.updateRollDetails).toHaveBeenCalledTimes(1);
    // A roll being scanned can still have its area corrected.
    rolls.findRollState.mockResolvedValue(rollRow({ status: "OPEN" }));
    await svc.updateRoll("r1", input({ areaSqFt: "26.25" }), FM, now);
    expect(rolls.updateRollDetails).toHaveBeenCalledTimes(2);
  });

  it("changes the return note only once a decision exists, and a kept roll keeps a reason", async () => {
    await expect(
      svc.updateRoll("r1", input({ returnNote: "Sent Monday" }), FM, now),
    ).rejects.toMatchObject({
      details: [{ path: ["returnNote"], message: expect.stringContaining("no return decision") }],
    });
    rolls.findRollState.mockResolvedValue(
      rollRow({ status: "FINISHED", returnDecision: "RETURNED", returnNote: "Sent Monday" }),
    );
    await svc.updateRoll("r1", input({ returnNote: "Sent Tuesday" }), FM, now);
    expect(rolls.updateRollDetails).toHaveBeenCalledWith(
      "r1",
      STAMP,
      { returnNote: "Sent Tuesday" },
      "tx",
    );
    rolls.findRollState.mockResolvedValue(
      rollRow({ status: "FINISHED", returnDecision: "KEPT", returnNote: "Within tolerance" }),
    );
    await expect(svc.updateRoll("r1", input({ returnNote: " " }), FM, now)).rejects.toMatchObject({
      details: [{ path: ["returnNote"], message: expect.stringContaining("needs the reason") }],
    });
  });

  it("is a 422 when nothing changes, 409 on a removed roll, and stale when someone saved first", async () => {
    await expect(svc.updateRoll("r1", input({ tagCode: "T-1" }), FM, now)).rejects.toMatchObject({
      details: [
        { path: ["form"], message: "Nothing changed. Change a field, or close this window." },
      ],
    });
    rolls.findRollState.mockResolvedValue(rollRow({ status: "CANCELLED" }));
    await expect(svc.updateRoll("r1", input({ tagCode: "T-9" }), FM, now)).rejects.toMatchObject({
      status: 409,
      message: "LR-MLT-007 was removed, so its details can't change.",
    });
    rolls.findRollState.mockResolvedValue(rollRow({ updatedAt: new Date("2026-10-25T09:00:00Z") }));
    await expect(svc.updateRoll("r1", input({ tagCode: "T-9" }), FM, now)).rejects.toMatchObject({
      code: "STALE",
    });
    rolls.findRollState.mockResolvedValue(rollRow());
    rolls.updateRollDetails.mockResolvedValueOnce(false);
    await expect(svc.updateRoll("r1", input({ tagCode: "T-9" }), FM, now)).rejects.toMatchObject({
      code: "STALE",
    });
    rolls.findRollState.mockResolvedValue(null);
    await expect(svc.updateRoll("r1", input({ tagCode: "T-9" }), FM, now)).rejects.toMatchObject({
      status: 404,
    });
    expect(recordAudit).not.toHaveBeenCalled();
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
        locationId: null,
        locatedAt: null,
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
        "location",
        "lunches",
        "mine",
        "scale",
        "shots",
        "startedAt",
        "supplier",
        "tagCode",
        "takenFromId",
      ].sort(),
    );
  });

  it("sends each roll's scale and its days' lunch for Capture's timer (D-121)", async () => {
    rolls.listOpenRolls.mockResolvedValue([
      state({
        scans: [{ sequence: 1, widthIn: 16.84, imageWidth: 1920, imageHeight: 1080 }],
      }),
    ]);
    const [roll] = await svc.openRollsForCapture(SC, now);
    expect(roll.scale).toEqual({ widthIn: 16.84, width: 1920, height: 1080, shot: 1 });
    expect(roll.lunches).toEqual({ "2026-10-26": { startTime: "11:00", endTime: "12:00" } });
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
        location: null,
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

  it("filters on the day a roll was added by the period picker, any filter combining (Phase 35)", async () => {
    rolls.listRolls.mockResolvedValue({ rows: [listRow], total: 1 });
    await svc.listRollsForReport(
      {
        period: "month",
        year: "2026",
        month: "10",
        itemId: "it1",
        locationId: "loc1",
        supplierId: "sp1",
      },
      now,
    );
    const [filters] = rolls.listRolls.mock.calls.at(-1)!;
    expect(filters).toMatchObject({ itemId: "it1", locationId: "loc1", supplierId: "sp1" });
    expect(filters.since.toISOString()).toBe("2026-09-30T16:00:00.000Z"); // 1 Oct, Manila
    expect(filters.until.toISOString()).toBe("2026-10-26T16:00:00.000Z"); // through today, 26 Oct
    // No period (and no old days link) means any time.
    await svc.listRollsForReport({}, now);
    const [any] = rolls.listRolls.mock.calls.at(-1)!;
    expect(any.since).toBeUndefined();
    expect(any.until).toBeUndefined();
  });

  it("sorts by a column on every matching row, then pages the result (Phase 35)", async () => {
    const at = (min: number) => ({
      startedAt: new Date("2026-10-26T01:00:00Z"),
      finishedAt: new Date(new Date("2026-10-26T01:00:00Z").getTime() + min * 60_000),
    });
    const rows = [
      { ...listRow, id: "a", code: "LR-MLT-001", ...at(10) },
      { ...listRow, id: "b", code: "LR-MLT-002", ...at(30) },
      { ...listRow, id: "c", code: "LR-MLT-003", startedAt: null, finishedAt: null },
    ];
    rolls.listRolls.mockResolvedValue({ rows, total: 3 });
    const order = async (q: object) =>
      (await svc.listRollsForReport(q, now)).rows.map((r) => r.id).join("");
    expect(await order({ sort: "rolls.scanning-time", dir: "desc" })).toBe("bac");
    expect(await order({ sort: "rolls.scanning-time", dir: "asc" })).toBe("abc"); // none last
    expect(await order({ sort: "rolls.roll", dir: "desc" })).toBe("cba");
    // A sort on another table or column is ignored: the database order stays.
    expect(await order({ sort: "stock.item", dir: "desc" })).toBe("abc");
    expect(await order({ sort: "rolls.nonsense" })).toBe("abc");
    // The sorted list reads the newest 5,000 so the sort sees every row.
    await svc.listRollsForReport({ sort: "rolls.roll" }, now);
    expect(rolls.listRolls.mock.calls.at(-1)![1]).toEqual({ skip: 0, take: 5000 });
  });

  it("prints every matching row up to 500 and says when it was cut (A-102)", async () => {
    rolls.listRolls.mockResolvedValue({ rows: [listRow], total: 620 });
    const result = await svc.listRollsForReport({ print: "1", page: 3 }, now);
    expect(rolls.listRolls.mock.calls.at(-1)![1]).toEqual({ skip: 0, take: 500 });
    expect(result).toMatchObject({ page: 1, pageCount: 1, printCut: true });
    rolls.listRolls.mockResolvedValue({ rows: [listRow], total: 40 });
    expect((await svc.listRollsForReport({ print: "1" }, now)).printCut).toBe(false);
  });

  it("gives each roll its scanning time and the average over every page (D-121)", async () => {
    // 10:40 to 12:20 Manila with lunch 11:00 to 12:00: 40 minutes.
    const timed = {
      ...listRow,
      startedAt: new Date("2026-10-26T02:40:00Z"),
      finishedAt: new Date("2026-10-26T04:20:00Z"),
    };
    rolls.listRolls.mockResolvedValue({ rows: [timed], total: 1 });
    rolls.listRollTimes.mockResolvedValue([
      { startedAt: timed.startedAt, finishedAt: timed.finishedAt },
      { startedAt: new Date("2026-10-26T01:00:00Z"), finishedAt: new Date("2026-10-26T01:20:00Z") },
    ]);
    const result = await svc.listRollsForReport({ supplierId: undefined }, now);
    expect(result.rows[0].scanningMs).toBe(40 * 60_000);
    expect(result.scanning).toEqual({ averageMs: 30 * 60_000, count: 2 });

    const csv = await svc.rollsCsv({}, now);
    const [header, row] = csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(header).toContain("Scanning time,Scanning time (min)");
    expect(row).toContain("40:00,40.00");
    expect(header).not.toMatch(/user|by|email/i);
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

describe("rollOutcomesByDay (Phase 30D, D-118)", () => {
  it("counts each roll on its Manila finish day, and those returned to the supplier", async () => {
    const finished = (iso: string, extra: object = {}) => ({
      finishedAt: new Date(iso),
      status: "FINISHED",
      markedForReturn: false,
      returnDecision: null,
      ...extra,
    });
    rolls.listRollFinishes.mockResolvedValueOnce([
      finished("2026-11-04T01:00:00.000Z"),
      finished("2026-11-04T02:00:00.000Z", { markedForReturn: true }), // over the limit
      finished("2026-11-04T03:00:00.000Z", { markedForReturn: true, returnDecision: "KEPT" }),
      finished("2026-11-03T05:00:00.000Z", { status: "RETURNED" }), // sent back in Phase 30C
      finished("2026-11-04T17:00:00.000Z"), // 01:00 on 5 Nov in Manila
    ]);
    const map = await svc.rollOutcomesByDay("2026-11-03", "2026-11-05");
    expect(Object.fromEntries(map)).toEqual({
      "2026-11-03": { scanned: 1, returned: 1 },
      "2026-11-04": { scanned: 3, returned: 1 },
      "2026-11-05": { scanned: 1, returned: 0 },
    });
  });
});

// ───────────── Phase 32: where rolls are kept (D-128) ─────────────

const BIN = {
  id: "b1",
  code: "R1-B3",
  name: "Rack 1, bin 3",
  isActive: true,
  _count: { rolls: 0 },
};
const BIN2 = { id: "b2", code: "R2-B1", name: null, isActive: true, _count: { rolls: 1 } };
const listRow = (over: object = {}) => ({
  id: "r1",
  code: "LR-MLT-007",
  tagCode: null,
  status: "IN_STOCK",
  areaSqFt: 24.5,
  receivedAt: new Date("2026-10-26T00:00:00Z"),
  createdAt: now,
  startedAt: null,
  finishedAt: null,
  cancelledAt: null,
  usedAt: null,
  defectAreaSqIn: null,
  defectSharePct: null,
  returnLimitPct: null,
  markedForReturn: false,
  returnDecision: null,
  returnedOn: null,
  locationId: null,
  pickedUpAt: null,
  location: null,
  supplier: { id: "sp1", name: "Marikina Leather Trading" },
  item: { id: "it1", sku: "LR-002", name: "Brown suede" },
  _count: { scans: 0 },
  ...over,
});

describe("where rolls are kept (Phase 32)", () => {
  beforeEach(() => {
    locations.findLocation.mockResolvedValue(BIN);
    rolls.setRollLocation.mockResolvedValue(true);
  });

  it("places new rolls in the chosen location, one Placed row each, and audits the location", async () => {
    rolls.insertRoll.mockImplementation(async (data: { code: string }) => ({
      id: `id-${data.code}`,
    }));
    rolls.nextRollCodeNumber.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
    await svc.addRolls(
      "it1",
      {
        receivedOn: "2026-10-26",
        rolls: [
          { areaSqFt: 5, tagCode: undefined },
          { areaSqFt: 6, tagCode: undefined },
        ],
        locationId: "b1",
      },
      FM,
      now,
    );
    expect(rolls.insertRoll).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "b1", locatedAt: now }),
      "tx",
    );
    expect(rolls.insertRollMove).toHaveBeenCalledTimes(2);
    expect(rolls.insertRollMove).toHaveBeenCalledWith(
      {
        rollId: "id-LR-MLT-007",
        fromLocationId: null,
        toLocationId: "b1",
        reason: "PLACED",
        byId: "fm1",
        at: now,
      },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.add",
        after: expect.objectContaining({ location: "R1-B3" }),
      }),
    );
  });

  it("refuses a deactivated location before anything is saved", async () => {
    locations.findLocation.mockResolvedValueOnce({ ...BIN, isActive: false });
    await expect(
      svc.addRolls(
        "it1",
        {
          receivedOn: "2026-10-26",
          rolls: [{ areaSqFt: 5, tagCode: undefined }],
          locationId: "b1",
        },
        FM,
        now,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(rolls.insertRoll).not.toHaveBeenCalled();
  });

  it("takes a roll out of its place when it is picked at Capture (Taken for scanning)", async () => {
    rolls.findRollState.mockResolvedValue(
      state({ status: "IN_STOCK", locationId: "b1", location: BIN }),
    );
    const roll = await svc.startRoll("r1", SC, now);
    expect(rolls.insertRollMove).toHaveBeenCalledWith(
      expect.objectContaining({
        fromLocationId: "b1",
        toLocationId: null,
        reason: "TAKEN_FOR_USE",
      }),
      "tx",
    );
    expect(roll.takenFromId).toBe("b1");
    expect(roll.location).toBeNull();
  });

  it("puts an empty roll back where the constructor says (Put back)", async () => {
    rolls.findRollState.mockResolvedValue(state({ _count: { scans: 0 } }));
    await expect(svc.putBackRoll("r1", SC, now, "b1")).resolves.toMatchObject({
      status: "IN_STOCK",
      location: "R1-B3",
    });
    expect(rolls.moveRoll).toHaveBeenCalledWith(
      "r1",
      "OPEN",
      expect.objectContaining({ status: "IN_STOCK", locationId: "b1", locatedAt: now }),
      "tx",
    );
    expect(rolls.insertRollMove).toHaveBeenCalledWith(
      expect.objectContaining({ toLocationId: "b1", reason: "PUT_BACK" }),
      "tx",
    );
  });

  it("frees a removed roll's place with the reason as the note", async () => {
    rolls.findRollState.mockResolvedValue(
      state({ status: "IN_STOCK", locationId: "b1", location: BIN }),
    );
    await svc.removeRoll("r1", "Water damage", FM, now);
    expect(rolls.insertRollMove).toHaveBeenCalledWith(
      expect.objectContaining({ fromLocationId: "b1", reason: "REMOVED", note: "Water damage" }),
      "tx",
    );
  });

  it("moves rolls all or nothing: Placed or Moved per roll, one audit row", async () => {
    locations.findLocation.mockResolvedValue(BIN2);
    rolls.findRollsByIds.mockResolvedValueOnce([
      listRow(),
      listRow({ id: "r2", code: "LR-MLT-008", locationId: "b1", location: BIN }),
    ]);
    const { moved } = await svc.moveRolls(
      { rollIds: ["r1", "r2"], toLocationId: "b2", note: null },
      FM,
      now,
    );
    expect(moved).toEqual([
      { id: "r1", code: "LR-MLT-007", from: null, to: "R2-B1" },
      { id: "r2", code: "LR-MLT-008", from: "R1-B3", to: "R2-B1" },
    ]);
    expect(rolls.setRollLocation).toHaveBeenCalledWith(
      "r2",
      { status: "IN_STOCK", locationId: "b1" },
      { locationId: "b2", locatedAt: now },
      "tx",
    );
    expect(rolls.insertRollMove.mock.calls.map((c) => (c[0] as { reason: string }).reason)).toEqual(
      ["PLACED", "MOVED"],
    );
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.move",
        entity: "StorageLocation",
        entityId: "b2",
        // Each roll's place before the move (run 1 F2).
        before: {
          rolls: [
            { code: "LR-MLT-007", location: null },
            { code: "LR-MLT-008", location: "R1-B3" },
          ],
        },
      }),
    );
  });

  it("refuses the whole move when one roll can't go, naming it", async () => {
    rolls.findRollsByIds.mockResolvedValueOnce([
      listRow(),
      listRow({ id: "r2", code: "LR-MLT-008", status: "OPEN" }),
    ]);
    await expect(
      svc.moveRolls({ rollIds: ["r1", "r2"], toLocationId: "b1", note: null }, FM, now),
    ).rejects.toMatchObject({
      status: 409,
      message: "LR-MLT-008 is being scanned at Capture. Put it back first.",
    });
    expect(rolls.setRollLocation).not.toHaveBeenCalled();
  });

  it("answers STALE when someone moved the roll first", async () => {
    rolls.findRollsByIds.mockResolvedValueOnce([listRow()]);
    rolls.setRollLocation.mockResolvedValueOnce(false);
    await expect(
      svc.moveRolls({ rollIds: ["r1"], toLocationId: "b1", note: null }, FM, now),
    ).rejects.toMatchObject({ code: "STALE" });
  });

  it("sets a roll Returned to supplier aside, then marks it picked up (A-77)", async () => {
    const finished = state({
      status: "FINISHED",
      markedForReturn: true,
      locationId: null,
      location: null,
    });
    rolls.findRollState.mockResolvedValue(finished);
    await expect(svc.setAsideRoll("r1", "b1", SC, now)).resolves.toMatchObject({
      location: { code: "R1-B3" },
    });
    expect(rolls.insertRollMove).toHaveBeenCalledWith(
      expect.objectContaining({ toLocationId: "b1", reason: "SET_ASIDE_FOR_RETURN" }),
      "tx",
    );
    rolls.findRollState.mockResolvedValue({ ...finished, locationId: "b1", location: BIN });
    await svc.markPickedUp("r1", FM, now);
    expect(rolls.setRollLocation).toHaveBeenLastCalledWith(
      "r1",
      { status: "FINISHED", locationId: "b1" },
      { locationId: null, locatedAt: null, pickedUpAt: now },
      "tx",
    );
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({ action: "roll.picked_up" }),
    );
  });

  it("won't set aside or pick up a roll that wasn't returned", async () => {
    rolls.findRollState.mockResolvedValue(state({ status: "FINISHED" }));
    await expect(svc.setAsideRoll("r1", "b1", SC, now)).rejects.toMatchObject({ status: 409 });
    await expect(svc.markPickedUp("r1", FM, now)).rejects.toMatchObject({ status: 409 });
  });

  it("finds a roll by code or tag, a location by its label, or says what to check", async () => {
    rolls.findRollsByCodeOrTag.mockResolvedValueOnce([
      listRow({ locationId: "b1", location: BIN }),
    ]);
    const byCode = await svc.findRolls("lr-mlt-007");
    expect(rolls.findRollsByCodeOrTag).toHaveBeenCalledWith("LR-MLT-007");
    expect(byCode.rolls[0]).toMatchObject({
      code: "LR-MLT-007",
      where: "R1-B3 · Rack 1, bin 3",
      canMove: true,
      statusText: "Not yet scanned",
    });

    locations.findLocationByCode.mockResolvedValueOnce(BIN);
    rolls.listRollsInLocation.mockResolvedValueOnce([listRow({ locationId: "b1", location: BIN })]);
    const byLabel = await svc.findRolls("LOC:R1-B3");
    expect(byLabel.location).toMatchObject({ code: "R1-B3" });
    expect(byLabel.location?.contents).toHaveLength(1);
    expect(rolls.findRollsByCodeOrTag).toHaveBeenCalledTimes(1);

    rolls.findRollsByCodeOrTag.mockResolvedValueOnce([]);
    const none = await svc.findRolls("LR-MLT-040");
    expect(none).toEqual({
      rolls: [],
      location: null,
      message: "No roll or location has the code LR-MLT-040. Check the label or type the code.",
    });
  });

  it("shows the history without names (A-78)", async () => {
    rolls.listRollMoves.mockResolvedValueOnce([
      {
        id: "m2",
        reason: "MOVED",
        note: null,
        at: now,
        fromLocation: { code: "R1-B3", name: "Rack 1, bin 3" },
        toLocation: { code: "R2-B1", name: null },
      },
    ]);
    const [entry] = await svc.rollHistory("r1");
    expect(entry).toEqual({
      id: "m2",
      at: now.toISOString(),
      reason: "MOVED",
      label: "Moved",
      from: "R1-B3 · Rack 1, bin 3",
      to: "R2-B1",
      note: null,
    });
  });
});
