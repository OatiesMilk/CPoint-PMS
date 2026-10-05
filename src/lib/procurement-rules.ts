import type { PurchasePriority, PurchaseRequestStatus } from "./domain";

/**
 * Purchase request lifecycle (D-029), pure and client-safe. Services enforce it, and the database
 * update is conditional on the status the caller saw, so two people can't both decide a request.
 *
 *   PENDING ─approve─▶ APPROVED ─receive─▶ RECEIVED
 *      ├────reject──▶ REJECTED
 *      └────cancel──▶ CANCELLED (the requester only)
 *
 * A request is never edited after it's submitted: cancel it and send a new one.
 */

export type PurchaseAction = "approve" | "reject" | "cancel" | "receive";

export const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  RECEIVED: "Received",
};

export const PRIORITY_LABELS: Record<PurchasePriority, string> = {
  NORMAL: "Normal",
  URGENT: "Urgent",
};

/** Requests still waiting on someone: shown as "open" on homes and inventory. */
export const OPEN_STATUSES: readonly PurchaseRequestStatus[] = ["PENDING", "APPROVED"];

export const MAX_LINES = 10;

const MOVES: Record<PurchaseAction, { from: PurchaseRequestStatus; to: PurchaseRequestStatus }> = {
  approve: { from: "PENDING", to: "APPROVED" },
  reject: { from: "PENDING", to: "REJECTED" },
  cancel: { from: "PENDING", to: "CANCELLED" },
  receive: { from: "APPROVED", to: "RECEIVED" },
};

const VERB: Record<PurchaseAction, string> = {
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
  receive: "marked received",
};

export type Transition =
  | { ok: true; from: PurchaseRequestStatus; to: PurchaseRequestStatus }
  | { ok: false; reason: string };

/** Where an action takes a request, or why it can't. */
export function transition(status: PurchaseRequestStatus, action: PurchaseAction): Transition {
  const move = MOVES[action];
  if (status === move.from) return { ok: true, from: move.from, to: move.to };
  const need = move.from === "PENDING" ? "a pending" : "an approved";
  return {
    ok: false,
    reason: `Only ${need} request can be ${VERB[action]}. This one is ${STATUS_LABELS[status].toLowerCase()}.`,
  };
}

export const ACTION_VERB = VERB;

/** "PR-2026-0007" from the year and the running number. */
export function formatRequestCode(year: number, n: number): string {
  return `PR-${year}-${String(n).padStart(4, "0")}`;
}

/** One line for tables: "Contact cement, Nylon thread +2 more". */
export function summarizeItems(lines: readonly { itemName: string }[], show = 2): string {
  const names = lines.map((l) => l.itemName);
  const head = names.slice(0, show).join(", ");
  return names.length > show ? `${head} +${names.length - show} more` : head;
}
