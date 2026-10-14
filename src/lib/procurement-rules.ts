import type { PurchaseLineDecision, PurchaseRequestStatus, Role } from "./domain";
import { formatQuantity } from "./inventory-rules";

/**
 * Purchase request lifecycle (D-029, D-039, D-041 to D-043), pure and client-safe. Services
 * enforce it, and the database update is conditional on the status the caller saw, so two people
 * can't both move a request.
 *
 *   PENDING ─decide every item─▶ APPROVED (at least one approved) ─order─▶ ORDERED
 *      │                       └▶ REJECTED (every item rejected)            │
 *      └─cancel (requester)─▶ CANCELLED ◀─cancel with a reason (FM)─ APPROVED or ORDERED
 *
 *   ORDERED ─delivery (some short)─▶ PARTIALLY_RECEIVED ─the rest─▶ RECEIVED
 *                                     └─close short (FM, reason)─▶ RECEIVED ("closed short")
 *
 * The Floor Manager decides each item; the request's status follows from them
 * (`deriveRequestStatus`), and later from what has arrived (`deriveReceiptStatus`). A request is
 * never edited after it's submitted: cancel it, or copy it to a new one (D-044).
 */

export type PurchaseAction = "approve" | "reject" | "cancel" | "order" | "receive" | "close_short";

export const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  ORDERED: "Ordered",
  PARTIALLY_RECEIVED: "Partly received",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  RECEIVED: "Received",
};

/** The order the status tabs and filters use: the request's path, then the two ways it ends early. */
export const STATUS_ORDER: readonly PurchaseRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "REJECTED",
  "CANCELLED",
];

/** Requests still waiting on someone: shown as "open" on homes and inventory. */
export const OPEN_STATUSES: readonly PurchaseRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
];

export const MAX_LINES = 10;

// ───────────── names by role (D-035) ─────────────

export type RequestLabels = {
  /** Sidebar item and list page title. */
  nav: string;
  /** "material request" / "purchase request", for sentences. */
  one: string;
  many: string;
  /** The "new" button and the new-request page title. */
  create: string;
  /** Title of a single request's page. */
  detail: string;
};

const MATERIAL_LABELS: RequestLabels = {
  nav: "Material requests",
  one: "material request",
  many: "material requests",
  create: "New material request",
  detail: "Material request",
};
const PROCUREMENT_LABELS: RequestLabels = {
  nav: "Procurement",
  one: "purchase request",
  many: "purchase requests",
  create: "New purchase request",
  detail: "Purchase request",
};

/**
 * What the module is called for each role (D-035). Shoe Constructors only ask for materials, so
 * they see "Material requests"; the Floor Manager and the System Admin see "Procurement". The
 * sidebar and every page header read this one map. URLs and permission keys stay `procurement`.
 */
export function requestLabelsFor(role: Role): RequestLabels {
  return role === "SHOE_CONSTRUCTOR" ? MATERIAL_LABELS : PROCUREMENT_LABELS;
}

// ───────────── urgency (D-037) ─────────────

export const URGENCIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/**
 * ASSUMPTION (team, 2026-10-10; to confirm with CPoint): urgency comes from how many working days
 * are left until the needed-by date. High is up to 3 working days (or overdue), Medium up to 7,
 * Low anything later. Working days are Monday to Friday; holidays aren't skipped.
 */
export const URGENCY_BANDS = { highMaxDays: 3, mediumMaxDays: 7 } as const;
/** Days of the week that count, as Date#getUTCDay numbers (0 = Sunday). */
export const WORKING_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5];
/** How far ahead a needed-by date may be. */
export const NEEDED_BY_MAX_DAYS = 180;

