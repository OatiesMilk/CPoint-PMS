import { beforeEach, describe, expect, it, vi } from "vitest";

// Stage assignments, counts, My stage and the work in progress board (Phase 34, D-130).

const stage = {
  listActiveConstructors: vi.fn(async () => [
    { id: "c1", name: "Ana Reyes", canCapture: false },
    { id: "c2", name: "Ben Cruz", canCapture: false },
    { id: "c3", name: "Cora Dizon", canCapture: false },
    { id: "cap", name: "Sam Lopez", canCapture: true },
  ]),
  // Addendum 1: the saved rows, and the people with Capture access (always at Preparation).
  listStoredAssignments: vi.fn(
    async (_day: string) => [] as { stage: string; userId: string; name: string }[],
  ),
  listCaptureConstructors: vi.fn(async () => [] as { id: string; name: string }[]),
  // What the model does: the saved rows with the Capture-access people added at Preparation.
  listAssignments: vi.fn(async (day: string) => [
    ...(await stage.listStoredAssignments(day)),
    ...(await stage.listCaptureConstructors()).map((c) => ({
      stage: "PREPARATION",
      userId: c.id,
      name: c.name,
    })),
  ]),
  replaceAssignments: vi.fn(async () => undefined),
  insertCount: vi.fn(async () => ({ id: "sc1" })),
  listCounts: vi.fn(
    async (_from: string, _to: string) =>
      [] as { day: string; stage: string; pairs: number; enteredAt: Date }[],
  ),
};
const plan = (day: string, kind = "PLANNED") => ({ day, kind });
const production = {
  listDayPlans: vi.fn(async (_from: string, _to: string) => [] as { day: string; kind: string }[]),
  listBatchRows: vi.fn(async () => [] as unknown[]),
  listOpenBatchRows: vi.fn(async () => [] as unknown[]),
};
const repairs = { listRepairsByStatus: vi.fn(async (_s: string[]) => [] as unknown[]) };
const attendance = {
  getAttendanceDay: vi.fn(async () => ({
    taken: false,
    roster: [] as { id: string; present: boolean }[],
  })),
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/stage.model", () => stage);
vi.mock("@/server/models/production.model", () => production);
vi.mock("@/server/models/repair.model", () => repairs);
vi.mock("@/server/models/roll.model", () => ({ countOpenRolls: vi.fn(async () => 2) }));
vi.mock("@/server/services/roll.service", () => ({
  rollsScannedByDay: vi.fn(async () => new Map([["2026-11-20", 7]])),
}));
vi.mock("@/server/services/attendance.service", () => attendance);
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));

const svc = await import("@/server/services/stage.service");

const FM = { id: "fm1", role: "FLOOR_MANAGER" as const };
const QI = { id: "qi1", role: "QUALITY_INSPECTOR" as const };
const ANA = { id: "c1", role: "SHOE_CONSTRUCTOR" as const };
// Fri 20 Nov 2026, 14:05 in Manila.
const NOW = new Date("2026-11-20T06:05:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  stage.listStoredAssignments.mockResolvedValue([]);
  stage.listCaptureConstructors.mockResolvedValue([]);
  stage.listAssignments.mockImplementation(async (day: string) => [
    ...(await stage.listStoredAssignments(day)),
    ...(await stage.listCaptureConstructors()).map((c) => ({
      stage: "PREPARATION",
      userId: c.id,
      name: c.name,
    })),
  ]);
  stage.listCounts.mockResolvedValue([]);
  production.listDayPlans.mockResolvedValue([plan("2026-11-20")]);
});

describe("parseCount", () => {
  it("takes a whole number from 0 and says how to fix anything else", () => {
    expect(svc.parseCount("12")).toEqual({ ok: true, pairs: 12 });
    expect(svc.parseCount(0)).toEqual({ ok: true, pairs: 0 });
    for (const bad of ["", "abc", "-1", "1.5", undefined])
      expect(svc.parseCount(bad)).toMatchObject({
        ok: false,
        message: "Enter the pairs here now as a whole number, like 12. Enter 0 if none.",
      });
    expect(svc.parseCount("50001")).toMatchObject({ ok: false });
  });
});

