import { beforeEach, describe, expect, it, vi } from "vitest";

// Repairs in the Inspection queue and Inspect repair (Phase 34, D-130, A-64, A-65, A-88, A-90).

const NOW = new Date("2026-11-20T08:00:00.000Z"); // 16:00 Manila
const back = (over: object = {}) => ({
  id: "j1",
  code: "RP-261120-2-1",
  findingId: "f1",
  parentId: null as string | null,
  pairs: 5,
  stage: "SOLE_ING" as string,
  status: "BACK_FOR_INSPECTION" as string,
  sentAt: new Date("2026-11-20T03:00:00Z"),
  backAt: new Date("2026-11-20T05:00:00Z"),
  inspectedAt: null as Date | null,
  passedPairs: null as number | null,
  scrappedPairs: null as number | null,
  resentPairs: null as number | null,
  updatedAt: new Date("2026-11-20T06:00:00Z"),
  children: [] as { id: string; code: string; status: string; stage: string; pairs: number }[],
  finding: {
    id: "f1",
    pairs: 5,
    note: null as string | null,
    finalDefectType: { key: "LIFTED_SOLE", label: "Lifted sole" },
    checkIn: { id: "ci1", day: new Date("2026-11-20"), batch: { code: "B-261120-2" } },
  },
  ...over,
});
const repairModel = {
  listRepairsByStatus: vi.fn(async (_s: string[]) => [back()] as unknown[]),
  listFinishedRepairs: vi.fn(async () => [] as unknown[]),
  findRepair: vi.fn(async () => back() as unknown),
  insertRepair: vi.fn(async () => ({ id: "child" })),
  repairCodesWithPrefix: vi.fn(async () => ["RP-261120-2-1"]),
  transitionRepair: vi.fn(async () => true),
  // Phase 35B: the Floor Manager's correction
  correctRepairResult: vi.fn(async () => true),
  reshapeRepair: vi.fn(async () => true),
  deleteAtStageRepairs: vi.fn(async () => true),
};
const production = {
  ensureBatchRows: vi.fn(async () => ({ inserted: 0, linked: 0 })),
  assertMayEnter: vi.fn(async () => ({ covering: false })),
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
const doneModel = {
  listOpenBatchRows: vi.fn(async () => []),
  listDoneBatchRows: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
  findBatch: vi.fn(),
  findBatchBySlot: vi.fn(),
  updateBatch: vi.fn(),
};
vi.mock("@/server/models/production.model", () => doneModel);
vi.mock("@/server/models/repair.model", () => repairModel);
vi.mock("@/server/services/repair.service", () => ({
  findingsForCheckIns: vi.fn(async () => new Map()),
}));
vi.mock("@/server/models/roll.model", () => ({ listRollsFinishedWithItem: vi.fn(async () => []) }));
vi.mock("@/server/services/production.service", () => production);
vi.mock("@/server/services/attendance.service", () => ({
  qualityInspectorPresentOn: vi.fn(async () => true),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));

const svc = await import("@/server/services/batch-queue.service");

const QI = { id: "qi1", role: "QUALITY_INSPECTOR" as const };
const VIEWER = { id: "qi1", role: "QUALITY_INSPECTOR" as const };

beforeEach(() => {
  vi.clearAllMocks();
  repairModel.listRepairsByStatus.mockResolvedValue([back()]);
  repairModel.listFinishedRepairs.mockResolvedValue([]);
  repairModel.findRepair.mockResolvedValue(back());
  repairModel.transitionRepair.mockResolvedValue(true);
  repairModel.repairCodesWithPrefix.mockResolvedValue(["RP-261120-2-1"]);
  repairModel.correctRepairResult.mockResolvedValue(true);
  repairModel.reshapeRepair.mockResolvedValue(true);
  repairModel.deleteAtStageRepairs.mockResolvedValue(true);
});

describe("repairs in the queue (A-65, A-90)", () => {
  it("lists a repair back for inspection with its batch, defect, stage and wait, never Late", async () => {
    const q = await svc.inspectionQueue(VIEWER, {}, NOW);
    expect(q.repairs).toHaveLength(1);
    expect(q.repairs[0]).toMatchObject({
      code: "RP-261120-2-1",
      batchCode: "B-261120-2",
      defect: "Lifted sole",
      pairs: 5,
      stageLabel: "Sole-ing",
      waiting: "Waiting 3 hours",
    });
    expect(q.repairs[0]).not.toHaveProperty("state");
  });

  it("isn't in the batch counts that feed the tab's due count", async () => {
    const q = await svc.inspectionQueue(VIEWER, {}, NOW);
    expect(q.total).toBe(0);
    expect(q.repairsTotal).toBe(1);
  });

  it("puts the one that waited longest first", async () => {
    repairModel.listRepairsByStatus.mockResolvedValue([
      back({ id: "j2", code: "RP-261120-2-2", backAt: new Date("2026-11-20T06:00:00Z") }),
      back({ id: "j1", code: "RP-261120-2-1", backAt: new Date("2026-11-20T04:00:00Z") }),
    ]);
    const q = await svc.inspectionQueue(VIEWER, {}, NOW);
    expect(q.repairs.map((r) => r.code)).toEqual(["RP-261120-2-1", "RP-261120-2-2"]);
  });

  it("filters by the day it came back and by code; Urgent and Late are about batches", async () => {
    expect((await svc.inspectionQueue(VIEWER, { day: "2026-11-19" }, NOW)).repairs).toHaveLength(0);
    expect((await svc.inspectionQueue(VIEWER, { day: "2026-11-20" }, NOW)).repairs).toHaveLength(1);
    expect((await svc.inspectionQueue(VIEWER, { q: "rp-261120" }, NOW)).repairs).toHaveLength(1);
    expect((await svc.inspectionQueue(VIEWER, { q: "B-26" }, NOW)).repairs).toHaveLength(0);
    expect((await svc.inspectionQueue(VIEWER, { priority: "URGENT" }, NOW)).repairs).toHaveLength(
      0,
    );
    expect((await svc.inspectionQueue(VIEWER, { status: "LATE" }, NOW)).repairs).toHaveLength(0);
    expect((await svc.inspectionQueue(VIEWER, { status: "WAITING" }, NOW)).repairs).toHaveLength(1);
  });

  it("shows inspected repairs for 7 days with what happened to the pairs", async () => {
    repairModel.listFinishedRepairs.mockResolvedValue([
      back({
        status: "DONE",
        inspectedAt: new Date("2026-11-20T07:00:00Z"),
        passedPairs: 3,
        scrappedPairs: 1,
        resentPairs: 1,
      }),
    ]);
    const q = await svc.inspectionQueue(VIEWER, {}, NOW);
    expect(q.repairsDone[0].result).toEqual({
      passedPairs: 3,
      scrappedPairs: 1,
      resentPairs: 1,
      at: "Fri, 20 Nov 15:00",
      resend: [],
    });
  });

  it("lets only the Floor Manager correct an inspection, and says why one is locked (A-105)", async () => {
    const done = back({
      status: "DONE",
      inspectedAt: new Date("2026-11-20T07:00:00Z"),
      passedPairs: 3,
      scrappedPairs: 0,
      resentPairs: 2,
      children: [
        {
          id: "c1",
          code: "RP-261120-2-2",
          status: "BACK_FOR_INSPECTION",
          stage: "FINISHING",
          pairs: 2,
        },
      ],
    });
    repairModel.listFinishedRepairs.mockResolvedValue([done]);
    const asQi = (await svc.inspectionQueue(VIEWER, {}, NOW)).repairsDone[0];
    expect(asQi.correctable).toBe(false);
    const fm = { id: "fm1", role: "FLOOR_MANAGER" as const };
    const asFm = (await svc.inspectionQueue(fm, {}, NOW)).repairsDone[0];
    expect(asFm).toMatchObject({
      correctable: true,
      lockedReason:
        "RP-261120-2-2, sent back from RP-261120-2-1, is already back for inspection, so this inspection can't change.",
    });
  });

  it("looks up a past day: that day's batches and the repairs inspected on it", async () => {
    await svc.inspectionQueue(VIEWER, { doneDay: "2026-11-10" }, NOW);
    expect(doneModel.listDoneBatchRows).toHaveBeenCalledWith("2026-11-10", "2026-11-10");
    // The repairs inspected between that day's start and the next day's start (Manila).
    expect(repairModel.listFinishedRepairs).toHaveBeenCalledWith(
      new Date("2026-11-09T16:00:00.000Z"),
      new Date("2026-11-10T16:00:00.000Z"),
    );
    // A day after today is ignored: the last 7 days as before.
    await svc.inspectionQueue(VIEWER, { doneDay: "2026-12-30" }, NOW);
    expect(doneModel.listDoneBatchRows).toHaveBeenLastCalledWith("2026-11-13", undefined);
  });
});

describe("correctRepairInspection (Phase 35B, A-105)", () => {
  const FM = { id: "fm1", role: "FLOOR_MANAGER" as const };
  const done = (over: object = {}) =>
    back({
      status: "DONE",
      inspectedAt: new Date("2026-11-20T07:00:00Z"),
      passedPairs: 3,
      scrappedPairs: 0,
      resentPairs: 2,
      children: [
        { id: "c1", code: "RP-261120-2-2", status: "AT_STAGE", stage: "FINISHING", pairs: 2 },
      ],
      ...over,
    });
  const input = (over: object = {}) => ({
    expectedUpdatedAt: "2026-11-20T06:00:00.000Z",
    passedPairs: 4,
    scrappedPairs: 0,
    resend: [{ stage: "FINISHING", pairs: 1 }],
    reason: "One pair passed after all",
    ...over,
  });
  beforeEach(() => repairModel.findRepair.mockResolvedValue(done()));

  it("changes the split, keeps the child job and its code, and audits both results with the reason", async () => {
    const r = await svc.correctRepairInspection("j1", input(), FM, NOW);
    expect(r).toMatchObject({ code: "RP-261120-2-1", passedPairs: 4, children: ["RP-261120-2-2"] });
    expect(repairModel.correctRepairResult).toHaveBeenCalledWith(
      "j1",
      new Date("2026-11-20T06:00:00Z"),
      { passedPairs: 4, scrappedPairs: 0, resentPairs: 1 },
      "tx",
    );
    expect(repairModel.reshapeRepair).toHaveBeenCalledWith(
      "c1",
      { stage: "FINISHING", pairs: 1 },
      "tx",
    );
    expect(repairModel.insertRepair).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "repair.inspect.correct",
        before: {
          passedPairs: 3,
          scrappedPairs: 0,
          resentPairs: 2,
          sentBack: [{ code: "RP-261120-2-2", stage: "FINISHING", pairs: 2 }],
        },
        after: expect.objectContaining({
          passedPairs: 4,
          resentPairs: 1,
          reason: "One pair passed after all",
          sentBack: [{ code: "RP-261120-2-2", stage: "FINISHING", pairs: 1 }],
        }),
      }),
    );
  });

  it("removes the child when nothing is sent back any more, and adds one when more are", async () => {
    await svc.correctRepairInspection("j1", input({ passedPairs: 5, resend: [] }), FM, NOW);
    expect(repairModel.deleteAtStageRepairs).toHaveBeenCalledWith(["c1"], "tx");
    vi.clearAllMocks();
    repairModel.findRepair.mockResolvedValue(done());
    repairModel.correctRepairResult.mockResolvedValue(true);
    repairModel.deleteAtStageRepairs.mockResolvedValue(true);
    repairModel.reshapeRepair.mockResolvedValue(true);
    repairModel.repairCodesWithPrefix.mockResolvedValue(["RP-261120-2-1", "RP-261120-2-2"]);
    const r = await svc.correctRepairInspection(
      "j1",
      input({
        passedPairs: 1,
        resend: [
          { stage: "FINISHING", pairs: 2 },
          { stage: "SOLE_ING", pairs: 2 },
        ],
      }),
      FM,
      NOW,
    );
    expect(r.children).toEqual(["RP-261120-2-2", "RP-261120-2-3"]);
    expect(repairModel.insertRepair).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "RP-261120-2-3",
        parentId: "j1",
        stage: "SOLE_ING",
        pairs: 2,
      }),
      "tx",
    );
  });

  it("is locked once a job it sent back is Back, inspected or marked Not fixable", async () => {
    for (const status of ["BACK_FOR_INSPECTION", "DONE", "CANCELLED"]) {
      repairModel.findRepair.mockResolvedValue(
        done({
          children: [{ id: "c1", code: "RP-261120-2-2", status, stage: "FINISHING", pairs: 2 }],
        }),
      );
      await expect(svc.correctRepairInspection("j1", input(), FM, NOW)).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining("so this inspection can't change"),
      });
    }
    expect(repairModel.correctRepairResult).not.toHaveBeenCalled();
  });

  it("keeps the total, needs a change, and only corrects an inspected job", async () => {
    await expect(
      svc.correctRepairInspection("j1", input({ passedPairs: 5 }), FM, NOW),
    ).rejects.toMatchObject({
      status: 422,
      details: [{ path: ["result"], message: expect.stringContaining("add up to") }],
    });
    await expect(
      svc.correctRepairInspection(
        "j1",
        input({ passedPairs: 3, resend: [{ stage: "FINISHING", pairs: 2 }] }),
        FM,
        NOW,
      ),
    ).rejects.toMatchObject({
      details: [
        { path: ["result"], message: "Nothing changed. Change a number, or close this window." },
      ],
    });
    repairModel.findRepair.mockResolvedValue(back());
    await expect(svc.correctRepairInspection("j1", input(), FM, NOW)).rejects.toMatchObject({
      status: 409,
      message: "RP-261120-2-1 hasn't been inspected yet. Inspect it from the queue.",
    });
    repairModel.findRepair.mockResolvedValue(null);
    await expect(svc.correctRepairInspection("j1", input(), FM, NOW)).rejects.toMatchObject({
      status: 404,
    });
    expect(repairModel.correctRepairResult).not.toHaveBeenCalled();
  });

  it("is stale when someone saved first, before or during the save", async () => {
    await expect(
      svc.correctRepairInspection(
        "j1",
        input({ expectedUpdatedAt: "2026-11-20T05:00:00.000Z" }),
        FM,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
    repairModel.correctRepairResult.mockResolvedValueOnce(false);
    await expect(svc.correctRepairInspection("j1", input(), FM, NOW)).rejects.toMatchObject({
      code: "STALE",
    });
    repairModel.reshapeRepair.mockResolvedValueOnce(false);
    await expect(svc.correctRepairInspection("j1", input(), FM, NOW)).rejects.toMatchObject({
      code: "STALE",
    });
  });
});

