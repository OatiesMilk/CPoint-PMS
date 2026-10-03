import type { InventoryCategory, MovementType } from "./domain";

/**
 * Inventory rules (D-023), pure and client-safe. The stock is a ledger: `quantityOnHand` changes
 * only through a movement, and movements are never edited or deleted. Services enforce these
 * rules; the database update is also conditional, so a race can't push stock below zero.
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

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: "Received",
  OUT: "Used",
  ADJUST: "Stock count",
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
  const plural = quantity !== 1 && COUNT_UNITS.has(unit.toLowerCase()) ? `${unit}s` : unit;
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

// ───────────── movements ─────────────

export type MovementInput =
  | { type: "IN"; quantity: number; reason?: string }
  | { type: "OUT"; quantity: number; reason?: string }
  | { type: "ADJUST"; counted: number; expectedQuantity: number; reason?: string };

export const DEFAULT_REASON: Partial<Record<MovementType, string>> = {
  IN: "Delivery received",
  OUT: "Used in production",
};

/**
 * Turns a movement request into the signed delta to store. ADJUST takes the counted quantity and
 * the quantity the user saw; if stock moved meanwhile, the count is stale.
 */
export function planMovement(
  item: { quantityOnHand: number; isActive: boolean; unit?: string },
  input: MovementInput,
): Result<{ delta: number; reason: string }> {
  if (!item.isActive)
    return { ok: false, reason: "This item is deactivated. Reactivate it to record stock." };
  const reason = input.reason?.trim() || DEFAULT_REASON[input.type] || "";

  if (input.type === "ADJUST") {
    if (!reason) return { ok: false, reason: "Say why the count differs." };
    if (toHundredths(input.expectedQuantity) !== toHundredths(item.quantityOnHand))
      return {
        ok: false,
        code: "STALE",
        reason: "Stock changed while you were counting. Check the new quantity and count again.",
      };
    const delta = toHundredths(input.counted) - toHundredths(item.quantityOnHand);
    if (delta === 0)
      return { ok: false, reason: "The count matches the recorded stock, so nothing changes." };
    return { ok: true, delta: fromHundredths(delta), reason };
  }

  if (input.type === "OUT" && toHundredths(input.quantity) > toHundredths(item.quantityOnHand))
    return { ok: false, reason: notEnoughStock(item.quantityOnHand, item.unit) };
  const sign = input.type === "IN" ? 1 : -1;
  return { ok: true, delta: sign * input.quantity, reason };
}

export function notEnoughStock(onHand: number, unit?: string): string {
  return `Only ${formatQuantity(onHand, unit)} in stock. Record a delivery first, or use less.`;
}

/** The movement that undoes an IN or OUT (the Undo toast). Stock counts are corrected by counting again. */
export function reversalOf(movement: { type: MovementType; quantityDelta: number }) {
  if (movement.type === "ADJUST") return null;
  return {
    type: (movement.type === "IN" ? "OUT" : "IN") as "IN" | "OUT",
    quantity: Math.abs(movement.quantityDelta),
  };
}