describe("saveStageCount (A-72, A-73)", () => {
  it("lets a constructor count the stage they are assigned to today, and audits it", async () => {
    stage.listAssignments.mockResolvedValue([
      { stage: "SOLE_ING", userId: "c1", name: "Ana Reyes" },
    ]);
    const r = await svc.saveStageCount({ stage: "SOLE_ING", pairs: "14" }, ANA, NOW);
    expect(r).toEqual({ stage: "SOLE_ING", pairs: 14, at: "14:05" });
    expect(stage.insertCount).toHaveBeenCalledWith(
      expect.objectContaining({
        day: "2026-11-20",
        stage: "SOLE_ING",
        pairs: 14,
        enteredById: "c1",
      }),
      "tx",
    );
    // Who entered it is in the audit log only.
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        actor: { type: "USER", userId: "c1" },
        action: "stage.count",
        after: expect.objectContaining({ stage: "SOLE_ING", pairs: 14 }),
      }),
    );
  });

  it("refuses a constructor for another stage, with the fix", async () => {
    stage.listAssignments.mockResolvedValue([
      { stage: "SOLE_ING", userId: "c1", name: "Ana Reyes" },
    ]);
    await expect(
      svc.saveStageCount({ stage: "FINISHING", pairs: "3" }, ANA, NOW),
    ).rejects.toMatchObject({
      status: 403,
      message: "You are not assigned to Finishing today. Ask the Floor Manager.",
    });
    expect(stage.insertCount).not.toHaveBeenCalled();
  });

  it("refuses an unassigned constructor and the QI, lets the Floor Manager count any stage", async () => {
    await expect(
      svc.saveStageCount({ stage: "SOLE_ING", pairs: "3" }, ANA, NOW),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      svc.saveStageCount({ stage: "SOLE_ING", pairs: "3" }, QI, NOW),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      svc.saveStageCount({ stage: "FINISHING", pairs: "3" }, FM, NOW),
    ).resolves.toMatchObject({ pairs: 3 });
  });

  it("names the field when the number is wrong", async () => {
    await expect(
      svc.saveStageCount({ stage: "FINISHING", pairs: "x" }, FM, NOW),
    ).rejects.toMatchObject({
      status: 422,
    });
    expect(stage.insertCount).not.toHaveBeenCalled();
  });

  it("links the count to the batch whose interval holds the moment", async () => {
    production.listBatchRows.mockResolvedValueOnce([
      {
        id: "b2",
        code: "B-261120-2",
        startAt: new Date("2026-11-20T04:00:00Z"),
        slotAt: new Date("2026-11-20T09:00:00Z"),
      },
    ]);
    await svc.saveStageCount({ stage: "FINISHING", pairs: 1 }, FM, NOW);
    expect(stage.insertCount).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "b2" }),
      "tx",
    );
    await svc.saveStageCount({ stage: "FINISHING", pairs: 1 }, FM, NOW);
    expect(stage.insertCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ batchId: null }),
      "tx",
    );
  });
});