describe("inspectRepair (A-64, A-88)", () => {
  it("records passed, scrapped and sent back again, makes the child job, and audits", async () => {
    const r = await svc.inspectRepair(
      "j1",
      { passedPairs: "2", scrappedPairs: "1", resend: [{ stage: "FINISHING", pairs: 2 }] },
      QI,
      NOW,
    );
    expect(r).toMatchObject({ code: "RP-261120-2-1", passedPairs: 2, scrappedPairs: 1 });
    expect(r.children).toEqual([{ code: "RP-261120-2-2", pairs: 2, stage: "FINISHING" }]);
    expect(repairModel.transitionRepair).toHaveBeenCalledWith(
      "j1",
      ["BACK_FOR_INSPECTION"],
      {
        status: "DONE",
        inspectedAt: NOW,
        inspectedById: "qi1",
        passedPairs: 2,
        scrappedPairs: 1,
        resentPairs: 2,
      },
      "tx",
    );
    // The child is the same finding, from this job, at its stage, with the next number.
    expect(repairModel.insertRepair).toHaveBeenCalledWith(
      {
        code: "RP-261120-2-2",
        findingId: "f1",
        parentId: "j1",
        pairs: 2,
        stage: "FINISHING",
        sentAt: NOW,
      },
      "tx",
    );
    expect(recordAudit.mock.calls.map(([, a]) => (a as { action: string }).action)).toEqual([
      "repair.create",
      "repair.inspect",
    ]);
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({
        after: expect.objectContaining({
          passedPairs: 2,
          scrappedPairs: 1,
          resentPairs: 2,
          sentBackAs: ["RP-261120-2-2"],
        }),
      }),
    );
  });

  it("takes a repair that fails again as often as the QI says (no limit)", async () => {
    repairModel.findRepair.mockResolvedValue(back({ code: "RP-261120-2-4", parentId: "j0" }));
    repairModel.repairCodesWithPrefix.mockResolvedValue(["RP-261120-2-1", "RP-261120-2-4"]);
    const r = await svc.inspectRepair("j1", { resend: [{ stage: "SOLE_ING", pairs: 5 }] }, QI, NOW);
    expect(r.children[0].code).toBe("RP-261120-2-5");
  });

  it("names the numbers when they don't add up, and saves nothing", async () => {
    await expect(
      svc.inspectRepair("j1", { passedPairs: 3, scrappedPairs: 1 }, QI, NOW),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["result"],
          message:
            "Passed, scrapped and sent back again add up to 4, but this repair has 5 pairs. Change the numbers.",
        },
      ],
    });
    await expect(
      svc.inspectRepair("j1", { passedPairs: 4, resend: [{ pairs: 1 }] }, QI, NOW),
    ).rejects.toMatchObject({
      details: [{ path: ["resend", "0"], message: "Choose the stage line 1 goes back to." }],
    });
    expect(repairModel.transitionRepair).not.toHaveBeenCalled();
  });

  it("only inspects one that is back, and says so otherwise", async () => {
    repairModel.findRepair.mockResolvedValue(back({ status: "AT_STAGE" }));
    await expect(svc.inspectRepair("j1", { passedPairs: 5 }, QI, NOW)).rejects.toMatchObject({
      status: 409,
    });
    repairModel.findRepair.mockResolvedValue(back({ status: "DONE" }));
    await expect(svc.inspectRepair("j1", { passedPairs: 5 }, QI, NOW)).rejects.toMatchObject({
      status: 409,
    });
    repairModel.findRepair.mockResolvedValue(null);
    await expect(svc.inspectRepair("j1", { passedPairs: 5 }, QI, NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("is stale for the second of two inspectors, and follows who may inspect (A-82)", async () => {
    repairModel.transitionRepair.mockResolvedValueOnce(false);
    await expect(svc.inspectRepair("j1", { passedPairs: 5 }, QI, NOW)).rejects.toMatchObject({
      code: "STALE",
    });
    production.assertMayEnter.mockRejectedValueOnce(
      Object.assign(new Error("no"), { status: 403 }),
    );
    await expect(
      svc.inspectRepair("j1", { passedPairs: 5 }, { id: "fm", role: "FLOOR_MANAGER" }, NOW),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});
