import { STAGE_LABELS, STAGE_ORDER, type BatchStatus, type Stage } from "./domain";

/**
 * Batch lifecycle rules (D-019), pure and client-safe. Services enforce them; the UI uses the
 * same functions to decide which buttons to show, so the two can't disagree.
 *
 *   PLANNED ─start─► IN_PROGRESS@PREPARATION ─advance─► … ─► FINISHING ─complete─► COMPLETED
 *   move back: one stage at a time, with a reason · cancel: PLANNED/IN_PROGRESS, with a reason
 */

export type BatchState = { status: BatchStatus; currentStage: Stage };
export type TransitionAction = "start" | "advance" | "complete" | "move_back";

export function nextStage(stage: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[i + 1] ?? null;
}

export function previousStage(stage: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(stage);
  return i > 0 ? STAGE_ORDER[i - 1] : null;
}

export type TransitionPlan = {
  next: BatchState;
  /** Stage whose log opens after the transition; null when the batch leaves production. */
  opensStage: Stage | null;
  closesOpenLog: boolean;
  isRollback: boolean;
};

export type PlanResult = { ok: true; plan: TransitionPlan } | { ok: false; reason: string };

const CLOSED: Partial<Record<BatchStatus, string>> = {
  COMPLETED: "This batch is completed.",
  CANCELLED: "This batch was cancelled.",
};

export function planTransition(batch: BatchState, action: TransitionAction): PlanResult {
  const closed = CLOSED[batch.status];
  if (closed) return { ok: false, reason: closed };

  if (action === "start") {
    if (batch.status !== "PLANNED") return { ok: false, reason: "Production has already started." };
    return {
      ok: true,
      plan: {
        next: { status: "IN_PROGRESS", currentStage: "PREPARATION" },
        opensStage: "PREPARATION",
        closesOpenLog: false,
        isRollback: false,
      },
    };
  }

  if (batch.status !== "IN_PROGRESS") return { ok: false, reason: "Start production first." };

  if (action === "advance") {
    const to = nextStage(batch.currentStage);
    if (!to)
      return { ok: false, reason: "Finishing is the last stage. Complete the batch instead." };
    return {
      ok: true,
      plan: {
        next: { status: "IN_PROGRESS", currentStage: to },
        opensStage: to,
        closesOpenLog: true,
        isRollback: false,
      },
    };
  }

  if (action === "complete") {
    if (batch.currentStage !== "FINISHING") {
      return {
        ok: false,
        reason: `A batch can only be completed from Finishing. It is in ${STAGE_LABELS[batch.currentStage]}.`,
      };
    }
    return {
      ok: true,
      plan: {
        next: { status: "COMPLETED", currentStage: "FINISHING" },
        opensStage: null,
        closesOpenLog: true,
        isRollback: false,
      },
    };
  }

  const back = previousStage(batch.currentStage);
  if (!back)
    return {
      ok: false,
      reason: "Preparation is the first stage; there's nothing to move back to.",
    };
  return {
    ok: true,
    plan: {
      next: { status: "IN_PROGRESS", currentStage: back },
      opensStage: back,
      closesOpenLog: true,
      isRollback: true,
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
      isRollback: false,
    },
  };
}

export type Availability = { allowed: true } | { allowed: false; reason: string };

export type BatchActions = {
  start: Availability;
  advance: Availability;
  complete: Availability;
  moveBack: Availability;
  cancel: Availability;
  edit: Availability;
  changeShoeType: Availability;
};

const asAvailability = (r: PlanResult): Availability =>
  r.ok ? { allowed: true } : { allowed: false, reason: r.reason };

/**
 * Shown when completing a batch whose sections are still being repaired (D-022). Completing is
 * allowed: the batch is tagged "In repair" and the repairs count as usable once done.
 */
export function openRepairsNote(openRepairs: number): string {
  return `${openRepairs} section${openRepairs === 1 ? " is" : "s are"} still at the repair station. The batch will be tagged In repair, and ${openRepairs === 1 ? "it counts" : "they count"} as usable once repaired on the Rework board.`;
}

export function availableActions(batch: BatchState): BatchActions {
  const closed = CLOSED[batch.status];
  return {
    start: asAvailability(planTransition(batch, "start")),
    advance: asAvailability(planTransition(batch, "advance")),
    complete: asAvailability(planTransition(batch, "complete")),
    moveBack: asAvailability(planTransition(batch, "move_back")),
    cancel: asAvailability(planCancel(batch)),
    edit: closed ? { allowed: false, reason: closed } : { allowed: true },
    changeShoeType:
      batch.status === "PLANNED"
        ? { allowed: true }
        : { allowed: false, reason: "The shoe type is fixed once production starts." },
  };
}

export type StageLogLike = { stage: Stage; startedAt: Date; endedAt: Date | null };

/** Total time spent in each stage (ms), counting repeat visits after a move back and the open log up to `now`. */
export function stageDurations(logs: StageLogLike[], now: Date): Record<Stage, number> {
  const totals = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<Stage, number>;
  for (const log of logs) {
    const end = log.endedAt ?? now;
    totals[log.stage] += Math.max(0, end.getTime() - log.startedAt.getTime());
  }
  return totals;
}

/** Button and toast wording: "Start production", "Move to Upper Making", "Move back to Preparation", … */
export function transitionLabel(action: TransitionAction, stage: Stage): string {
  if (action === "start") return "Start production";
  if (action === "complete") return "Complete batch";
  const to = action === "advance" ? nextStage(stage) : previousStage(stage);
  if (!to) return action === "advance" ? "Complete batch" : "Move back";
  return `${action === "advance" ? "Move to" : "Move back to"} ${STAGE_LABELS[to]}`;
}