describe("saveStageAssignments (A-74, A-86)", () => {
  const input = (...groups: [string, string[]][]) => ({
    assignments: groups.map(([stage, userIds]) => ({ stage: stage as never, userIds })),
  });

  it("saves a planned day, one stage per person, and audits before and after", async () => {
    stage.listStoredAssignments.mockResolvedValue([
      { stage: "PREPARATION", userId: "c1", name: "Ana Reyes" },
    ]);
    const r = await svc.saveStageAssignments(
      "2026-11-20",
      input(["SOLE_ING", ["c1", "c2"]], ["FINISHING", ["c2"]]),
      FM,
      NOW,
    );
    expect(r).toEqual({ day: "2026-11-20", saved: true, count: 2 });
    expect(stage.replaceAssignments).toHaveBeenCalledWith(
      "2026-11-20",
      [
        { userId: "c1", stage: "SOLE_ING" },
        { userId: "c2", stage: "FINISHING" },
      ],
      "fm1",
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "stage.assign",
        before: { day: "2026-11-20", assignments: [{ userId: "c1", stage: "PREPARATION" }] },
      }),
    );
  });

  it("needs a planned day and not a past one", async () => {
    production.listDayPlans.mockResolvedValue([]);
    await expect(svc.saveStageAssignments("2026-11-20", input(), FM, NOW)).rejects.toMatchObject({
      status: 409,
      message: "Plan the day first.",
    });
    production.listDayPlans.mockResolvedValue([plan("2026-11-19")]);
    await expect(svc.saveStageAssignments("2026-11-19", input(), FM, NOW)).rejects.toMatchObject({
      status: 409,
      message: "This day has passed, so who worked where can't change.",
    });
    expect(stage.replaceAssignments).not.toHaveBeenCalled();
  });

  it("keeps a later planned day editable, locked plan or not", async () => {
    production.listDayPlans.mockResolvedValue([plan("2026-11-24")]);
    await expect(
      svc.saveStageAssignments("2026-11-24", input(["SOLE_ING", ["c1"]]), FM, NOW),
    ).resolves.toMatchObject({ saved: true });
  });

  it("refuses someone who isn't an active constructor", async () => {
    await expect(
      svc.saveStageAssignments("2026-11-20", input(["SOLE_ING", ["nobody"]]), FM, NOW),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("stageAssignmentsFor", () => {
  it("suggests the last working day's stages for an empty day, dropping people who left", async () => {
    production.listDayPlans.mockResolvedValue([plan("2026-11-19"), plan("2026-11-20")]);
    stage.listStoredAssignments.mockImplementation(async (day: string) =>
      day === "2026-11-19"
        ? [
            { stage: "SOLE_ING", userId: "c1", name: "Ana Reyes" },
            { stage: "FINISHING", userId: "gone", name: "Gone" },
          ]
        : [],
    );
    const v = await svc.stageAssignmentsFor("2026-11-20", NOW);
    expect(v.editable).toBe(true);
    expect(v.assignments).toEqual([]);
    expect(v.prefill).toMatchObject({
      from: "2026-11-19",
      assignments: [{ userId: "c1", stage: "SOLE_ING" }],
    });
  });

  it("flags the constructors marked absent that day", async () => {
    attendance.getAttendanceDay.mockResolvedValueOnce({
      taken: true,
      roster: [
        { id: "c1", present: true },
        { id: "c2", present: false },
      ],
    });
    const v = await svc.stageAssignmentsFor("2026-11-20", NOW);
    expect(v.constructors.find((c) => c.id === "c2")?.absent).toBe(true);
    expect(v.constructors.find((c) => c.id === "c1")?.absent).toBe(false);
  });

  it("is read-only for an unplanned or past day", async () => {
    production.listDayPlans.mockResolvedValue([]);
    expect((await svc.stageAssignmentsFor("2026-11-20", NOW)).lockedReason).toBe(
      "Plan the day first.",
    );
    production.listDayPlans.mockResolvedValue([plan("2026-11-18")]);
    const v = await svc.stageAssignmentsFor("2026-11-18", NOW);
    expect(v.editable).toBe(false);
    expect(v.prefill).toBeNull();
  });
});

describe("Capture-access constructors are at Preparation (Addendum 1, A-95, A-96)", () => {
  const input = (...groups: [string, string[]][]) => ({
    assignments: groups.map(([stage, userIds]) => ({ stage: stage as never, userIds })),
  });
  const CAP = { id: "cap", role: "SHOE_CONSTRUCTOR" as const };

  it("rejects one assigned anywhere but Preparation, with the fix, and saves nothing", async () => {
    await expect(
      svc.saveStageAssignments("2026-11-20", input(["SOLE_ING", ["cap"]]), FM, NOW),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["assignments"],
          message:
            "Sam is a shoe constructor with Capture access, so Sam works at Preparation. Choose Preparation, or ask the Admin to remove Capture access first.",
        },
      ],
    });
    expect(stage.replaceAssignments).not.toHaveBeenCalled();
  });

  it("accepts one at Preparation but stores no row for them (it comes from the flag)", async () => {
    await svc.saveStageAssignments(
      "2026-11-20",
      input(["PREPARATION", ["cap", "c1"]], ["SOLE_ING", ["c2"]]),
      FM,
      NOW,
    );
    expect(stage.replaceAssignments).toHaveBeenCalledWith(
      "2026-11-20",
      [
        { userId: "c1", stage: "PREPARATION" },
        { userId: "c2", stage: "SOLE_ING" },
      ],
      "fm1",
      "tx",
    );
  });

  it("lets constructors without Capture access go to any stage, Preparation included (A-96)", async () => {
    await expect(
      svc.saveStageAssignments(
        "2026-11-20",
        input(["PREPARATION", ["c1"]], ["FINISHING", ["c2", "c3"]]),
        FM,
        NOW,
      ),
    ).resolves.toMatchObject({ saved: true, count: 3 });
  });

  it("marks them in the Plan dialog and keeps them out of the saved rows and the suggestion", async () => {
    production.listDayPlans.mockResolvedValue([plan("2026-11-19"), plan("2026-11-20")]);
    stage.listStoredAssignments.mockImplementation(async (day: string) =>
      day === "2026-11-19"
        ? [
            { stage: "SOLE_ING", userId: "c1", name: "Ana Reyes" },
            { stage: "FINISHING", userId: "cap", name: "Sam Lopez" },
          ]
        : [],
    );
    const v = await svc.stageAssignmentsFor("2026-11-20", NOW);
    expect(v.constructors.find((c) => c.id === "cap")?.captureAccess).toBe(true);
    expect(v.constructors.find((c) => c.id === "c1")?.captureAccess).toBe(false);
    expect(v.assignments).toEqual([]);
    expect(v.prefill?.assignments).toEqual([{ userId: "c1", stage: "SOLE_ING" }]);
  });

  it("applies a flag change at once: My stage, the board and the counts follow the flag", async () => {
    // Flag on: Sam is at Preparation with no saved row.
    stage.listCaptureConstructors.mockResolvedValue([{ id: "cap", name: "Sam Lopez" }]);
    const on = await svc.myStage({ id: "cap" }, NOW);
    expect(on).toMatchObject({ stage: "PREPARATION", captureAccess: true });
    const board = await svc.wipBoard(FM, NOW);
    expect(board.cards[0].assigned).toBe("Assigned today: Sam Lopez");
    await expect(
      svc.saveStageCount({ stage: "PREPARATION", pairs: "12" }, CAP, NOW),
    ).resolves.toMatchObject({ pairs: 12 });
    // A constructor can enter a count only for their own stage.
    await expect(
      svc.saveStageCount({ stage: "FINISHING", pairs: "3" }, CAP, NOW),
    ).rejects.toMatchObject({ status: 403 });
    // Flag off: no stage today.
    stage.listCaptureConstructors.mockResolvedValue([]);
    expect(await svc.myStage({ id: "cap" }, NOW)).toBeNull();
    expect((await svc.wipBoard(FM, NOW)).cards[0].assigned).toBeNull();
  });

  it("puts a Capture-access person with a saved row at Preparation only", async () => {
    // The row was saved before they were given access; the model ignores it (listStoredAssignments).
    stage.listCaptureConstructors.mockResolvedValue([{ id: "cap", name: "Sam Lopez" }]);
    const m = await svc.myStage({ id: "cap" }, NOW);
    expect(m?.stage).toBe("PREPARATION");
  });
});

