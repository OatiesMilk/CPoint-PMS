export { stockLevel, type StockLevel } from "./inventory-rules";

/**
 * Operations report rules (D-033), pure and client-safe. Everything is an aggregate per day,
 * batch, roll, item or supplier, never per person (D-008). The thresholds below are
 * operational defaults for what the report calls "needs attention"; they are named here so a
 * later settings screen can take them over.
 */

export const ATTENTION = {
  /** Stock that would run out within this many days at the recent pace. */
  coverDays: 3,
  /** A supplier is flagged when its reject share is this far above the line's. */
  supplierGap: 0.1,
  /** Sections needed before a supplier's share means anything. */
  supplierMinSections: 30,
} as const;

/**
 * A supplier whose reject share (sections for salvage) is well above the whole line's, over enough
 * sections to mean something. The Supplier quality "High" badge and the attention item use this
 * one rule, so they never disagree (Phase 20; reject only since Phase 25, D-093).
 */
export function supplierIsHigh(
  s: { sections: number; rejectShare: number | null },
  lineRejectShare: number | null,
): boolean {
  return (
    lineRejectShare !== null &&
    s.rejectShare !== null &&
    s.sections >= ATTENTION.supplierMinSections &&
    s.rejectShare >= lineRejectShare + ATTENTION.supplierGap
  );
}

// ───────────── period comparison ─────────────

export type Delta = {
  /** Current value. */
  value: number | null;
  /** The previous period of the same length. */
  previous: number | null;
  /** (value - previous) / previous; null when there is nothing to compare. */
  change: number | null;
};

/** Current vs previous period. A zero or missing baseline has no percentage. */
export function compare(value: number | null, previous: number | null): Delta {
  const change =
    value !== null && previous !== null && previous !== 0 ? (value - previous) / previous : null;
  return { value, previous, change };
}

/** "up 12%", "down 5%", "no change", or "no earlier data" (words, so it never rests on colour). */
export function describeChange(change: number | null): string {
  if (change === null) return "no earlier data";
  const pct = Math.round(Math.abs(change) * 100);
  if (pct === 0) return "no change";
  return `${change > 0 ? "up" : "down"} ${pct}%`;
}

// ───────────── inventory ─────────────

/**
 * Days the stock lasts at the pace used over the range. Null when nothing was used (no pace to
 * project), so an idle item never looks "safe" or "short".
 */
export function daysOfCover(onHand: number, usedInRange: number, rangeDays: number): number | null {
  if (usedInRange <= 0 || rangeDays <= 0) return null;
  return Math.max(0, onHand) / (usedInRange / rangeDays);
}

// ───────────── quality ─────────────

/** Pareto: share of the total and the running share, biggest first (the 80/20 reading). */
export function paretoShares<T extends { scans: number }>(
  rows: T[],
): (T & { share: number; cumulative: number })[] {
  const total = rows.reduce((t, r) => t + r.scans, 0);
  let running = 0;
  return [...rows]
    .sort((a, b) => b.scans - a.scans)
    .map((r) => {
      running += r.scans;
      return { ...r, share: total ? r.scans / total : 0, cumulative: total ? running / total : 0 };
    });
}

// ───────────── what needs attention ─────────────

export type AttentionItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
};

const RANK = { critical: 0, warning: 1, info: 2 } as const;

export type AttentionInput = {
  /** "3 of the last 5 working days were below quota" (Phase 23); null when fewer than 2 were. */
  belowQuota: { below: number; of: number } | null;
  stock: { out: number; low: number; shortCover: { item: string; days: number }[] };
  suppliers: { supplier: string; sections: number; rejectShare: number | null }[];
  lineRejectShare: number | null;
};

/**
 * The few things worth acting on, most urgent first. This is the answer to "what's wrong on the
 * floor right now"; each item links to the screen where it's handled.
 */
export function buildAttention(i: AttentionInput): AttentionItem[] {
  const out: AttentionItem[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  if (i.stock.out > 0)
    out.push({
      id: "stock-out",
      severity: "critical",
      title: `${plural(i.stock.out, "item")} out of stock`,
      detail: "Production that needs these can’t continue until they’re received.",
      href: "/inventory",
    });
  if (i.stock.low > 0)
    out.push({
      id: "stock-low",
      severity: "warning",
      title: `${plural(i.stock.low, "item")} at or below reorder level`,
      detail: "Restock them before they run out.",
      href: "/inventory",
    });
  if (i.stock.shortCover.length > 0) {
    const first = i.stock.shortCover[0];
    out.push({
      id: "stock-cover",
      severity: "warning",
      title: `${first.item} lasts about ${Math.max(1, Math.round(first.days))} day${Math.round(first.days) <= 1 ? "" : "s"}`,
      detail:
        i.stock.shortCover.length > 1
          ? `And ${i.stock.shortCover.length - 1} more at the recent pace of use.`
          : "At the pace used in this period.",
      href: "/inventory",
    });
  }

  if (i.belowQuota)
    out.push({
      id: "below-quota",
      severity: "warning",
      title: `${i.belowQuota.below} of the last ${i.belowQuota.of} working days were below quota`,
      detail:
        "Batches shows each day's passed pairs against the quota and how many Shoe Constructors were present.",
      href: "/batches",
    });

  if (i.lineRejectShare !== null) {
    const worst = i.suppliers
      .filter((s) => supplierIsHigh(s, i.lineRejectShare))
      .sort((a, b) => (b.rejectShare ?? 0) - (a.rejectShare ?? 0))[0];
    if (worst)
      out.push({
        id: "supplier",
        severity: "warning",
        title: `Leather from ${worst.supplier} has more defects than the rest`,
        detail: `${Math.round((worst.rejectShare ?? 0) * 100)}% of its sections were rejected (for salvage), against ${Math.round(i.lineRejectShare * 100)}% overall.`,
        href: "/reports?view=operations#supplier-quality",
      });
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
