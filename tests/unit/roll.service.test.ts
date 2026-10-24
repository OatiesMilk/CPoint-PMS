import { beforeEach, describe, expect, it, vi } from "vitest";

const rolls = {
  listRolls: vi.fn(),
  countVerdictsForRolls: vi.fn(async (): Promise<unknown[]> => []),
  findRollDetail: vi.fn(),
  listOpenRolls: vi.fn(async (): Promise<unknown[]> => []),
  findRollState: vi.fn(),
  insertRoll: vi.fn(),
  closeRoll: vi.fn(async (..._args: unknown[]) => true),
  nextRollNumber: vi.fn(async () => 7),
};
const refs = {
  findSupplier: vi.fn(async (): Promise<unknown> => ({
    id: "sp1",
    name: "Tannery A",
    isActive: true,
  })),
  listActiveSuppliers: vi.fn(),
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/roll.model", () => rolls);
vi.mock("@/server/models/reference-data.model", () => refs);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/roll.service");

const SC = { id: "sc1" };
const FM = { id: "fm1" };
const now = new Date("2026-10-24T02:00:00.000Z");
const state = (over: object = {}) => ({
  id: "r1",
  code: "R-2026-0007",
  tagCode: null,
  status: "OPEN",
  startedAt: new Date("2026-10-24T01:00:00Z"),
  createdById: "sc1",
  supplier: { name: "Tannery A" },
  _count: { scans: 4 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  rolls.closeRoll.mockResolvedValue(true);
  rolls.findRollState.mockResolvedValue(state());
});

describe("startRoll (Phase 26)", () => {
  it("numbers the roll by the Manila year, opens it now and audits roll.start", async () => {
    rolls.insertRoll.mockImplementation(async (data: Record<string, unknown>) =>
      state({ ...data, id: "r9", _count: { scans: 0 } }),
    );
    const roll = await svc.startRoll({ supplierId: "sp1", tagCode: "LR-0412" }, SC, now);
    expect(rolls.nextRollNumber).toHaveBeenCalledWith(2026, "tx");
    expect(rolls.insertRoll).toHaveBeenCalledWith(
      {
        code: "R-2026-0007",
        tagCode: "LR-0412",
        supplierId: "sp1",
        status: "OPEN",
        createdById: "sc1",
        startedAt: now,
        createdAt: now,
      },
      "tx",
    );
    expect(roll).toMatchObject({ id: "r9", code: "R-2026-0007", shots: 0, mine: true });
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.start",
        entity: "Roll",
        after: { code: "R-2026-0007", tagCode: "LR-0412", supplier: "Tannery A" },
      }),
    );
  });

  it("refuses an inactive or unknown supplier on the supplier field", async () => {
    for (const supplier of [null, { id: "sp1", name: "Old", isActive: false }]) {
      refs.findSupplier.mockResolvedValueOnce(supplier);
      await expect(svc.startRoll({ supplierId: "sp1" }, SC, now)).rejects.toMatchObject({
        status: 422,
        details: [{ path: ["supplierId"], message: "Choose the supplier this roll came from." }],
      });
    }
    expect(rolls.insertRoll).not.toHaveBeenCalled();
  });
});

describe("finishRoll", () => {
  it("closes an open roll with shots and audits roll.finish", async () => {
    await expect(svc.finishRoll("r1", SC, now)).resolves.toEqual({
      id: "r1",
      code: "R-2026-0007",
      status: "FINISHED",
      shots: 4,
    });
    expect(rolls.closeRoll).toHaveBeenCalledWith(
      "r1",
      { status: "FINISHED", finishedAt: now, finishedById: "sc1" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "roll.finish", before: { status: "OPEN" } }),
    );
  });

  it("refuses an empty roll (it is cancelled instead)", async () => {
    rolls.findRollState.mockResolvedValue(state({ _count: { scans: 0 } }));
    await expect(svc.finishRoll("r1", SC, now)).rejects.toMatchObject({ status: 409 });
    expect(rolls.closeRoll).not.toHaveBeenCalled();
  });

  it("answers 409 STALE when someone else closed it between read and write", async () => {
    rolls.closeRoll.mockResolvedValue(false);
    await expect(svc.finishRoll("r1", SC, now)).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("404s for an unknown roll", async () => {
    rolls.findRollState.mockResolvedValue(null);
    await expect(svc.finishRoll("nope", SC, now)).rejects.toMatchObject({ status: 404 });
  });
});

describe("cancelRoll", () => {
  it("cancels an empty roll at Capture, with no reason", async () => {
    rolls.findRollState.mockResolvedValue(state({ _count: { scans: 0 } }));
    await svc.cancelRoll("r1", { by: "capture" }, SC, now);
    expect(rolls.closeRoll).toHaveBeenCalledWith(
      "r1",
      { status: "CANCELLED", cancelledAt: now, cancelledById: "sc1", cancelledReason: null },
      "tx",
    );
  });

  it("refuses a roll with shots at Capture", async () => {
    await expect(svc.cancelRoll("r1", { by: "capture" }, SC, now)).rejects.toMatchObject({
      status: 409,
    });
    expect(rolls.closeRoll).not.toHaveBeenCalled();
  });

  it("lets the Floor Manager cancel a roll with shots, keeping the reason; nothing is deleted", async () => {
    await svc.cancelRoll("r1", { by: "manager", reason: "Wrong supplier" }, FM, now);
    expect(rolls.closeRoll).toHaveBeenCalledWith(
      "r1",
      {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: "fm1",
        cancelledReason: "Wrong supplier",
      },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "roll.cancel",
        after: { status: "CANCELLED", code: "R-2026-0007", shots: 4, reason: "Wrong supplier" },
      }),
    );
  });

  it("refuses a roll that is already finished", async () => {
    rolls.findRollState.mockResolvedValue(state({ status: "FINISHED" }));
    await expect(
      svc.cancelRoll("r1", { by: "manager", reason: "x" }, FM, now),
    ).rejects.toMatchObject({ status: 409, message: "This roll is already finished." });
  });
});