describe("myStage (A-73)", () => {
  it("is null when the constructor isn't assigned", async () => {
    expect(await svc.myStage({ id: "c1" }, NOW)).toBeNull();
  });

  it("gives the shared count, the repairs at the stage and the reminder", async () => {
    stage.listAssignments.mockResolvedValue([
      { stage: "SOLE_ING", userId: "c1", name: "Ana Reyes" },
    ]);
    stage.listCounts.mockResolvedValue([
      {
        day: "2026-11-20",
        stage: "SOLE_ING",
        pairs: 9,
        enteredAt: new Date("2026-11-20T02:00:00Z"),
      },
      {
        day: "2026-11-20",
        stage: "SOLE_ING",
        pairs: 14,
        enteredAt: new Date("2026-11-20T03:05:00Z"),
      },
    ]);
    production.listBatchRows.mockResolvedValueOnce([
      { code: "B-261120-1", slotAt: new Date("2026-11-20T04:00:00Z"), status: "OPEN" },
    ]);
    repairs.listRepairsByStatus.mockResolvedValueOnce([
      {
        id: "j1",
        code: "RP-261120-2-1",
        pairs: 2,
        stage: "SOLE_ING",
        finding: {
          finalDefectType: { label: "Lifted sole" },
          checkIn: { batch: { code: "B-261120-2" } },
        },
      },
      {
        id: "j2",
        code: "RP-261120-2-2",
        pairs: 1,
        stage: "FINISHING",
        finding: {
          finalDefectType: { label: "Glue marks" },
          checkIn: { batch: { code: "B-261120-2" } },
        },
      },
    ]);
    const m = await svc.myStage({ id: "c1" }, NOW);
    expect(m).toMatchObject({
      stage: "SOLE_ING",
      label: "Sole-ing",
      pairs: 14,
      lastCounted: "Last counted 11:05 for all of Sole-ing",
      reminder: "B-261120-1 just ended. Update the count.",
    });
    expect(m?.repairs).toEqual([
      { id: "j1", code: "RP-261120-2-1", pairs: 2, defect: "Lifted sole", batchCode: "B-261120-2" },
    ]);
  });
});