const DAY_MS = 86_400_000;
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A @db.Date value (UTC midnight) or a YYYY-MM-DD string, as YYYY-MM-DD. */
export function calendarDay(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export function isWorkingDay(day: string): boolean {
  return WORKING_WEEKDAYS.includes(new Date(dayMs(day)).getUTCDay());
}

/**
 * Working days from `today` (not counted) up to and including `neededBy`. Negative when the date
 * has passed: the working days gone since it.
 */
export function workingDaysUntil(neededBy: string, today: string): number {
  const [from, to, sign] =
    neededBy >= today ? [dayMs(today), dayMs(neededBy), 1] : [dayMs(neededBy), dayMs(today), -1];
  let n = 0;
  for (let t = from + DAY_MS; t <= to; t += DAY_MS) if (isWorkingDay(toDay(t))) n += 1;
  return n === 0 ? 0 : sign * n;
}

/** Urgency of an open request, from Manila calendar dates (YYYY-MM-DD). */
export function urgencyFor(neededBy: string, today: string): Urgency {
  const left = workingDaysUntil(neededBy, today);
  if (neededBy < today || left <= URGENCY_BANDS.highMaxDays) return "HIGH";
  return left <= URGENCY_BANDS.mediumMaxDays ? "MEDIUM" : "LOW";
}

const CLOSED: readonly PurchaseRequestStatus[] = ["RECEIVED", "REJECTED", "CANCELLED"];

/** Urgency stops counting once a request is closed: those have none. */
export function urgencyOf(
  status: PurchaseRequestStatus,
  neededBy: Date | string,
  today: string,
): Urgency | null {
  return CLOSED.includes(status) ? null : urgencyFor(calendarDay(neededBy), today);
}

/** "today", "in 2 working days", "overdue by 1 working day". */
export function daysLeftLabel(neededBy: string, today: string): string {
  if (neededBy === today) return "today";
  const left = workingDaysUntil(neededBy, today);
  const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;
  if (neededBy < today) return left === 0 ? "overdue" : `overdue by ${days(-left)}`;
  return left === 0 ? "this weekend" : `in ${days(left)}`;
}

/**
 * The last needed-by dates that still count as High and as Medium today, so a list can be
 * filtered and counted by date in the database (urgency itself is never stored).
 */
export function urgencyCutoffs(today: string): { highThrough: string; mediumThrough: string } {
  const through = (maxDays: number) => {
    let t = dayMs(today);
    while (workingDaysUntil(toDay(t + DAY_MS), today) <= maxDays) t += DAY_MS;
    return toDay(t);
  };
  return {
    highThrough: through(URGENCY_BANDS.highMaxDays),
    mediumThrough: through(URGENCY_BANDS.mediumMaxDays),
  };
}

/** Needed-by dates (inclusive, either end open) that fall in an urgency band today. */
export function urgencyDateRange(
  urgency: Urgency,
  today: string,
): { after?: string; through?: string } {
  const { highThrough, mediumThrough } = urgencyCutoffs(today);
  if (urgency === "HIGH") return { through: highThrough };
  if (urgency === "MEDIUM") return { after: highThrough, through: mediumThrough };
  return { after: mediumThrough };
}

// ───────────── item decisions (D-039) ─────────────

export type LineOutcome = Exclude<PurchaseLineDecision, "PENDING">;

export const LINE_DECISION_LABELS: Record<PurchaseLineDecision, string> = {
  PENDING: "Not decided yet",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/**
 * A request's status while it is being decided, from its items: still pending until every item
 * has a decision, approved when at least one item is, rejected when every item is.
 */
export function deriveRequestStatus(
  decisions: readonly PurchaseLineDecision[],
): "PENDING" | "APPROVED" | "REJECTED" {
  if (decisions.length === 0 || decisions.includes("PENDING")) return "PENDING";
  return decisions.includes("APPROVED") ? "APPROVED" : "REJECTED";
}

/** "1 of 2 items approved", for the requester and the history. */
export function decisionSummary(lines: readonly { decision: PurchaseLineDecision }[]) {
  const approved = lines.filter((l) => l.decision === "APPROVED").length;
  const rejected = lines.filter((l) => l.decision === "REJECTED").length;
  const total = lines.length;
  return {
    approved,
    rejected,
    total,
    label: `${approved} of ${total} item${total === 1 ? "" : "s"} approved`,
  };
}

/**
 * The decision's timeline note: one line for the approved items, one per rejection reason, then
 * the Floor Manager's note. Shown with its line breaks.
 */
export function decisionEventNote(
  lines: readonly { itemName: string; decision: LineOutcome; reason?: string | null }[],
  note?: string | null,
): string {
  const out: string[] = [];
  const approved = lines.filter((l) => l.decision === "APPROVED").map((l) => l.itemName);
  if (approved.length) out.push(`Approved: ${approved.join(", ")}.`);
  const byReason = new Map<string, string[]>();
  for (const l of lines) {
    if (l.decision !== "REJECTED") continue;
    const reason = l.reason?.trim() ?? "";
    byReason.set(reason, [...(byReason.get(reason) ?? []), l.itemName]);
  }
  for (const [reason, names] of byReason)
    out.push(`Rejected: ${names.join(", ")}.${reason ? ` ${reason}` : ""}`);
  if (note) out.push(note);
  return out.join("\n");
}

// ───────────── stock guidance (D-040) ─────────────

/**
 * ASSUMPTION (team, 2026-10-13; to confirm with CPoint): an item is "still well stocked" when
 * there is more on hand than this many times its reorder level. Exactly this many times is not.
 */
export const WELL_STOCKED_FACTOR = 2;

const hundredths = (n: number) => Math.round(n * 100);

/** An item with no reorder level set (0) is never called well stocked: there is nothing to compare. */
export function isWellStocked(onHand: number, reorderLevel: number): boolean {
  if (reorderLevel <= 0) return false;
  return hundredths(onHand) > WELL_STOCKED_FACTOR * hundredths(reorderLevel);
}

/**
 * What the decision panel pre-selects for an item. Only a suggestion: the Floor Manager confirms
 * every item. Well stocked → reject; low or out → approve; anything else (in between, no reorder
 * level, or not in inventory) → nothing.
 */
export function suggestedDecision(
  stock: { onHand: number; reorderLevel: number } | null,
): LineOutcome | null {
  if (!stock) return null;
  if (isWellStocked(stock.onHand, stock.reorderLevel)) return "REJECTED";
  if (stock.onHand <= 0) return "APPROVED";
  if (stock.reorderLevel > 0 && stock.onHand <= stock.reorderLevel) return "APPROVED";
  return null;
}

/** The reason filled in for a well-stocked item. The Floor Manager can change it. */
export function wellStockedReason(onHand: number, reorderLevel: number, unit: string): string {
  return `Stock is still high (${formatQuantity(onHand, unit)} on hand, reorder at ${formatQuantity(reorderLevel)}).`;
}

/** "On hand 40 boxes · reorder at 10 · was 38 when requested". */
export function stockGuidanceLine(
  stock: { onHand: number; reorderLevel: number; unit: string },
  onHandAtRequest: number | null,
): string {
  const parts = [
    `On hand ${formatQuantity(stock.onHand, stock.unit)}`,
    `reorder at ${formatQuantity(stock.reorderLevel)}`,
  ];
  if (onHandAtRequest !== null) parts.push(`was ${formatQuantity(onHandAtRequest)} when requested`);
  return parts.join(" · ");
}

// ───────────── ordering and deliveries (D-041, D-042) ─────────────

/** Proof-of-delivery files: a photo or PDF of the supplier's receipt. */
export const POD_MAX_FILES = 5;
export const POD_MAX_BYTES = 10 * 1024 * 1024;
export const POD_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
/** How far ahead an expected delivery date may be. */
export const EXPECTED_DELIVERY_MAX_DAYS = 365;

/** What is still to come on one approved item, never below zero. Worked in hundredths (D-023). */
export function outstandingQuantity(quantity: number, received: number): number {
  return Math.max(0, hundredths(quantity) - hundredths(received)) / 100;
}

type ReceiptLine = { decision: PurchaseLineDecision; quantity: number; receivedQuantity: number };

/**
 * A request's status after a delivery, from its approved items: received once nothing is
 * outstanding, partly received while something still is.
 */
export function deriveReceiptStatus(
  lines: readonly ReceiptLine[],
): "PARTIALLY_RECEIVED" | "RECEIVED" {
  const waiting = lines.some(
    (l) => l.decision === "APPROVED" && outstandingQuantity(l.quantity, l.receivedQuantity) > 0,
  );
  return waiting ? "PARTIALLY_RECEIVED" : "RECEIVED";
}

/** "6 rolls of Black cowhide": what never arrived on a request that was closed short. */
export function shortfallNote(
  lines: readonly (ReceiptLine & { itemName: string; unit: string })[],
): string {
  return lines
    .filter((l) => l.decision === "APPROVED")
    .map((l) => ({
      name: l.itemName,
      unit: l.unit,
      left: outstandingQuantity(l.quantity, l.receivedQuantity),
    }))
    .filter((l) => l.left > 0)
    .map((l) => `${formatQuantity(l.left, l.unit)} of ${l.name}`)
    .join(", ");
}

const AWAITING_DELIVERY: readonly PurchaseRequestStatus[] = ["ORDERED", "PARTIALLY_RECEIVED"];

/** Ordered, not all here, and the expected date has passed (Manila calendar dates, YYYY-MM-DD). */
export function isDeliveryLate(
  status: PurchaseRequestStatus,
  expectedDeliveryOn: Date | string | null | undefined,
  today: string,
): boolean {
  if (!expectedDeliveryOn || !AWAITING_DELIVERY.includes(status)) return false;
  return calendarDay(expectedDeliveryOn) < today;
}

// ───────────── moves ─────────────

const MOVES: Record<
  PurchaseAction,
  { from: readonly PurchaseRequestStatus[]; to: PurchaseRequestStatus }
> = {
  approve: { from: ["PENDING"], to: "APPROVED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  cancel: { from: ["PENDING", "APPROVED", "ORDERED"], to: "CANCELLED" },
  order: { from: ["APPROVED"], to: "ORDERED" },
  // Where a delivery leaves the request depends on what arrived: see deriveReceiptStatus.
  receive: { from: ["ORDERED", "PARTIALLY_RECEIVED"], to: "RECEIVED" },
  close_short: { from: ["PARTIALLY_RECEIVED"], to: "RECEIVED" },
};

const VERB: Record<PurchaseAction, string> = {
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
  order: "marked as ordered",
  receive: "received",
  close_short: "closed short",
};

/** "Only pending, approved or ordered requests can be cancelled." */
const ONLY: Record<PurchaseAction, string> = {
  approve: "Only a pending request can be approved.",
  reject: "Only a pending request can be rejected.",
  cancel: "Only pending, approved or ordered requests can be cancelled.",
  order: "Only an approved request can be marked as ordered.",
  receive: "A delivery can be recorded only on an ordered or partly received request.",
  close_short: "Only a partly received request can be closed short.",
};

export type Transition =
  | { ok: true; from: PurchaseRequestStatus; to: PurchaseRequestStatus }
  | { ok: false; reason: string };

/** Where an action takes a request, or why it can't, in one sentence that says what to do. */
export function transition(status: PurchaseRequestStatus, action: PurchaseAction): Transition {
  const move = MOVES[action];
  if (move.from.includes(status)) return { ok: true, from: status, to: move.to };
  if (action === "cancel" && status === "PARTIALLY_RECEIVED")
    return {
      ok: false,
      reason:
        "Part of this request has already arrived, so it can't be cancelled. Use Close short for what won't come.",
    };
  if (action === "receive" && status === "APPROVED")
    return {
      ok: false,
      reason: "Mark this request as ordered first, then record the delivery.",
    };
  return {
    ok: false,
    reason: `${ONLY[action]} This one is ${STATUS_LABELS[status].toLowerCase()}.`,
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
