import { beforeEach, describe, expect, it, vi } from "vitest";

// Findings and repair jobs (Phase 34, D-130): the lines a failed batch is saved with, a repair's
// life from its stage, the suggestion and the report sections.

const types = [
  { id: "t1", key: "LIFTED_SOLE", label: "Lifted sole", isActive: true },
  { id: "t2", key: "GLUE_MARKS", label: "Glue marks", isActive: true },
  { id: "t3", key: "OTHER", label: "Other", isActive: true },
  { id: "t9", key: "OLD", label: "Old type", isActive: false },
];
let jobSeq = 0;
const job = (over: object = {}) => ({
  id: "j1",
  code: "RP-261120-2-1",
  findingId: "f1",
  parentId: null as string | null,
  pairs: 2,
  stage: "SOLE_ING" as string,
  status: "AT_STAGE" as string,
  sentAt: new Date("2026-11-20T04:00:00Z"),
  finding: {
    id: "f1",
    pairs: 2,
    note: null,
    finalDefectType: { key: "LIFTED_SOLE", label: "Lifted sole" },
    checkIn: { id: "ci1", day: new Date("2026-11-20"), batch: { code: "B-261120-2" } },
  },
  ...over,
});
const model = {
  listFinalDefectTypes: vi.fn(async () => types),
  listFindingsForCheckIn: vi.fn(async () => [] as unknown[]),
  listFindingsForCheckIns: vi.fn(async () => [] as unknown[]),
  listRepairStatusesOfCheckIns: vi.fn(async () => [] as unknown[]),
  listRepairsOfCheckIn: vi.fn(async () => [] as { status: string }[]),
  insertFinding: vi.fn(async (_c: string, line: { finalDefectTypeId: string }) => ({
    id: `f${++jobSeq}`,
    finalDefectType: { label: types.find((t) => t.id === line.finalDefectTypeId)!.label },
  })),
  insertRepair: vi.fn(async () => ({ id: `j${++jobSeq}` })),
  repairCodesWithPrefix: vi.fn(async () => [] as string[]),
  deleteFindingsOfCheckIn: vi.fn(async () => undefined),
  findRepair: vi.fn(async () => job() as unknown),
  transitionRepair: vi.fn(async () => true),
  setFindingRemedy: vi.fn(async () => undefined),
  suggestionFacts: vi.fn(async () => [] as unknown[]),
  findingsBetween: vi.fn(async () => [] as unknown[]),
  repairsBetween: vi.fn(async () => [] as unknown[]),
  unexplainedFailedPairs: vi.fn(async () => 0),
};
const assigned = vi.fn(async () => [] as { stage: string; userId: string; name: string }[]);
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/repair.model", () => model);
vi.mock("@/server/models/stage.model", () => ({ listAssignments: assigned }));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));

const svc = await import("@/server/services/repair.service");

const NOW = new Date("2026-11-20T06:00:00.000Z");
const FM = { id: "fm1", role: "FLOOR_MANAGER" as const };
const ANA = { id: "c1", role: "SHOE_CONSTRUCTOR" as const };

beforeEach(() => {
  vi.clearAllMocks();
  jobSeq = 0;
  model.findRepair.mockResolvedValue(job());
  model.transitionRepair.mockResolvedValue(true);
  assigned.mockResolvedValue([]);
});

describe("parseFindingLines", () => {
  it("returns the checked lines", async () => {
    const lines = await svc.parseFindingLines(2, [
      { finalDefectTypeId: "t1", pairs: "2", remedy: "FIXABLE", returnStage: "SOLE_ING" },
    ]);
    expect(lines).toEqual([
      { finalDefectTypeId: "t1", pairs: 2, remedy: "FIXABLE", returnStage: "SOLE_ING", note: null },
    ]);
  });

  it("throws field errors keyed by line and field, and a list-level message", async () => {
    await expect(
      svc.parseFindingLines(2, [{ finalDefectTypeId: "t1", pairs: "", remedy: "FIXABLE" }]),
    ).rejects.toMatchObject({
      status: 422,
      details: expect.arrayContaining([
        {
          path: ["findings", "0", "pairs"],
          message: "Enter how many pairs on line 1 (1 or more).",
        },
        {
          path: ["findings", "0", "returnStage"],
          message: "Choose the stage line 1 goes back to.",
        },
      ]),
    });
    await expect(
      svc.parseFindingLines(5, [{ finalDefectTypeId: "t1", pairs: "6", remedy: "NOT_FIXABLE" }]),
    ).rejects.toMatchObject({
      details: [
        {
          path: ["findings"],
          message:
            "The lines add up to 6 pairs, but 5 failed. Change the lines or the failed count.",
        },
      ],
    });
  });

  it("lets a correction keep a type switched off since", async () => {
    const line = { finalDefectTypeId: "t9", pairs: 1, remedy: "NOT_FIXABLE" };
    await expect(svc.parseFindingLines(1, [line])).rejects.toMatchObject({ status: 422 });
    await expect(svc.parseFindingLines(1, [line], new Set(["t9"]))).resolves.toHaveLength(1);
  });
});

