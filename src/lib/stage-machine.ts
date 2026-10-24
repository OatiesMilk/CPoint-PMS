import { BATCH_STATUS_LABELS, type BatchStatus, type Stage } from "./domain";

/**
 * The roll lifecycle (D-082, superseding D-019's stage moves), pure and client-safe. A batch is one
 * leather roll at Preparation. Services enforce these rules; the UI uses the same functions to
 * decide which buttons to show, so the two can't disagree.
 *
 *   PLANNED ─start─► IN_PROGRESS@PREPARATION ─finish─► COMPLETED (shown as "Finished")
 *   cancel: PLANNED/IN_PROGRESS, with a reason
 *
 * Batches started before Phase 23 may still be in progress past Preparation; they finish the same
 * way. The stage moves (advance, move back) are gone.
 */

export type BatchState = { status: BatchStatus; currentStage: Stage };
export type TransitionAction = "start" | "finish";

/** ASSUMPTION (D-082): a roll gives about 10 pieces. Phase 24 moves this onto the roll item. */
export const EXPECTED_PIECES_PER_ROLL = 10;

export type TransitionPlan = {
  next: BatchState;
  /** Stage whose log opens after the transition; null when the roll leaves production. */
  opensStage: Stage | null;
  closesOpenLog: boolean;
};

export type PlanResult = { ok: true; plan: TransitionPlan } | { ok: false; reason: string };

const CLOSED: Partial<Record<BatchStatus, string>> = {
  COMPLETED: "This roll is already finished.",
  CANCELLED: "This roll was cancelled.",
};

export function planTransition(batch: BatchState, action: TransitionAction): PlanResult {
  const closed = CLOSED[batch.status];
  if (closed) return { ok: false, reason: closed };

  if (action === "start") {
    if (batch.status !== "PLANNED") return { ok: false, reason: "This roll has already started." };
    return {
      ok: true,
      plan: {
        next: { status: "IN_PROGRESS", currentStage: "PREPARATION" },
        opensStage: "PREPARATION",
        closesOpenLog: false,
      },
    };
  }

  if (batch.status !== "IN_PROGRESS") return { ok: false, reason: "Start the roll first." };
  return {
    ok: true,
    plan: {
      next: { status: "COMPLETED", currentStage: batch.currentStage },
      opensStage: null,
      closesOpenLog: true,
    },
  };
}

export function planCancel(batch: BatchState): PlanResult {
  const closed = CLOSED[batch.status];
  if (closed) return { ok: false, reason: closed };
  return {
    ok: true,
    plan: {
      next: { status: "CANCELLED", currentStage: batch.currentStage },
      opensStage: null,
      closesOpenLog: batch.status === "IN_PROGRESS",
    },
  };
}

export type Availability = { allowed: true } | { allowed: false; reason: string };

export type BatchActions = {
  start: Availability;
  finish: Availability;
  cancel: Availability;
  edit: Availability;
  changeShoeType: Availability;
};

const asAvailability = (r: PlanResult): Availability =>
  r.ok ? { allowed: true } : { allowed: false, reason: r.reason };

export function availableActions(batch: BatchState): BatchActions {
  const closed = CLOSED[batch.status];
  return {
    start: asAvailability(planTransition(batch, "start")),
    finish: asAvailability(planTransition(batch, "finish")),
    cancel: asAvailability(planCancel(batch)),
    edit: closed ? { allowed: false, reason: closed } : { allowed: true },
    changeShoeType:
      batch.status === "PLANNED"
        ? { allowed: true }
        : { allowed: false, reason: "The shoe type is fixed once the roll has started." },
  };
}

/** A batch started before Phase 23 that is still somewhere past Preparation. */
export function startedBeforeRolls(batch: BatchState): boolean {
  return batch.status === "IN_PROGRESS" && batch.currentStage !== "PREPARATION";
}

/** What a batch's status reads as on screens (D-082). */
export function rollStatusLabel(batch: BatchState): string {
  if (startedBeforeRolls(batch)) return "Started before rolls were tracked";
  return BATCH_STATUS_LABELS[batch.status];
}

/** "All 10 pieces scanned. Finish this roll?" once the scans reach the expected yield, else null. */
export function finishHint(scanned: number): string | null {
  if (scanned < EXPECTED_PIECES_PER_ROLL) return null;
  return scanned === EXPECTED_PIECES_PER_ROLL
    ? `All ${EXPECTED_PIECES_PER_ROLL} pieces scanned. Finish this roll?`
    : `${scanned} pieces scanned, ${EXPECTED_PIECES_PER_ROLL} expected. Finish this roll?`;
}

/** Button and toast wording. */
export function transitionLabel(action: TransitionAction): string {
  return action === "start" ? "Start roll" : "Finish roll";
}