describe("wipBoard (D-008)", () => {
  it("shows each stage in line order with its count, and names only below the figures", async () => {
    stage.listAssignments.mockResolvedValue([
      { stage: "SOLE_ING", userId: "c1", name: "Ana Reyes" },
      { stage: "SOLE_ING", userId: "c2", name: "Ben Cruz" },
    ]);
    stage.listCounts.mockResolvedValue([
      {
        day: "2026-11-20",
        stage: "SOLE_ING",
        pairs: 14,
        enteredAt: new Date("2026-11-20T06:00:00Z"),
      },
    ]);
    const b = await svc.wipBoard(FM, NOW);
    expect(b.cards.map((c) => c.label)).toEqual([
      "Preparation",
      "Construction",
      "Sole-ing",
      "Finishing",
    ]);
    const sole = b.cards[2];
    expect(sole).toMatchObject({
      pairs: 14,
      asOf: "as of 14:00",
      assigned: "Assigned today: Ana Reyes, Ben Cruz",
    });
    expect(b.cards[0]).toMatchObject({ pairs: null, asOf: "Not counted today", assigned: null });
    expect(b.preparation).toEqual({ beingScanned: 2, scannedToday: 7 });
    expect(b.canCount).toBe(true);
    expect((await svc.wipBoard(QI, NOW)).canCount).toBe(false);
  });

  it("carries no per-person figure: the only names are the assigned line", async () => {
    stage.listAssignments.mockResolvedValue([
      { stage: "FINISHING", userId: "c1", name: "Ana Reyes" },
    ]);
    const b = await svc.wipBoard(FM, NOW);
    const keys = (v: unknown): string[] =>
      v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]) : [];
    const all = keys(b);
    for (const bad of ["userId", "enteredBy", "by", "name", "user", "person"])
      expect(all).not.toContain(bad);
  });
});

describe("wipReport", () => {
  it("totals per stage and gives each day's last count", async () => {
    stage.listCounts.mockResolvedValue([
      {
        day: "2026-11-19",
        stage: "SOLE_ING",
        pairs: 10,
        enteredAt: new Date("2026-11-19T06:00:00Z"),
      },
      {
        day: "2026-11-20",
        stage: "SOLE_ING",
        pairs: 20,
        enteredAt: new Date("2026-11-20T06:00:00Z"),
      },
      {
        day: "2026-11-20",
        stage: "FINISHING",
        pairs: 5,
        enteredAt: new Date("2026-11-20T06:00:00Z"),
      },
    ]);
    const r = await svc.wipReport({ from: "2026-11-19", to: "2026-11-20" });
    expect(r.counted).toBe(2);
    expect(r.stages.find((s) => s.stage === "SOLE_ING")).toMatchObject({
      days: 2,
      average: 15,
      highest: 20,
      latest: 20,
      barShare: 1,
    });
    expect(r.perDay[1].counts).toMatchObject({ SOLE_ING: 20, FINISHING: 5, PREPARATION: null });
  });
});
