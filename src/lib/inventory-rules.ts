import type { InventoryCategory, MovementType } from "./domain";

/**
 * Inventory rules (D-023, D-102), pure and client-safe. The stock is a ledger: `quantityOnHand`
 * changes only through a movement, and movements are never edited or deleted. Since Phase 29 the
 * Floor Manager records stock on the Update stock sheet: per item what was added (+), used (−) or
 * corrected. Services enforce these rules; the database update is also conditional, so a race
 * can't push stock below zero or apply a change to stock the sheet didn't see.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string; code?: "STALE" };

export const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  LEATHER_ROLL: "Leather roll",
  NAILS: "Nails",
  ADHESIVE: "Adhesive",
  THREAD: "Thread",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

/** Prefix for the suggested item code, e.g. LR-001. */
export const CATEGORY_PREFIX: Record<InventoryCategory, string> = {
  LEATHER_ROLL: "LR",
  NAILS: "NL",
  ADHESIVE: "AD",
  THREAD: "TH",
  EQUIPMENT: "EQ",
  OTHER: "OT",
};

/** What each ledger type reads as since Phase 29 (D-102): Added, Used, Correction. */
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: "Added",
  OUT: "Used",
  ADJUST: "Correction",
};

export const MAX_QUANTITY = 1_000_000;

// ───────────── quantities ─────────────

/** Quantities are stored with 2 decimals; work in hundredths so 0.1 + 0.2 stays exact. */
const toHundredths = (n: number) => Math.round(n * 100);
const fromHundredths = (n: number) => n / 100;

export function hasAtMostTwoDecimals(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

const COUNT_UNITS = new Set([
  "roll",
  "box",
  "piece",
  "pc",
  "pack",
  "pair",
  "can",
  "bottle",
  "spool",
  "cone",
  "set",
  "tube",
  "bag",
  "sheet",
]);

/** "3 rolls", "1 roll", "2.5 kg", "0 rolls". Trailing zeros are dropped. */
export function formatQuantity(quantity: number, unit?: string): string {
  const n = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(quantity);
  if (!unit) return n;
  const plural =
    quantity !== 1 && COUNT_UNITS.has(unit.toLowerCase())
      ? `${unit}${/(s|x|z|ch|sh)$/i.test(unit) ? "es" : "s"}`
      : unit;
  return `${n} ${plural}`;
}

/** "+3", "−1.5" (true minus sign), "0". */
export function formatDelta(delta: number): string {
  const n = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(Math.abs(delta));
  return delta > 0 ? `+${n}` : delta < 0 ? `−${n}` : "0";
}

// ───────────── stock level ─────────────

export type StockLevel = "OUT" | "LOW" | "OK";

/** Low = at or below the reorder level; Out = nothing left. */
export function stockLevel(quantityOnHand: number, reorderLevel: number): StockLevel {
  if (quantityOnHand <= 0) return "OUT";
  if (quantityOnHand <= reorderLevel) return "LOW";
  return "OK";
}

// ───────────── item codes ─────────────

export function formatItemCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/** The next free code for a prefix, given the codes already in use (any prefix). */
export function nextItemCode(prefix: string, existing: string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const max = existing.reduce((m, code) => {
    const hit = pattern.exec(code);
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return formatItemCode(prefix, max + 1);
}

// ───────────── stock updates (Phase 29, D-102) ─────────────

/**
 * One item's line on the Update stock sheet: what was added, what was used, and a correction for
 * a miscount (either sign, with a reason). Each becomes its own ledger movement: IN, OUT, ADJUST.
 * Only Used counts as consumption in the reports; Added and Correction never do.
 */
export type StockLineInput = {
  /** The stock the sheet showed when it loaded. */
  seenQuantity: number;
  added?: number;
  used?: number;
  correction?: number;
  reason?: string;
};

export type StockLineField = "added" | "used" | "correction" | "reason";

export const DEFAULT_NOTE = {
  IN: "Added on a stock update",
  OUT: "Used on the line",
} as const;

export type PlannedEntry = { type: MovementType; delta: number; reason: string };

/**
 * Checks one line of the sheet and turns it into the movements to store, in this order: Added,
 * Used, Correction. Nothing may take the stock below zero, a correction needs a reason, and the
 * stock must still be what the sheet saw (STALE).
 */
export function planStockLine(
  item: { name: string; unit?: string; quantityOnHand: number; isActive: boolean },
  line: StockLineInput,
):
  | { ok: true; entries: PlannedEntry[]; after: number }
  | { ok: false; reason: string; code?: "STALE"; field?: StockLineField } {
  if (!item.isActive)
    return { ok: false, reason: `${item.name} is deactivated. Reactivate it to record stock.` };
  if (toHundredths(line.seenQuantity) !== toHundredths(item.quantityOnHand))
    return { ok: false, code: "STALE", reason: staleLine(item) };
  const added = toHundredths(line.added ?? 0);
  const used = toHundredths(line.used ?? 0);
  const correction = toHundredths(line.correction ?? 0);
  if (added < 0)
    return {
      ok: false,
      field: "added",
      reason: `Enter what was added to ${item.name} as a plus number, like 6.`,
    };
  if (used < 0)
    return {
      ok: false,
      field: "used",
      reason: `Enter what was used of ${item.name} as a number, like 3.`,
    };
  if (added === 0 && used === 0 && correction === 0)
    return {
      ok: false,
      field: "added",
      reason: `Enter what was added, used or corrected for ${item.name}, or leave its row blank.`,
    };
  const onHand = toHundredths(item.quantityOnHand);
  if (onHand + added - used < 0)
    return {
      ok: false,
      field: "used",
      reason: notEnoughStock(fromHundredths(onHand + added), item.unit, item.name),
    };
  if (onHand + added - used + correction < 0)
    return {
      ok: false,
      field: "correction",
      reason: `The correction would take ${item.name} below zero. Enter at most −${formatQuantity(fromHundredths(onHand + added - used))}.`,
    };
  const note = line.reason?.trim() ?? "";
  if (correction !== 0 && note.length < 3)
    return {
      ok: false,
      field: "reason",
      reason: `Enter a reason for the ${item.name} correction, like “Recounted the shelf.”`,
    };
  const entries: PlannedEntry[] = [];
  if (added) entries.push({ type: "IN", delta: fromHundredths(added), reason: DEFAULT_NOTE.IN });
  if (used) entries.push({ type: "OUT", delta: -fromHundredths(used), reason: DEFAULT_NOTE.OUT });
  if (correction) entries.push({ type: "ADJUST", delta: fromHundredths(correction), reason: note });
  return { ok: true, entries, after: fromHundredths(onHand + added - used + correction) };
}

export function staleLine(item: { name: string; unit?: string; quantityOnHand: number }): string {
  return `${item.name} changed while you were updating (now ${formatQuantity(item.quantityOnHand, item.unit)}). Check it and save again.`;
}

export function notEnoughStock(onHand: number, unit?: string, name?: string): string {
  return `Only ${formatQuantity(onHand, unit)}${name ? ` of ${name}` : ""} in stock. Enter a smaller amount.`;
}
