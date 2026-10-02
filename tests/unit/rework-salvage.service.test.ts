import { beforeEach, describe, expect, it, vi } from "vitest";

const outcomes = {
  findReworkTicket: vi.fn(),
  transitionReworkTicket: vi.fn(async () => true),
  listReworkTickets: vi.fn(async () => []),
  countReworkByStatus: vi.fn(),
  findSalvageItem: vi.fn(),
  transitionSalvageItem: vi.fn(async () => true),
  listSalvageItems: vi.fn(),
  countSalvageByStatus: vi.fn(),
};
const batches = { findBatchById: vi.fn(), listOpenBatches: vi.fn() };
const recordAudit = vi.fn();
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/outcome.model", () => outcomes);
vi.mock("@/server/models/batch.model", () => batches);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const rework = await import("@/server/services/rework.service");
const salvage = await import("@/server/services/salvage.service");
const actor = { id: "fm1" };
const now = new Date("2026-10-02T08:00:00.000Z");

beforeEach(() => vi.clearAllMocks());

describe("moveReworkTicket", () => {
  const ticket = (status: string, batchStatus = "IN_PROGRESS") => ({
    id: "t1",
    status,
    notes: null,
    scan: { id: "s1", sequence: 7, batch: { id: "b1", code: "B-2026-0001", status: batchStatus } },
  });

  it("marks a repair done with who and when, and audits it", async () => {
    outcomes.findReworkTicket.mockResolvedValue(ticket("IN_PROGRESS"));
    const result = await rework.moveReworkTicket(
      "t1",
      { move: "done", expectedStatus: "IN_PROGRESS", note: "Buffed" },
      actor,
      now,
    );
    expect(result).toMatchObject({ status: "DONE", batchCode: "B-2026-0001", sequence: 7 });
    expect(outcomes.transitionReworkTicket).toHaveBeenCalledWith(
      "t1",
      "IN_PROGRESS",
      { status: "DONE", completedAt: now, completedById: "fm1", notes: "Buffed" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "rework.done" }),
    );
  });

  it("undo of 'start' clears startedAt", async () => {
    outcomes.findReworkTicket.mockResolvedValue(ticket("IN_PROGRESS"));
    await rework.moveReworkTicket(
      "t1",
      { move: "unstart", expectedStatus: "IN_PROGRESS" },
      actor,
      now,
    );
    expect(outcomes.transitionReworkTicket).toHaveBeenCalledWith(
      "t1",
      "IN_PROGRESS",
      { status: "OPEN", startedAt: null },
      "tx",
    );
  });

  it("409 STALE when the card was already moved", async () => {
    outcomes.findReworkTicket.mockResolvedValue(ticket("DONE"));
    await expect(
      rework.moveReworkTicket("t1", { move: "done", expectedStatus: "IN_PROGRESS" }, actor, now),
    ).rejects.toMatchObject({
      code: "STALE",
    });
    outcomes.findReworkTicket.mockResolvedValue(ticket("IN_PROGRESS"));
    outcomes.transitionReworkTicket.mockResolvedValueOnce(false);
    await expect(
      rework.moveReworkTicket("t1", { move: "done", expectedStatus: "IN_PROGRESS" }, actor, now),
    ).rejects.toMatchObject({
      code: "STALE",
    });
  });

  it("409 on a closed batch", async () => {
    outcomes.findReworkTicket.mockResolvedValue(ticket("OPEN", "CANCELLED"));
    await expect(
      rework.moveReworkTicket("t1", { move: "start", expectedStatus: "OPEN" }, actor, now),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });
});

describe("salvage", () => {
  const item = (status: string, extra: Record<string, unknown> = {}) => ({
    id: "v1",
    status,
    notes: null,
    originBatchId: "origin",
    assignedBatchId: null,
    assignedBatch: null,
    originBatch: { code: "B-2026-0001" },
    scan: { sequence: 3 },
    ...extra,
  });

  it("assigns to another open batch and audits where it went", async () => {
    outcomes.findSalvageItem.mockResolvedValue(item("AVAILABLE"));
    batches.findBatchById.mockResolvedValue({
      id: "b2",
      code: "B-2026-0002",
      status: "IN_PROGRESS",
    });
    const result = await salvage.assignSalvage(
      "v1",
      { batchId: "b2", expectedStatus: "AVAILABLE" },
      actor,
      now,
    );
    expect(result).toMatchObject({
      status: "ASSIGNED",
      assignedTo: "B-2026-0002",
      label: "B-2026-0001 · section #3",
    });
    expect(outcomes.transitionSalvageItem).toHaveBeenCalledWith(
      "v1",
      "AVAILABLE",
      expect.objectContaining({
        status: "ASSIGNED",
        assignedBatchId: "b2",
        assignedAt: now,
        handledById: "fm1",
      }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "salvage.assign" }),
    );
  });

  it("refuses the batch it came from", async () => {
    outcomes.findSalvageItem.mockResolvedValue(item("AVAILABLE"));
    batches.findBatchById.mockResolvedValue({
      id: "origin",
      code: "B-2026-0001",
      status: "IN_PROGRESS",
    });
    await expect(
      salvage.assignSalvage("v1", { batchId: "origin", expectedStatus: "AVAILABLE" }, actor, now),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("requires a reason to discard and stores it", async () => {
    await expect(
      salvage.discardSalvage("v1", { reason: " ", expectedStatus: "AVAILABLE" }, actor, now),
    ).rejects.toMatchObject({
      status: 422,
    });
    outcomes.findSalvageItem.mockResolvedValue(item("AVAILABLE"));
    await salvage.discardSalvage(
      "v1",
      { reason: "Too small to reuse", expectedStatus: "AVAILABLE" },
      actor,
      now,
    );
    expect(outcomes.transitionSalvageItem).toHaveBeenCalledWith(
      "v1",
      "AVAILABLE",
      { status: "DISCARDED", discardedAt: now, handledById: "fm1", notes: "Too small to reuse" },
      "tx",
    );
  });

  it("can't unassign once the receiving batch is completed", async () => {
    outcomes.findSalvageItem.mockResolvedValue(
      item("ASSIGNED", { assignedBatchId: "b2", assignedBatch: { status: "COMPLETED" } }),
    );
    await expect(
      salvage.unassignSalvage("v1", { expectedStatus: "ASSIGNED" }, actor),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("reworkSummary", () => {
  it("reports waiting, in progress and the longest wait", async () => {
    outcomes.countReworkByStatus.mockResolvedValue([
      {
        status: "OPEN",
        _count: { _all: 3 },
        _min: { openedAt: new Date("2026-10-02T06:00:00.000Z") },
      },
      { status: "IN_PROGRESS", _count: { _all: 1 }, _min: { openedAt: null } },
    ]);
    expect(await rework.reworkSummary(now)).toEqual({
      waiting: 3,
      inProgress: 1,
      oldestWaitMs: 2 * 3_600_000,
    });
  });
});