describe("writeFindings (A-87)", () => {
  it("starts a repair job for each Fixable line, numbered within the batch, and none for Not fixable", async () => {
    model.repairCodesWithPrefix.mockResolvedValueOnce(["RP-261120-2-1"]);
    const r = await svc.writeFindings(
      {
        checkInId: "ci1",
        batchCode: "B-261120-2",
        actorId: "qi1",
        now: NOW,
        lines: [
          {
            finalDefectTypeId: "t1",
            pairs: 2,
            remedy: "FIXABLE",
            returnStage: "SOLE_ING",
            note: null,
          },
          {
            finalDefectTypeId: "t2",
            pairs: 1,
            remedy: "NOT_FIXABLE",
            returnStage: null,
            note: null,
          },
          {
            finalDefectTypeId: "t2",
            pairs: 3,
            remedy: "FIXABLE",
            returnStage: "FINISHING",
            note: null,
          },
        ],
      },
      "tx" as never,
    );
    expect(r.jobs).toEqual([
      { code: "RP-261120-2-2", pairs: 2, stage: "SOLE_ING" },
      { code: "RP-261120-2-3", pairs: 3, stage: "FINISHING" },
    ]);
    expect(model.insertRepair).toHaveBeenCalledTimes(2);
    expect(model.insertRepair).toHaveBeenCalledWith(
      expect.objectContaining({ code: "RP-261120-2-2", pairs: 2, stage: "SOLE_ING", sentAt: NOW }),
      "tx",
    );
    expect(recordAudit.mock.calls.map(([, a]) => (a as { action: string }).action)).toEqual([
      "repair.create",
      "repair.create",
    ]);
    expect(r.summary.map((s) => s.defect)).toEqual(["Lifted sole", "Glue marks", "Glue marks"]);
  });
});

describe("findingsState and the lock (A-93)", () => {
  it("can't change once a repair from the batch is back or done", async () => {
    model.listRepairsOfCheckIn.mockResolvedValueOnce([{ status: "AT_STAGE" }]);
    expect((await svc.findingsState("ci1")).locked).toBe(false);
    model.listRepairsOfCheckIn.mockResolvedValueOnce([
      { status: "AT_STAGE" },
      { status: "BACK_FOR_INSPECTION" },
    ]);
    expect((await svc.findingsState("ci1")).locked).toBe(true);
    model.listRepairsOfCheckIn.mockResolvedValueOnce([{ status: "DONE" }]);
    expect((await svc.findingsState("ci1")).locked).toBe(true);
  });

  it("rebuilds a batch's lines by removing the old ones first", async () => {
    await svc.rebuildFindings(
      { checkInId: "ci1", batchCode: "B-261120-2", actorId: "qi1", now: NOW, lines: [] },
      "tx" as never,
    );
    expect(model.deleteFindingsOfCheckIn).toHaveBeenCalledWith("ci1", "tx");
  });

  it("gives the lines of several batches as the form holds them", async () => {
    model.listFindingsForCheckIns.mockResolvedValueOnce([
      {
        checkInId: "ci1",
        finalDefectTypeId: "t1",
        pairs: 2,
        remedy: "FIXABLE",
        returnStage: "SOLE_ING",
        note: null,
        finalDefectType: { label: "Lifted sole" },
      },
    ]);
    model.listRepairStatusesOfCheckIns.mockResolvedValueOnce([
      { checkInId: "ci2", status: "DONE" },
    ]);
    const m = await svc.findingsForCheckIns(["ci1", "ci2"]);
    expect(m.get("ci1")).toMatchObject({
      lines: [
        {
          finalDefectTypeId: "t1",
          pairs: "2",
          remedy: "FIXABLE",
          returnStage: "SOLE_ING",
          note: "",
        },
      ],
      lockedReason: null,
    });
    expect(m.get("ci2")).toMatchObject({ lines: [], lockedReason: svc.LOCKED_MESSAGE });
  });
});

