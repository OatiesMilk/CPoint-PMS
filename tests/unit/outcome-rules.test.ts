import { describe, expect, it } from "vitest";
import type { BatchStatus, ReworkStatus, SalvageStatus } from "@/lib/domain";
import {
  computeBatchYield,
  planReworkMove,
  planSalvageMove,
  type ReworkMove,
} from "@/lib/outcome-rules";

describe("planReworkMove", () => {
  it.each([
    ["OPEN", "start", "IN_PROGRESS"],
    ["IN_PROGRESS", "done", "DONE"],
    ["DONE", "reopen", "IN_PROGRESS"],
    ["IN_PROGRESS", "unstart", "OPEN"],
  ] as [ReworkStatus, ReworkMove, ReworkStatus][])("%s --%s--> %s", (from, move, to) => {
    expect(planReworkMove({ status: from }, "IN_PROGRESS", move)).toEqual({ ok: true, to });
  });

  it("refuses skipping (OPEN straight to DONE) and stale moves", () => {
    expect(planReworkMove({ status: "OPEN" }, "IN_PROGRESS", "done")).toMatchObject({ ok: false });
    expect(planReworkMove({ status: "DONE" }, "IN_PROGRESS", "start")).toMatchObject({ ok: false });
  });

  it("refuses everything on a cancelled ticket or a closed batch", () => {
    expect(planReworkMove({ status: "CANCELLED" }, "IN_PROGRESS", "start")).toMatchObject({
      ok: false,
    });
    for (const batch of ["COMPLETED", "CANCELLED"] as BatchStatus[]) {
      expect(planReworkMove({ status: "OPEN" }, batch, "start")).toMatchObject({ ok: false });
    }
  });
});

describe("planSalvageMove", () => {
  const item = (status: SalvageStatus) => ({ status, originBatchId: "origin" });
  const open = { id: "other", status: "IN_PROGRESS" as BatchStatus };

  it("assigns available salvage to another open batch", () => {
    expect(planSalvageMove(item("AVAILABLE"), "assign", { target: open })).toEqual({
      ok: true,
      to: "ASSIGNED",
    });
    expect(
      planSalvageMove(item("AVAILABLE"), "assign", { target: { ...open, status: "PLANNED" } }),
    ).toMatchObject({ ok: true });
  });

  it("refuses its own batch, a closed batch, or no batch", () => {
    expect(
      planSalvageMove(item("AVAILABLE"), "assign", {
        target: { id: "origin", status: "IN_PROGRESS" },
      }),
    ).toMatchObject({ ok: false });
    expect(
      planSalvageMove(item("AVAILABLE"), "assign", { target: { ...open, status: "COMPLETED" } }),
    ).toMatchObject({ ok: false });
    expect(planSalvageMove(item("AVAILABLE"), "assign")).toMatchObject({ ok: false });
  });

  it("unassigns only while the receiving batch is open", () => {
    expect(
      planSalvageMove(item("ASSIGNED"), "unassign", { assignedBatchStatus: "IN_PROGRESS" }),
    ).toEqual({ ok: true, to: "AVAILABLE" });
    expect(
      planSalvageMove(item("ASSIGNED"), "unassign", { assignedBatchStatus: "COMPLETED" }),
    ).toMatchObject({ ok: false });
  });

  it("discards only unused salvage, and discarding is final", () => {
    expect(planSalvageMove(item("AVAILABLE"), "discard")).toEqual({ ok: true, to: "DISCARDED" });
    expect(planSalvageMove(item("ASSIGNED"), "discard")).toMatchObject({ ok: false });
    for (const move of ["assign", "unassign", "discard"] as const) {
      expect(planSalvageMove(item("DISCARDED"), move, { target: open })).toMatchObject({
        ok: false,
      });
      expect(planSalvageMove(item("CANCELLED"), move, { target: open })).toMatchObject({
        ok: false,
      });
    }
  });
});

describe("computeBatchYield", () => {
  it("counts usable as passed + repaired, never pending or open repairs", () => {
    expect(
      computeBatchYield({
        scans: { pass: 40, rework: 6, reject: 3, pending: 1 },
        rework: { open: 2, inProgress: 1, done: 3 },
        salvageReceived: 2,
      }),
    ).toEqual({
      scanned: 50,
      passed: 40,
      reworkOpen: 2,
      reworkInProgress: 1,
      reworkDone: 3,
      rejected: 3,
      pendingReview: 1,
      usable: 43,
      salvageReceived: 2,
    });
  });

  it("is all zeros for an unscanned batch", () => {
    const y = computeBatchYield({
      scans: { pass: 0, rework: 0, reject: 0, pending: 0 },
      rework: { open: 0, inProgress: 0, done: 0 },
      salvageReceived: 0,
    });
    expect(y.usable).toBe(0);
    expect(y.scanned).toBe(0);
  });
});