describe("resolveCaptureRoll: where a shot goes", () => {
  it("takes the roll chosen at Capture while it is open", async () => {
    await expect(svc.resolveCaptureRoll("r1", "website")).resolves.toEqual({
      id: "r1",
      code: "R-2026-0007",
      selection: "chosen",
    });
  });

  it("refuses a chosen roll that was finished or cancelled, naming it", async () => {
    rolls.findRollState.mockResolvedValue(state({ status: "CANCELLED" }));
    await expect(svc.resolveCaptureRoll("r1", "website")).rejects.toMatchObject({
      status: 409,
      code: "ROLL_CLOSED",
      message: expect.stringMatching(/^R-2026-0007 was finished or cancelled/),
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
      state({ id: "new", startedAt: new Date("2026-10-24T01:00:00Z") }),
      state({ id: "old", code: "R-2026-0001", startedAt: new Date("2026-10-23T01:00:00Z") }),
    ]);
    await expect(svc.resolveCaptureRoll(undefined, "device")).resolves.toEqual({
      id: "old",
      code: "R-2026-0001",
      selection: "oldest",
    });
    rolls.listOpenRolls.mockResolvedValue([]);
    await expect(svc.resolveCaptureRoll(undefined, "device")).rejects.toMatchObject({
      status: 409,
      code: "NO_OPEN_ROLL",
    });
  });
});

describe("open rolls for Capture", () => {
  it("lists every open roll and marks only the viewer's own, with no name (D-008)", async () => {
    rolls.listOpenRolls.mockResolvedValue([
      state({ id: "a", createdById: "sc1" }),
      state({ id: "b", createdById: "sc2" }),
    ]);
    const list = await svc.openRollsForCapture(SC);
    expect(list.map((r) => [r.id, r.mine])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(Object.keys(list[0]).sort()).toEqual(
      ["code", "id", "mine", "shots", "startedAt", "supplier", "tagCode"].sort(),
    );
  });
});

describe("Reports → Rolls (D-008)", () => {
  it("adds the passed and rejected counts and carries no person", async () => {
    rolls.listRolls.mockResolvedValue({
      rows: [
        {
          id: "r1",
          code: "R-2026-0007",
          tagCode: null,
          status: "FINISHED",
          startedAt: now,
          finishedAt: now,
          cancelledAt: null,
          supplier: { id: "sp1", name: "Tannery A" },
          _count: { scans: 10 },
        },
      ],
      total: 1,
    });
    rolls.countVerdictsForRolls.mockResolvedValue([
      { rollId: "r1", finalVerdict: "PASS", _count: { _all: 8 } },
      { rollId: "r1", finalVerdict: "REJECT", _count: { _all: 2 } },
    ]);
    const result = await svc.listRollsForReport({ status: "FINISHED", days: 7 }, now);
    expect(result).toMatchObject({ total: 1, page: 1, pageCount: 1 });
    expect(result.rows[0]).toMatchObject({ passed: 8, rejected: 2 });
    const [filters, page] = rolls.listRolls.mock.calls[0];
    expect(filters).toMatchObject({ status: "FINISHED" });
    expect(filters.since.toISOString()).toBe("2026-10-17T16:00:00.000Z"); // 18 Oct, Manila
    expect(page).toEqual({ skip: 0, take: 15 });
    for (const key of Object.keys(result.rows[0]))
      expect(key).not.toMatch(/user|createdBy|finishedBy|cancelledBy|email|name/i);
  });

  it("lets the Floor Manager cancel an open roll from its page, not a closed one", async () => {
    const detail = (status: string) => ({
      ...state({ status }),
      scans: [{ finalVerdict: "PASS" }, { finalVerdict: "REJECT" }],
    });
    rolls.findRollDetail.mockResolvedValue(detail("OPEN"));
    await expect(svc.getRollDetail("r1")).resolves.toMatchObject({
      passed: 1,
      rejected: 1,
      canCancel: true,
    });
    rolls.findRollDetail.mockResolvedValue(detail("FINISHED"));
    expect((await svc.getRollDetail("r1"))?.canCancel).toBe(false);
  });
});
