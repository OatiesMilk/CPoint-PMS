import { describe, expect, it } from "vitest";
import type { BatchStatus, Stage } from "@/lib/domain";
import {
  EXPECTED_PIECES_PER_ROLL,
  availableActions,
  finishHint,
  openRepairsNote,
  planCancel,
  planTransition,
  rollStatusLabel,
  startedBeforeRolls,
  transitionLabel,
} from "@/lib/stage-machine";

// The roll lifecycle (D-082): Planned → Start → At Preparation → Finish roll → Finished.

const state = (status: BatchStatus, currentStage: Stage = "PREPARATION") => ({
  status,
  currentStage,
});

describe("start", () => {
  it("puts a planned roll at Preparation and opens its log", () => {
    const r = planTransition(state("PLANNED"), "start");
    expect(r).toEqual({
      ok: true,
      plan: {
        next: { status: "IN_PROGRESS", currentStage: "PREPARATION" },
        opensStage: "PREPARATION",
        closesOpenLog: false,
      },
    });
  });

  it("refuses a roll that already started, finished or was cancelled", () => {
    expect(planTransition(state("IN_PROGRESS"), "start")).toEqual({
      ok: false,
      reason: "This roll has already started.",
    });
    expect(planTransition(state("COMPLETED"), "start")).toEqual({
      ok: false,
      reason: "This roll is already finished.",
    });
    expect(planTransition(state("CANCELLED"), "start")).toEqual({
      ok: false,
      reason: "This roll was cancelled.",
    });
  });
});

describe("finish", () => {
  it("finishes a roll at Preparation and closes its log", () => {
    const r = planTransition(state("IN_PROGRESS"), "finish");
    expect(r).toEqual({
      ok: true,
      plan: {
        next: { status: "COMPLETED", currentStage: "PREPARATION" },
        opensStage: null,
        closesOpenLog: true,
      },
    });
  });

  it("finishes a batch started before rolls were tracked, keeping the stage it reached", () => {
    const r = planTransition(state("IN_PROGRESS", "SOLEING"), "finish");
    expect(r.ok && r.plan.next).toEqual({ status: "COMPLETED", currentStage: "SOLEING" });
  });

  it("refuses a planned, finished or cancelled roll", () => {
    expect(planTransition(state("PLANNED"), "finish")).toEqual({
      ok: false,
      reason: "Start the roll first.",
    });
    expect(planTransition(state("COMPLETED"), "finish")).toEqual({
      ok: false,
      reason: "This roll is already finished.",
    });
    expect(planTransition(state("CANCELLED"), "finish")).toEqual({
      ok: false,
      reason: "This roll was cancelled.",
    });
  });
});

describe("cancel", () => {
  it("cancels a planned roll without a log to close, and a started one closing it", () => {
    const planned = planCancel(state("PLANNED"));
    const started = planCancel(state("IN_PROGRESS"));
    expect(planned.ok && planned.plan.closesOpenLog).toBe(false);
    expect(started.ok && started.plan.closesOpenLog).toBe(true);
  });

  it("refuses a finished roll", () => {
    expect(planCancel(state("COMPLETED"))).toEqual({
      ok: false,
      reason: "This roll is already finished.",
    });
  });
});

describe("availableActions", () => {
  it("offers start, edit, cancel and a shoe type change on a planned roll", () => {
    const a = availableActions(state("PLANNED"));
    expect(a.start.allowed).toBe(true);
    expect(a.finish.allowed).toBe(false);
    expect(a.cancel.allowed).toBe(true);
    expect(a.changeShoeType.allowed).toBe(true);
  });

  it("offers finish but not start on a roll at Preparation, with the shoe type fixed", () => {
    const a = availableActions(state("IN_PROGRESS"));
    expect(a.start.allowed).toBe(false);
    expect(a.finish.allowed).toBe(true);
    expect(a.changeShoeType).toEqual({
      allowed: false,
      reason: "The shoe type is fixed once the roll has started.",
    });
  });

  it("offers nothing on a finished roll", () => {
    const a = availableActions(state("COMPLETED"));
    expect(Object.values(a).every((x) => !x.allowed)).toBe(true);
  });
});

describe("labels and hints", () => {
  it("reads Planned, At Preparation, Finished and Cancelled", () => {
    expect(rollStatusLabel(state("PLANNED"))).toBe("Planned");
    expect(rollStatusLabel(state("IN_PROGRESS"))).toBe("At Preparation");
    expect(rollStatusLabel(state("COMPLETED", "FINISHING"))).toBe("Finished");
    expect(rollStatusLabel(state("CANCELLED"))).toBe("Cancelled");
  });

  it("says when a batch started before rolls were tracked", () => {
    expect(startedBeforeRolls(state("IN_PROGRESS", "UPPER_MAKING"))).toBe(true);
    expect(startedBeforeRolls(state("IN_PROGRESS"))).toBe(false);
    expect(startedBeforeRolls(state("COMPLETED", "FINISHING"))).toBe(false);
    expect(rollStatusLabel(state("IN_PROGRESS", "FINISHING"))).toBe(
      "Started before rolls were tracked",
    );
  });

  it("suggests finishing once the scans reach the expected pieces", () => {
    expect(finishHint(EXPECTED_PIECES_PER_ROLL - 1)).toBeNull();
    expect(finishHint(EXPECTED_PIECES_PER_ROLL)).toBe("All 10 pieces scanned. Finish this roll?");
    expect(finishHint(12)).toBe("12 pieces scanned, 10 expected. Finish this roll?");
  });

  it("names the buttons and the open repairs", () => {
    expect(transitionLabel("start")).toBe("Start roll");
    expect(transitionLabel("finish")).toBe("Finish roll");
    expect(openRepairsNote(1)).toContain("1 section is still to be cleaned or cut around");
    expect(openRepairsNote(2)).toContain("they count as usable");
  });
});
