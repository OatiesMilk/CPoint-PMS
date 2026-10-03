import { describe, expect, it } from "vitest";
import type { BatchStatus, Stage } from "@/lib/domain";
import {
  availableActions,
  openRepairsNote,
  nextStage,
  planCancel,
  planTransition,
  previousStage,
  stageDurations,
  type TransitionAction,
} from "@/lib/stage-machine";

const state = (status: BatchStatus, currentStage: Stage = "PREPARATION") => ({
  status,
  currentStage,
});

describe("stage order", () => {
  it("moves one stage at a time in factory order", () => {
    expect(nextStage("PREPARATION")).toBe("UPPER_MAKING");
    expect(nextStage("UPPER_MAKING")).toBe("SOLEING");
    expect(nextStage("SOLEING")).toBe("FINISHING");
    expect(nextStage("FINISHING")).toBeNull();
    expect(previousStage("PREPARATION")).toBeNull();
    expect(previousStage("FINISHING")).toBe("SOLEING");
  });
});

describe("planTransition", () => {
  it("starts a planned batch at Preparation and opens its first log", () => {
    expect(planTransition(state("PLANNED"), "start")).toEqual({
      ok: true,
      plan: {
        next: { status: "IN_PROGRESS", currentStage: "PREPARATION" },
        opensStage: "PREPARATION",
        closesOpenLog: false,
        isRollback: false,
      },
    });
  });

  it("can't start twice", () => {
    expect(planTransition(state("IN_PROGRESS"), "start")).toMatchObject({ ok: false });
  });

  it("can't advance, complete or move back before production starts", () => {
    for (const action of ["advance", "complete", "move_back"] as TransitionAction[]) {
      expect(planTransition(state("PLANNED"), action)).toEqual({
        ok: false,
        reason: "Start production first.",
      });
    }
  });

  it("advances only to the next stage (no skipping)", () => {
    const result = planTransition(state("IN_PROGRESS", "UPPER_MAKING"), "advance");
    expect(result).toMatchObject({
      ok: true,
      plan: { next: { currentStage: "SOLEING" }, closesOpenLog: true, isRollback: false },
    });
  });

  it("can't advance past Finishing; completing is the only way out", () => {
    expect(planTransition(state("IN_PROGRESS", "FINISHING"), "advance")).toMatchObject({
      ok: false,
    });
    expect(planTransition(state("IN_PROGRESS", "FINISHING"), "complete")).toMatchObject({
      ok: true,
      plan: {
        next: { status: "COMPLETED", currentStage: "FINISHING" },
        opensStage: null,
        closesOpenLog: true,
      },
    });
  });

  it("completes only from Finishing", () => {
    for (const stage of ["PREPARATION", "UPPER_MAKING", "SOLEING"] as Stage[]) {
      expect(planTransition(state("IN_PROGRESS", stage), "complete")).toMatchObject({ ok: false });
    }
  });

  it("moves back one stage as a rollback, never before Preparation", () => {
    expect(planTransition(state("IN_PROGRESS", "SOLEING"), "move_back")).toMatchObject({
      ok: true,
      plan: {
        next: { currentStage: "UPPER_MAKING" },
        opensStage: "UPPER_MAKING",
        isRollback: true,
      },
    });
    expect(planTransition(state("IN_PROGRESS", "PREPARATION"), "move_back")).toMatchObject({
      ok: false,
    });
  });

  it("refuses every transition on completed and cancelled batches", () => {
    for (const status of ["COMPLETED", "CANCELLED"] as BatchStatus[]) {
      for (const action of ["start", "advance", "complete", "move_back"] as TransitionAction[]) {
        expect(planTransition(state(status, "FINISHING"), action)).toMatchObject({ ok: false });
      }
      expect(planCancel(state(status))).toMatchObject({ ok: false });
    }
  });
});

describe("planCancel", () => {
  it("closes the open log only when production had started", () => {
    expect(planCancel(state("PLANNED"))).toMatchObject({
      ok: true,
      plan: { next: { status: "CANCELLED" }, closesOpenLog: false },
    });
    expect(planCancel(state("IN_PROGRESS", "SOLEING"))).toMatchObject({
      ok: true,
      plan: { next: { status: "CANCELLED", currentStage: "SOLEING" }, closesOpenLog: true },
    });
  });
});

describe("availableActions", () => {
  it("lets a planned batch start, cancel, edit and change shoe type only", () => {
    const a = availableActions(state("PLANNED"));
    expect(a.start.allowed && a.cancel.allowed && a.edit.allowed && a.changeShoeType.allowed).toBe(
      true,
    );
    expect(a.advance.allowed || a.complete.allowed || a.moveBack.allowed).toBe(false);
  });

  it("locks the shoe type once production starts, with the reason", () => {
    expect(availableActions(state("IN_PROGRESS")).changeShoeType).toEqual({
      allowed: false,
      reason: "The shoe type is fixed once production starts.",
    });
  });

  it("allows nothing on a completed batch", () => {
    const a = availableActions(state("COMPLETED", "FINISHING"));
    expect(Object.values(a).every((x) => !x.allowed)).toBe(true);
  });
});

describe("stageDurations", () => {
  const t = (h: number) => new Date(Date.UTC(2026, 9, 2, h));

  it("sums repeat visits after a move back and counts the open log up to now", () => {
    const totals = stageDurations(
      [
        { stage: "PREPARATION", startedAt: t(0), endedAt: t(2) },
        { stage: "UPPER_MAKING", startedAt: t(2), endedAt: t(5) },
        { stage: "PREPARATION", startedAt: t(5), endedAt: t(6) }, // moved back
        { stage: "UPPER_MAKING", startedAt: t(6), endedAt: null }, // open
      ],
      t(10),
    );
    expect(totals).toEqual({
      PREPARATION: 3 * 3_600_000,
      UPPER_MAKING: 7 * 3_600_000,
      SOLEING: 0,
      FINISHING: 0,
    });
  });
});

describe("completion with open repairs (D-022)", () => {
  it("never blocks Complete; the confirm dialog explains the In repair tag", () => {
    expect(
      availableActions({ status: "IN_PROGRESS", currentStage: "FINISHING" }).complete.allowed,
    ).toBe(true);
    expect(openRepairsNote(2)).toBe(
      "2 sections are still at the repair station. The batch will be tagged In repair, and they count as usable once repaired on the Rework board.",
    );
    expect(openRepairsNote(1)).toContain("1 section is still");
  });
});