describe("markRepairBack (A-63)", () => {
  it("lets the constructor assigned to the job's stage today mark it back, and audits it", async () => {
    assigned.mockResolvedValue([{ stage: "SOLE_ING", userId: "c1", name: "Ana" }]);
    await expect(svc.markRepairBack("j1", ANA, NOW)).resolves.toEqual({
      id: "j1",
      code: "RP-261120-2-1",
    });
    expect(model.transitionRepair).toHaveBeenCalledWith(
      "j1",
      ["AT_STAGE"],
      { status: "BACK_FOR_INSPECTION", backAt: NOW, backById: "c1" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "repair.back", before: { status: "AT_STAGE" } }),
    );
  });

  it("refuses a constructor at another stage, and lets the Floor Manager mark any", async () => {
    assigned.mockResolvedValue([{ stage: "FINISHING", userId: "c1", name: "Ana" }]);
    await expect(svc.markRepairBack("j1", ANA, NOW)).rejects.toMatchObject({ status: 403 });
    await expect(svc.markRepairBack("j1", FM, NOW)).resolves.toMatchObject({
      code: "RP-261120-2-1",
    });
  });

  it("says already back when it already is, and stale when someone was first", async () => {
    model.findRepair.mockResolvedValueOnce(job({ status: "BACK_FOR_INSPECTION" }));
    await expect(svc.markRepairBack("j1", FM, NOW)).rejects.toMatchObject({
      status: 409,
      message: "RP-261120-2-1 is already back for inspection. Refresh to see it.",
    });
    model.transitionRepair.mockResolvedValueOnce(false);
    await expect(svc.markRepairBack("j1", FM, NOW)).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("404s a repair that doesn't exist", async () => {
    model.findRepair.mockResolvedValueOnce(null);
    await expect(svc.markRepairBack("nope", FM, NOW)).rejects.toMatchObject({ status: 404 });
  });
});

describe("changeRepair (A-63, A-87)", () => {
  it("moves an At-stage job with a reason", async () => {
    await svc.changeRepair(
      "j1",
      { action: "move", stage: "FINISHING", reason: "Needs finishing" },
      FM,
    );
    expect(model.transitionRepair).toHaveBeenCalledWith(
      "j1",
      ["AT_STAGE"],
      { stage: "FINISHING", changeReason: "Needs finishing" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "repair.move",
        before: { status: "AT_STAGE", stage: "SOLE_ING" },
      }),
    );
  });

  it("refuses a move to the stage it is already at", async () => {
    await expect(
      svc.changeRepair("j1", { action: "move", stage: "SOLE_ING", reason: "Same stage" }, FM),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("marks it Not fixable after all: cancelled, and its finding becomes Not fixable", async () => {
    await svc.changeRepair("j1", { action: "notFixable", reason: "Sole is torn" }, FM);
    expect(model.transitionRepair).toHaveBeenCalledWith(
      "j1",
      ["AT_STAGE"],
      { status: "CANCELLED", changeReason: "Sole is torn" },
      "tx",
    );
    expect(model.setFindingRemedy).toHaveBeenCalledWith(
      "f1",
      { remedy: "NOT_FIXABLE", returnStage: null },
      "tx",
    );
  });

  it("leaves the finding alone for a job that was sent back again", async () => {
    model.findRepair.mockResolvedValueOnce(job({ parentId: "j0" }));
    await svc.changeRepair("j1", { action: "notFixable", reason: "Sole is torn" }, FM);
    expect(model.setFindingRemedy).not.toHaveBeenCalled();
  });

  it("can't change one that is back, done or cancelled", async () => {
    for (const status of ["BACK_FOR_INSPECTION", "DONE", "CANCELLED"]) {
      model.findRepair.mockResolvedValueOnce(job({ status }));
      await expect(
        svc.changeRepair("j1", { action: "notFixable", reason: "Too late" }, FM),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect(model.transitionRepair).not.toHaveBeenCalled();
  });
});

describe("defectSuggestions (A-76)", () => {
  it("answers per defect type once there are five findings in the last 4 weeks", async () => {
    const at = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
    model.suggestionFacts.mockResolvedValueOnce(
      [1, 2, 3, 4, 5].map((d) => ({
        finalDefectTypeId: "t1",
        remedy: "FIXABLE",
        returnStage: "SOLE_ING",
        createdAt: at(d),
      })),
    );
    const out = await svc.defectSuggestions(NOW);
    expect(Object.keys(out)).toEqual(["t1"]);
    expect(out.t1.text).toBe("Usually fixable at Sole-ing, 5 of 5");
    model.suggestionFacts.mockResolvedValueOnce([]);
    expect(await svc.defectSuggestions(NOW)).toEqual({});
  });
});

describe("repairReport (A-89)", () => {
  const finding = (
    typeId: string,
    label: string,
    pairs: number,
    remedy: string,
    stage: string | null,
  ) => ({
    pairs,
    remedy,
    returnStage: stage,
    finalDefectType: { id: typeId, key: label.toUpperCase(), label, sortOrder: 1 },
    checkIn: { day: new Date("2026-11-20") },
  });

  it("counts defects, fixable shares, origins by stage and the Not fixable column", async () => {
    model.findingsBetween.mockResolvedValueOnce([
      finding("t1", "Lifted sole", 3, "FIXABLE", "SOLE_ING"),
      finding("t1", "Lifted sole", 1, "FIXABLE", "FINISHING"),
      finding("t1", "Lifted sole", 2, "NOT_FIXABLE", null),
      finding("t2", "Glue marks", 2, "FIXABLE", "FINISHING"),
    ]);
    model.unexplainedFailedPairs.mockResolvedValueOnce(2);
    const r = await svc.repairReport({ from: "2026-11-01", to: "2026-11-30" });
    expect(r.finalDefects.totalFailed).toBe(10);
    expect(r.finalDefects.notRecorded).toBe(2);
    expect(r.finalDefects.rows[0]).toMatchObject({
      label: "Lifted sole",
      pairs: 6,
      scrapped: 2,
      shareOfFailed: 0.6,
    });
    expect(r.finalDefects.rows[0].fixableShare).toBeCloseTo(4 / 6);
    const lifted = r.origins.rows[0];
    expect(lifted.byStage.map((s) => s.pairs)).toEqual([0, 0, 3, 1]);
    expect(lifted.scrapped).toBe(2);
    expect(lifted.scrappedShare).toBeCloseTo(2 / 6);
    expect(r.origins.stages.map((s) => s.label)).toEqual([
      "Preparation",
      "Construction",
      "Sole-ing",
      "Finishing",
    ]);
  });

  it("filters narrow the rows and keep every share a share of all failed pairs (A-101)", async () => {
    model.findingsBetween.mockResolvedValueOnce([
      finding("t1", "Lifted sole", 3, "FIXABLE", "SOLE_ING"),
      finding("t1", "Lifted sole", 2, "NOT_FIXABLE", null),
      finding("t2", "Glue marks", 4, "FIXABLE", "FINISHING"),
    ]);
    model.unexplainedFailedPairs.mockResolvedValueOnce(1);
    const r = await svc.repairReport(
      { from: "2026-11-01", to: "2026-11-30" },
      { defect: "GLUE MARKS", stage: "FINISHING" },
    );
    expect(r.finalDefects.rows).toHaveLength(1);
    expect(r.finalDefects.rows[0]).toMatchObject({ label: "Glue marks", pairs: 4 });
    // 4 of all 10 failed pairs, not of the filtered 4.
    expect(r.finalDefects.rows[0].shareOfFailed).toBeCloseTo(0.4);
    expect(r.finalDefects.totalFailed).toBe(10);
    // A pair with no reason has no defect type to match, so a filter leaves it out.
    expect(r.finalDefects.notRecorded).toBe(0);
    expect(r.origins.rows).toHaveLength(1);
  });

  it("sums the repairs and the time to inspection", async () => {
    const t = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
    model.repairsBetween.mockResolvedValueOnce([
      {
        status: "DONE",
        pairs: 2,
        stage: "SOLE_ING",
        sentAt: NOW,
        inspectedAt: t(4),
        passedPairs: 1,
        scrappedPairs: 1,
        resentPairs: 0,
      },
      {
        status: "DONE",
        pairs: 2,
        stage: "SOLE_ING",
        sentAt: NOW,
        inspectedAt: t(8),
        passedPairs: 0,
        scrappedPairs: 0,
        resentPairs: 2,
      },
      {
        status: "BACK_FOR_INSPECTION",
        pairs: 3,
        stage: "FINISHING",
        sentAt: NOW,
        inspectedAt: null,
        passedPairs: null,
        scrappedPairs: null,
        resentPairs: null,
      },
      {
        status: "AT_STAGE",
        pairs: 1,
        stage: "FINISHING",
        sentAt: NOW,
        inspectedAt: null,
        passedPairs: null,
        scrappedPairs: null,
        resentPairs: null,
      },
    ]);
    const r = await svc.repairReport({ from: "2026-11-01", to: "2026-11-30" });
    expect(r.repairs).toEqual({
      sent: 8,
      back: 7,
      passed: 1,
      scrapped: 1,
      sentAgain: 2,
      stillOpen: 1,
      averageHours: 6,
    });
  });

  it("carries no person", async () => {
    model.findingsBetween.mockResolvedValueOnce([
      finding("t1", "Lifted sole", 1, "FIXABLE", "SOLE_ING"),
    ]);
    const r = await svc.repairReport({ from: "2026-11-01", to: "2026-11-30" });
    const keys = (v: unknown): string[] =>
      v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]) : [];
    for (const bad of ["userId", "name", "enteredBy", "backBy", "inspectedBy"])
      expect(keys(r)).not.toContain(bad);
  });
});
