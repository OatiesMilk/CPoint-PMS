import type { BatchStatus, ReworkStatus, SalvageStatus } from "./domain";

/**
 * Rework and salvage lifecycle rules (D-021), pure and client-safe. Services enforce them; the UI
 * uses them to decide which buttons to show.
 *
 *   Rework:  OPEN ─start─► IN_PROGRESS ─done─► DONE      (each step can be undone one step back,
 *            also after the batch is completed; D-022)
 *   Salvage: AVAILABLE ─assign─► ASSIGNED ─unassign─► AVAILABLE;  AVAILABLE ─discard─► DISCARDED (final)
 *   CANCELLED (both) is set only by an override or a batch cancel, never by a person here.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

const OPEN_BATCH: BatchStatus[] = ["PLANNED", "IN_PROGRESS"];
const isOpen = (status: BatchStatus) => OPEN_BATCH.includes(status);

// ───────────── rework ─────────────

export type ReworkMove = "start" | "done" | "reopen" | "unstart";

export const REWORK_MOVES: Record<
  ReworkMove,
  { from: ReworkStatus; to: ReworkStatus; label: string }
> = {
  start: { from: "OPEN", to: "IN_PROGRESS", label: "Start repair" },
  done: { from: "IN_PROGRESS", to: "DONE", label: "Mark repaired" },
  reopen: { from: "DONE", to: "IN_PROGRESS", label: "Reopen" },
  unstart: { from: "IN_PROGRESS", to: "OPEN", label: "Back to waiting" },
};

export function planReworkMove(
  ticket: { status: ReworkStatus },
  batchStatus: BatchStatus,
  move: ReworkMove,
): Result<{ to: ReworkStatus }> {
  if (ticket.status === "CANCELLED")
    return { ok: false, reason: "This repair was cancelled because the decision changed." };
  // A completed batch keeps its repairs on the board (D-022); only a cancelled roll freezes them.
  if (batchStatus === "CANCELLED")
    return { ok: false, reason: "The batch was cancelled, so its repairs can't change." };
  const { from, to } = REWORK_MOVES[move];
  if (ticket.status !== from)
    return { ok: false, reason: "This repair has already moved on. Refresh the board." };
  return { ok: true, to };
}

/** The undo for each forward move (used by the toast's Undo button). */
export const REWORK_UNDO: Partial<Record<ReworkMove, ReworkMove>> = {
  start: "unstart",
  done: "reopen",
};

// ───────────── salvage ─────────────

export type SalvageMove = "assign" | "unassign" | "discard";

export function planSalvageMove(
  item: { status: SalvageStatus; originBatchId: string },
  move: SalvageMove,
  context: { target?: { id: string; status: BatchStatus }; assignedBatchStatus?: BatchStatus } = {},
): Result<{ to: SalvageStatus }> {
  if (item.status === "CANCELLED")
    return { ok: false, reason: "This salvage record was cancelled because the decision changed." };
  if (item.status === "DISCARDED") return { ok: false, reason: "This section was discarded." };

  if (move === "assign") {
    if (item.status !== "AVAILABLE")
      return { ok: false, reason: "This section is already used in a batch." };
    const target = context.target;
    if (!target) return { ok: false, reason: "Choose the batch that will use this section." };
    if (target.id === item.originBatchId)
      return { ok: false, reason: "Choose a different batch than the one it was rejected from." };
    if (!isOpen(target.status))
      return { ok: false, reason: "Only a planned or in-progress batch can use salvage." };
    return { ok: true, to: "ASSIGNED" };
  }

  if (move === "unassign") {
    if (item.status !== "ASSIGNED")
      return { ok: false, reason: "This section isn't assigned to a batch." };
    if (context.assignedBatchStatus && !isOpen(context.assignedBatchStatus)) {
      return { ok: false, reason: "The batch using it is closed, so it can't be taken back." };
    }
    return { ok: true, to: "AVAILABLE" };
  }

  if (item.status !== "AVAILABLE")
    return { ok: false, reason: "Only salvage that hasn't been used can be discarded." };
  return { ok: true, to: "DISCARDED" };
}

// ───────────── yield ─────────────

export type YieldInput = {
  /** Scans of the batch by final verdict; pending = waiting for review (no final verdict). */
  scans: { pass: number; rework: number; reject: number; pending: number };
  /** Live rework tickets of the batch by status (cancelled ones excluded). */
  rework: { open: number; inProgress: number; done: number };
  /** Salvage sections from other batches assigned to this one. */
  salvageReceived: number;
};

export type BatchYield = {
  scanned: number;
  passed: number;
  reworkOpen: number;
  reworkInProgress: number;
  reworkDone: number;
  rejected: number;
  pendingReview: number;
  /** Sections that continue to cutting: passed + repaired (D-007). */
  usable: number;
  salvageReceived: number;
};

export function computeBatchYield(input: YieldInput): BatchYield {
  const { scans, rework } = input;
  return {
    scanned: scans.pass + scans.rework + scans.reject + scans.pending,
    passed: scans.pass,
    reworkOpen: rework.open,
    reworkInProgress: rework.inProgress,
    reworkDone: rework.done,
    rejected: scans.reject,
    pendingReview: scans.pending,
    usable: scans.pass + rework.done,
    salvageReceived: input.salvageReceived,
  };
}
