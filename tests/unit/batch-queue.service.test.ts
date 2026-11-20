import { beforeEach, describe, expect, it, vi } from "vitest";

// The Inspection queue service (Phase 33, D-129): the queue across days, Start inspection,
// Urgent and Void, each guarded and audited in the same transaction.

const STAMP = new Date("2026-11-17T01:00:00.000Z");
const row = (over: object = {}) => ({
  id: "b1",
  code: "B-261116-2",
  day: "2026-11-16",
  number: 2,
  startAt: new Date("2026-11-16T05:00:00.000Z"), // 13:00 Manila
  slotAt: new Date("2026-11-16T09:00:00.000Z"), // 17:00 Manila
  status: "OPEN" as string,
  priority: "NORMAL" as string,
  priorityReason: null as string | null,
  prioritySetBy: null as { name: string } | null,
  inspectionStartedAt: null as Date | null,
  inspectionStartedById: null as string | null,
  inspectionStartedBy: null as { name: string } | null,
  voidReason: null as string | null,
  voidedBy: null,
  checkIn: null,
  updatedAt: STAMP,
  ...over,
});

const model = {
  findBatch: vi.fn(async () => row() as unknown),
  findBatchBySlot: vi.fn(),
  listOpenBatchRows: vi.fn(async () => [] as unknown[]),
  listDoneBatchRows: vi.fn(async () => [] as unknown[]),
  updateBatch: vi.fn(async () => true),
};
const rolls = { listRollsFinishedWithItem: vi.fn(async () => [] as unknown[]) };
const production = {
  ensureBatchRows: vi.fn(async () => ({ inserted: 0, linked: 0 })),
  assertMayEnter: vi.fn(async () => ({ covering: false })),
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/production.model", () => model);
vi.mock("@/server/models/roll.model", () => rolls);
vi.mock("@/server/services/production.service", () => production);
vi.mock("@/server/services/attendance.service", () => ({
  qualityInspectorPresentOn: vi.fn(async () => true),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));

const svc = await import("@/server/services/batch-queue.service");

const QI = { id: "qi1", name: "Lea Santos", role: "QUALITY_INSPECTOR" as const };
const QI2 = { id: "qi2", name: "Ana Cruz", role: "QUALITY_INSPECTOR" as const };
const FM = { id: "fm1", name: "Rodel Pascual", role: "FLOOR_MANAGER" as const };
const NEXT_MORNING = new Date("2026-11-17T01:30:00.000Z"); // 09:30 Manila, the day after
const seen = { expectedUpdatedAt: STAMP.toISOString() };

beforeEach(() => {
  vi.clearAllMocks();
  model.findBatch.mockResolvedValue(row());
  model.updateBatch.mockResolvedValue(true);
});

describe("inspectionQueue", () => {
  it("lists waiting batches across days, Urgent first, then oldest, with the rolls in each", async () => {
    model.listOpenBatchRows.mockResolvedValueOnce([
      row({
        id: "today",
        code: "B-261117-1",
        day: "2026-11-17",
        number: 1,
        startAt: new Date("2026-11-17T00:00:00.000Z"),
        slotAt: new Date("2026-11-17T01:00:00.000Z"),
      }),
      row(),
      row({
        id: "urgent",
        code: "B-261117-0",
        day: "2026-11-17",
        number: 0,
        priority: "URGENT",
        priorityReason: "Customer pick-up",
        prioritySetBy: { name: "Rodel Pascual" },
        startAt: new Date("2026-11-17T00:00:00.000Z"),
        slotAt: new Date("2026-11-17T01:00:00.000Z"),
      }),
      // Not ended yet: on the Today tab, not in the queue.
      row({
        id: "later",
        code: "B-261117-2",
        day: "2026-11-17",
        startAt: new Date("2026-11-17T05:00:00.000Z"),
        slotAt: new Date("2026-11-17T09:00:00.000Z"),
      }),
    ]);
    rolls.listRollsFinishedWithItem.mockResolvedValueOnce([
      { finishedAt: new Date("2026-11-16T06:00:00.000Z"), item: "Suede brown" },
      { finishedAt: new Date("2026-11-16T07:00:00.000Z"), item: "Suede brown" },
    ]);
    const q = await svc.inspectionQueue(QI, {}, NEXT_MORNING);
    expect(production.ensureBatchRows).toHaveBeenCalled();
    expect(q.waiting.map((i) => i.code)).toEqual(["B-261117-0", "B-261116-2", "B-261117-1"]);
    const old = q.waiting[1];
    expect(old).toMatchObject({
      state: "LATE",
      dayLabel: expect.stringContaining("16 Nov"),
      times: "13:00–17:00",
      rolls: "2 rolls (Suede brown ×2)",
      waiting: "Waiting 16 hours 30 minutes",
      canFinish: true,
    });
    expect(q.waiting[0]).toMatchObject({ priority: "URGENT", priorityBy: "Rodel Pascual" });
    expect(q).toMatchObject({ total: 3, urgent: 1, canInspect: true, canPrioritise: false });
  });

  it("filters by day, priority and code", async () => {
    model.listOpenBatchRows.mockResolvedValue([
      row(),
      row({ id: "u", code: "B-261116-1", number: 1, priority: "URGENT" }),
    ]);
    expect(
      (await svc.inspectionQueue(QI, { priority: "URGENT" }, NEXT_MORNING)).waiting.map(
        (i) => i.code,
      ),
    ).toEqual(["B-261116-1"]);
    expect(
      (await svc.inspectionQueue(QI, { q: "261116-2" }, NEXT_MORNING)).waiting.map((i) => i.code),
    ).toEqual(["B-261116-2"]);
    expect((await svc.inspectionQueue(QI, { day: "2026-11-17" }, NEXT_MORNING)).waiting).toEqual(
      [],
    );
    model.listOpenBatchRows.mockReset();
    model.listOpenBatchRows.mockResolvedValue([]);
  });
});

describe("startInspection (A-60)", () => {
  it("marks it as being inspected by this person, audited in the same tx", async () => {
    const r = await svc.startInspection("b1", seen, QI, NEXT_MORNING);
    expect(r).toEqual({ id: "b1", code: "B-261116-2", started: true });
    expect(model.updateBatch).toHaveBeenCalledWith(
      "b1",
      STAMP,
      ["OPEN"],
      { status: "INSPECTING", inspectionStartedAt: NEXT_MORNING, inspectionStartedById: "qi1" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "production.batch.start", entityId: "b1" }),
    );
  });

  it("tells a second inspector who has it", async () => {
    model.findBatch.mockResolvedValueOnce(
      row({
        status: "INSPECTING",
        inspectionStartedById: "qi1",
        inspectionStartedBy: { name: "Lea Santos" },
        inspectionStartedAt: new Date("2026-11-17T01:05:00.000Z"),
      }),
    );
    await expect(svc.startInspection("b1", seen, QI2, NEXT_MORNING)).rejects.toMatchObject({
      status: 409,
      message: "Lea Santos is already inspecting B-261116-2 (since 09:05). Pick another batch.",
    });
  });

  it("refuses an inspected or voided batch, and someone who may not inspect", async () => {
    model.findBatch.mockResolvedValueOnce(row({ status: "INSPECTED" }));
    await expect(svc.startInspection("b1", seen, QI, NEXT_MORNING)).rejects.toMatchObject({
      status: 409,
      message: "B-261116-2 is already inspected.",
    });
    production.assertMayEnter.mockRejectedValueOnce(
      Object.assign(new Error("no"), { status: 403 }),
    );
    await expect(svc.startInspection("b1", seen, FM, NEXT_MORNING)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("is STALE when the batch changed since the page loaded", async () => {
    await expect(
      svc.startInspection(
        "b1",
        { expectedUpdatedAt: "2026-11-17T00:00:00.000Z" },
        QI,
        NEXT_MORNING,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });
});

describe("setBatchPriority and voidBatch (A-58, A-59)", () => {
  it("marks Urgent with the reason and audits before and after", async () => {
    await svc.setBatchPriority(
      "b1",
      { priority: "URGENT", reason: "Customer pick-up at 3 pm", ...seen },
      FM,
      NEXT_MORNING,
    );
    expect(model.updateBatch).toHaveBeenCalledWith(
      "b1",
      STAMP,
      ["OPEN", "INSPECTING"],
      expect.objectContaining({ priority: "URGENT", priorityReason: "Customer pick-up at 3 pm" }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "production.batch.priority",
        before: { priority: "NORMAL", reason: null },
        after: { code: "B-261116-2", priority: "URGENT", reason: "Customer pick-up at 3 pm" },
      }),
    );
  });

  it("refuses a batch that hasn't started", async () => {
    await expect(
      svc.setBatchPriority(
        "b1",
        { priority: "URGENT", reason: "Rush order", ...seen },
        FM,
        new Date("2026-11-16T04:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("voids with a reason, so it leaves the queue", async () => {
    const r = await svc.voidBatch(
      "b1",
      { reason: "Line stopped, no pairs made", ...seen },
      FM,
      NEXT_MORNING,
    );
    expect(r).toEqual({ id: "b1", code: "B-261116-2", saved: true });
    expect(model.updateBatch).toHaveBeenCalledWith(
      "b1",
      STAMP,
      ["OPEN", "INSPECTING"],
      {
        status: "VOID",
        voidReason: "Line stopped, no pairs made",
        voidedAt: NEXT_MORNING,
        voidedById: "fm1",
      },
      "tx",
    );
    model.findBatch.mockResolvedValueOnce(row({ status: "VOID" }));
    await expect(
      svc.voidBatch("b1", { reason: "Again please", ...seen }, FM, NEXT_MORNING),
    ).rejects.toMatchObject({
      status: 409,
      message: "B-261116-2 was voided. It isn't in the queue.",
    });
  });

  it("is STALE when someone else saved first", async () => {
    model.updateBatch.mockResolvedValueOnce(false);
    await expect(
      svc.voidBatch("b1", { reason: "Line stopped", ...seen }, FM, NEXT_MORNING),
    ).rejects.toMatchObject({ code: "STALE" });
  });
});

describe("the Done list's Correct (run 2 F2)", () => {
  it("offers Correct only for a batch inspected today, whatever its own day", async () => {
    const finished = (enteredAt: string) => ({
      id: "ci1",
      updatedAt: STAMP,
      enteredAt: new Date(enteredAt),
      pairs: 20,
      failedPairs: 1,
      enteredBy: { name: "Lea Santos" },
    });
    model.listDoneBatchRows.mockResolvedValueOnce([
      row({ id: "today", status: "INSPECTED", checkIn: finished("2026-11-17T01:10:00.000Z") }),
      row({
        id: "yesterday",
        code: "B-261116-1",
        status: "INSPECTED",
        checkIn: finished("2026-11-16T09:10:00.000Z"),
      }),
    ]);
    const q = await svc.inspectionQueue(QI, {}, NEXT_MORNING);
    expect(q.done.map((d) => [d.id, d.finished?.correctable, d.finished?.checkInId])).toEqual([
      ["today", true, "ci1"],
      ["yesterday", false, "ci1"],
    ]);
  });
});
