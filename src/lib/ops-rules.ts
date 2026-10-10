import type { Stage } from "./domain";
import { STAGE_LABELS } from "./domain";
import { formatDuration } from "./format";

export { stockLevel, type StockLevel } from "./inventory-rules";

/**
 * Operations report rules (D-033), pure and client-safe. Everything is an aggregate per day,
 * stage, batch, item, supplier or request, never per person (D-008). The thresholds below are
 * operational defaults for what the report calls "needs attention"; they are named here so a
 * later settings screen can take them over.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const ATTENTION = {
  /** A batch is "waiting longer than usual" past this multiple of its stage's median visit. */
  stuckFactor: 1.5,
  /** Visits needed before a stage median is trusted enough to flag against it. */
  minVisitsForMedian: 3,
  /** Never flag a batch that has been in a stage for less than this. */
  minStuckMs: HOUR,
  /** A repair that nobody has started after this long is "waiting". */
  repairWaitingMs: DAY,
  /** Stock that would run out within this many days at the recent pace. */
  coverDays: 3,
  /** A pending purchase request older than this needs a decision. */
  requestPendingMs: 2 * DAY,
  /** An approved request not received after this long is late. */
  requestLateMs: 7 * DAY,
  /** A supplier is flagged when its rework + reject share is this far above the line's. */
  supplierGap: 0.1,
  /** Sections needed before a supplier's share means anything. */
  supplierMinSections: 30,
} as const;

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

// ───────────── flow ─────────────

export type OpenBatch = {
  id: string;
  code: string;
  shoeType: string;
  stage: Stage;
  /** How long it has been in this stage, in ms. */
  inStageMs: number;
  openRepairs: number;
};

export type StageStat = { stage: Stage; visits: number; medianMs: number | null };

/**
 * Batches that have sat in their stage longer than usual: more than `stuckFactor` × that stage's
 * median visit (trusted only with enough visits) and at least `minStuckMs`. Longest wait first.
 */
export function findStuckBatches(batches: OpenBatch[], stages: StageStat[]): OpenBatch[] {
  const median = new Map(
    stages
      .filter((s) => s.medianMs !== null && s.visits >= ATTENTION.minVisitsForMedian)
      .map((s) => [s.stage, s.medianMs as number]),
  );
  return batches
    .filter((b) => {
      const m = median.get(b.stage);
      return (
        m !== undefined && b.inStageMs > Math.max(m * ATTENTION.stuckFactor, ATTENTION.minStuckMs)
      );
    })
    .sort((a, b) => b.inStageMs - a.inStageMs);
}

/** Each stage's share of the total of all stage medians (where the lead time goes). */
export function stageShares<T extends { stage: Stage; medianMs: number | null }>(
  stages: T[],
): Map<Stage, number | null> {
  const total = stages.reduce((t, s) => t + (s.medianMs ?? 0), 0);
  return new Map(stages.map((s) => [s.stage, total > 0 && s.medianMs ? s.medianMs / total : null]));
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
  stages: (StageStat & { inStageNow: number; longestWaitMs: number | null })[];
  bottleneck: Stage | null;
  stuck: OpenBatch[];
  repairs: { waitingOverDay: number; open: number; oldestWaitingMs: number | null };
  stock: { out: number; low: number; shortCover: { item: string; days: number }[] };
  requests: {
    highPending: number;
    pending: number;
    oldestPendingMs: number | null;
    lateAwaitingDelivery: number;
  };
  suppliers: { supplier: string; sections: number; problemShare: number | null }[];
  lineProblemShare: number | null;
  flaggedScans: number;
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
      detail: "Raise a purchase request before they run out.",
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

  if (i.bottleneck) {
    const s = i.stages.find((x) => x.stage === i.bottleneck);
    if (s && s.inStageNow > 0 && s.medianMs !== null)
      out.push({
        id: "bottleneck",
        severity: "warning",
        title: `${STAGE_LABELS[s.stage]} is the bottleneck`,
        detail: `Median ${formatDuration(s.medianMs)} per visit, with ${plural(s.inStageNow, "batch", "batches")} in it now.`,
        href: `/batches?stage=${s.stage}`,
      });
  }

  if (i.stuck.length > 0) {
    const names = i.stuck
      .slice(0, 3)
      .map((b) => b.code)
      .join(", ");
    out.push({
      id: "stuck",
      severity: "warning",
      title: `${plural(i.stuck.length, "batch", "batches")} waiting longer than usual`,
      detail: `${names}${i.stuck.length > 3 ? ` and ${i.stuck.length - 3} more` : ""}. Longest: ${formatDuration(i.stuck[0].inStageMs)} in ${STAGE_LABELS[i.stuck[0].stage]}.`,
      href: "/batches?status=IN_PROGRESS",
    });
  }

  if (i.repairs.waitingOverDay > 0)
    out.push({
      id: "repairs-waiting",
      severity: "warning",
      title: `${plural(i.repairs.waitingOverDay, "section")} waiting over a day at the repair station`,
      detail:
        i.repairs.oldestWaitingMs !== null
          ? `The oldest has waited ${formatDuration(i.repairs.oldestWaitingMs)} without being started.`
          : "Nobody has started them yet.",
      href: "/rework",
    });

  if (i.requests.highPending > 0)
    out.push({
      id: "requests-high",
      severity: "warning",
      title: `${plural(i.requests.highPending, "high-urgency purchase request")} waiting for a decision`,
      detail: "They are needed within 3 working days and are listed first in the Pending tab.",
      href: "/procurement?status=PENDING",
    });
  else if (
    i.requests.oldestPendingMs !== null &&
    i.requests.oldestPendingMs > ATTENTION.requestPendingMs
  )
    out.push({
      id: "requests-old",
      severity: "info",
      title: `${plural(i.requests.pending, "purchase request")} pending`,
      detail: `The oldest has waited ${formatDuration(i.requests.oldestPendingMs)}.`,
      href: "/procurement?status=PENDING",
    });
  if (i.requests.lateAwaitingDelivery > 0)
    out.push({
      id: "requests-late",
      severity: "warning",
      title: `${plural(i.requests.lateAwaitingDelivery, "approved request")} not received after a week`,
      detail: "Check with the supplier, then mark received when it arrives.",
      href: "/procurement?status=APPROVED",
    });

  if (i.lineProblemShare !== null) {
    const worst = i.suppliers
      .filter(
        (s) =>
          s.sections >= ATTENTION.supplierMinSections &&
          s.problemShare !== null &&
          s.problemShare >= (i.lineProblemShare as number) + ATTENTION.supplierGap,
      )
      .sort((a, b) => (b.problemShare ?? 0) - (a.problemShare ?? 0))[0];
    if (worst)
      out.push({
        id: "supplier",
        severity: "warning",
        title: `Leather from ${worst.supplier} has more defects than the rest`,
        detail: `${Math.round((worst.problemShare ?? 0) * 100)}% of its sections needed rework or were rejected, against ${Math.round(i.lineProblemShare * 100)}% overall.`,
        href: "/reports?view=operations#suppliers",
      });
  }

  if (i.flaggedScans > 0)
    out.push({
      id: "flagged",
      severity: "info",
      title: `${plural(i.flaggedScans, "flagged scan")} waiting for the Quality Inspector`,
      detail: "The camera found a defect it doesn’t know. They wait until a QI decides.",
      href: "/review",
    });

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
