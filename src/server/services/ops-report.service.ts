import { manilaToday } from "@/lib/format";
import { urgencyCutoffs } from "@/lib/procurement-rules";
import {
  ATTENTION,
  buildAttention,
  compare,
  daysOfCover,
  paretoShares,
  stockLevel,
  supplierIsHigh,
} from "@/lib/ops-rules";
import { agreementRate, previousRange, toCsv, type ReportRange } from "@/lib/report-rules";
import { belowQuotaAttention, ATTENTION_DAYS } from "@/lib/production-rules";
import { countRollsByStatus } from "@/server/models/batch.model";
import {
  procurementFlow,
  repairQueue,
  repairTurnaround,
  countBatchVerdicts,
  findClaimBatch,
  rollsWithMostRejects,
  stockPosition,
  supplierDefects,
  supplierQuality,
} from "@/server/models/ops-report.model";
import { productionReport, recentProductionDays } from "./production.service";
import { qualityReport, rollFlow } from "./report.service";

// Operations report (D-033): what is happening on the floor, in resources, flow, stock, purchasing
// and supply. Aggregates per day, shoe type, batch, item, supplier or request. Nothing here carries a user
// id, name or email (D-008); tests/unit/ops-report.service.test.ts checks that.

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);
/** Rolls listed under Supplier quality, and in its CSV. */
const ROLLS_SHOWN = 5;
const ROLLS_CSV = 100;

// ───────────── repair station ─────────────

/** Sections at the repair station now with how far each has got, plus the period's turnaround. */
export async function repairStation(range: ReportRange, now: Date = new Date()) {
  const [queue, turnaround] = await Promise.all([repairQueue(), repairTurnaround(range)]);
  const rows = queue.map((r) => ({
    id: r.id,
    status: r.status,
    batchId: r.batchId,
    batchCode: r.batchCode,
    sequence: r.sequence,
    defect: r.defect,
    waitingMs: Math.max(0, now.getTime() - new Date(r.openedAt).getTime()),
    repairingMs: r.startedAt ? Math.max(0, now.getTime() - new Date(r.startedAt).getTime()) : null,
  }));
  const waiting = rows.filter((r) => r.status === "OPEN");
  const oldestWaitingMs = waiting.length ? Math.max(...waiting.map((r) => r.waitingMs)) : null;
  return {
    asOf: now.toISOString(),
    waiting: waiting.length,
    beingRepaired: rows.length - waiting.length,
    total: rows.length,
    waitingOverDay: waiting.filter((r) => r.waitingMs > ATTENTION.repairWaitingMs).length,
    oldestWaitingMs,
    doneInRange: turnaround.done,
    medianTurnaroundMs: turnaround.medianMs,
    rows,
  };
}

export type RepairStation = Awaited<ReturnType<typeof repairStation>>;

// ───────────── operations ─────────────

export async function operationsReport(range: ReportRange, now: Date = new Date()) {
  const prev = previousRange(range, now);
  const [
    production,
    prevProduction,
    rolls,
    prevRolls,
    rollsNow,
    recent,
    quality,
    prevQuality,
    repairs,
    stockRows,
    procurement,
    supplierRows,
    supplierDefectRows,
    rejectedRolls,
  ] = await Promise.all([
    productionReport(range, now),
    productionReport(prev, now),
    rollFlow(range),
    rollFlow(prev),
    countRollsByStatus(),
    recentProductionDays(ATTENTION_DAYS, now),
    qualityReport(range),
    qualityReport(prev),
    repairStation(range, now),
    stockPosition(range),
    procurementFlow(range, now, urgencyCutoffs(manilaToday(now)).highThrough, manilaToday(now)),
    supplierQuality(range),
    supplierDefects(range),
    rollsWithMostRejects(range, ROLLS_SHOWN),
  ]);

  // Stock: level, and how long it lasts at the pace used in this period.
  const stockItems = stockRows.map((r) => ({
    id: r.id,
    sku: r.sku,
    item: r.name,
    category: r.category,
    unit: r.unit,
    onHand: r.onHand,
    reorderLevel: r.reorderLevel,
    used: r.used,
    received: r.received,
    requested: r.requested,
    level: stockLevel(r.onHand, r.reorderLevel),
    coverDays: daysOfCover(r.onHand, r.used, range.days),
  }));
  const shortCover = stockItems
    .filter((i) => i.level === "OK" && i.coverDays !== null && i.coverDays < ATTENTION.coverDays)
    .sort((a, b) => (a.coverDays ?? 0) - (b.coverDays ?? 0));
  const order = ["OUT", "LOW", "OK"];
  const all = [...stockItems].sort(
    (a, b) =>
      order.indexOf(a.level) - order.indexOf(b.level) ||
      (a.coverDays ?? Infinity) - (b.coverDays ?? Infinity) ||
      a.item.localeCompare(b.item),
  );
  const atRisk = all.filter((i) => i.level !== "OK" || shortCover.includes(i));
  const byCategory = [...new Set(stockItems.map((i) => i.category))].map((category) => {
    const items = stockItems.filter((i) => i.category === category);
    return {
      category,
      items: items.length,
      out: items.filter((i) => i.level === "OUT").length,
      low: items.filter((i) => i.level === "LOW").length,
    };
  });
  const stock = {
    items: stockItems.length,
    out: stockItems.filter((i) => i.level === "OUT").length,
    low: stockItems.filter((i) => i.level === "LOW").length,
    shortCover: shortCover.length,
    atRisk,
    all,
    byCategory,
  };

  // Supply: how each supplier's leather performed on the camera, worst first (Phase 20).
  const lineDecided = quality.totals.pass + quality.totals.rework + quality.totals.reject;
  const lineProblemShare = share(quality.totals.rework + quality.totals.reject, lineDecided);
  const suppliers = supplierRows
    .map((r) => {
      const decided = r.pass + r.rework + r.reject;
      const problemShare = share(r.rework + r.reject, decided);
      // Rows come most common first, so the first one for this supplier is its top defect.
      const top = supplierDefectRows.find((d) => d.groupId === r.id);
      return {
        id: r.id,
        supplier: r.name,
        batches: r.batches,
        rolls: r.rolls,
        sections: r.scanned,
        decided,
        pass: r.pass,
        rework: r.rework,
        reject: r.reject,
        cleanShare: share(r.pass, decided),
        reworkShare: share(r.rework, decided),
        rejectShare: share(r.reject, decided),
        problemShare,
        topDefect: top?.label ?? null,
        high: supplierIsHigh({ sections: r.scanned, problemShare }, lineProblemShare),
      };
    })
    .sort((a, b) => (b.problemShare ?? -1) - (a.problemShare ?? -1) || b.sections - a.sections);

  const qt = quality.totals;
  const pt = prevQuality.totals;
  const fpy = (t: typeof qt) => share(t.pass, t.pass + t.rework + t.reject);

  const kpis = {
    pairs: compare(production.totals.pairs, prevProduction.totals.pairs),
    ofQuota: compare(production.totals.share, prevProduction.totals.share),
    rollsFinished: compare(rolls.totals.completed, prevRolls.totals.completed),
    rollsAtPreparation: rollsNow.atPreparation,
    firstPassYield: compare(fpy(qt), fpy(pt)),
    rejectRate: compare(
      share(qt.reject, lineDecided),
      share(pt.reject, pt.pass + pt.rework + pt.reject),
    ),
    sectionsScanned: compare(qt.scanned, pt.scanned),
    repairsOpen: repairs.total,
  };

  const attention = buildAttention({
    belowQuota: belowQuotaAttention(recent.days),
    repairs: {
      waitingOverDay: repairs.waitingOverDay,
      open: repairs.total,
      oldestWaitingMs: repairs.oldestWaitingMs,
    },
    stock: {
      out: stock.out,
      low: stock.low,
      shortCover: shortCover.map((i) => ({ item: i.item, days: i.coverDays ?? 0 })),
    },
    requests: {
      highPending: procurement.highPending,
      pending: procurement.pending,
      oldestPendingMs: procurement.oldestPendingMs,
      lateAwaitingDelivery: procurement.lateAwaitingDelivery,
    },
    suppliers: suppliers.map((s) => ({
      supplier: s.supplier,
      sections: s.sections,
      problemShare: s.problemShare,
    })),
    lineProblemShare,
    flaggedScans: qt.pending,
  });

  // One row per day: rolls started and finished, the camera's checkpoint and repairs done.
  const productionByDay = new Map(rolls.days.map((d) => [d.day, d]));
  const days = quality.days.map((d) => ({
    day: d.day,
    started: productionByDay.get(d.day)?.started ?? 0,
    completed: productionByDay.get(d.day)?.completed ?? 0,
    scanned: d.scanned,
    pass: d.pass,
    rework: d.rework,
    reject: d.reject,
    repairsDone: d.repairsDone,
  }));

  return {
    range: { from: range.from, to: range.to, days: range.days },
    previous: { from: prev.from, to: prev.to },
    asOf: now.toISOString(),
    kpis,
    attention,
    /** Pairs per day per shoe type against the quota (Phase 23; replaces the stage sections). */
    production,
    days,
    repairs,
    stock,
    procurement,
    suppliers,
    rejectedRolls,
    lineProblemShare,
    /** The checkpoint before cutting, kept as a short summary; the full view is Quality. */
    checkpoint: {
      totals: { ...qt, firstPassYield: fpy(qt), agreement: agreementRate(qt) },
      defects: paretoShares(quality.defects).slice(0, 5),
    },
  };
}

export type OperationsReport = Awaited<ReturnType<typeof operationsReport>>;

// ───────────── CSV ─────────────

const pct = (v: number | null) => (v === null ? "" : (Math.round(v * 1000) / 10).toFixed(1));

/** One row per Manila day: rolls, checkpoint and repairs. */
export async function operationsCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Rolls started", value: (d) => d.started },
    { header: "Rolls finished", value: (d) => d.completed },
    { header: "Sections scanned", value: (d) => d.scanned },
    { header: "Pass", value: (d) => d.pass },
    { header: "Fixable", value: (d) => d.rework },
    { header: "Reject", value: (d) => d.reject },
    { header: "Cleaned or cut around", value: (d) => d.repairsDone },
  ]);
}

export async function suppliersCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.suppliers, [
    { header: "Supplier", value: (s) => s.supplier },
    { header: "Rolls", value: (s) => s.rolls },
    { header: "Batches", value: (s) => s.batches },
    { header: "Sections scanned", value: (s) => s.sections },
    { header: "Pass", value: (s) => s.pass },
    { header: "Fixable", value: (s) => s.rework },
    { header: "Reject", value: (s) => s.reject },
    { header: "Pass %", value: (s) => pct(s.cleanShare) },
    { header: "Fixable %", value: (s) => pct(s.reworkShare) },
    { header: "Reject %", value: (s) => pct(s.rejectShare) },
    { header: "Fixable + reject %", value: (s) => pct(s.problemShare) },
    { header: "Top defect", value: (s) => s.topDefect ?? "" },
    { header: "High", value: (s) => (s.high ? "yes" : "") },
  ]);
}

/** The rolls with the most rejects, as shown on the report (D-008: per roll, never per person). */
export async function supplierRollsCsv(range: ReportRange) {
  const rolls = await rollsWithMostRejects(range, ROLLS_CSV);
  return toCsv(rolls, [
    { header: "Roll", value: (r) => r.rollCode },
    { header: "Batch", value: (r) => r.batchCode },
    { header: "Supplier", value: (r) => r.supplier },
    { header: "Sections", value: (r) => r.sections },
    { header: "Rejected", value: (r) => r.rejected },
    {
      header: "Defects",
      value: (r) => r.defects.map((d) => `${d.label} ${d.sections}`).join(" · "),
    },
  ]);
}

export async function stockCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.stock.all, [
    { header: "SKU", value: (i) => i.sku },
    { header: "Item", value: (i) => i.item },
    { header: "Category", value: (i) => i.category },
    { header: "Unit", value: (i) => i.unit },
    { header: "On hand", value: (i) => i.onHand },
    { header: "Reorder level", value: (i) => i.reorderLevel },
    { header: "Used in period", value: (i) => i.used },
    { header: "Received in period", value: (i) => i.received },
    { header: "Days of cover", value: (i) => (i.coverDays === null ? "" : i.coverDays.toFixed(1)) },
    { header: "Status", value: (i) => i.level },
    { header: "Open request", value: (i) => (i.requested ? "yes" : "") },
  ]);
}

// ───────────── claim sheet ─────────────

export type ClaimSheet = NonNullable<Awaited<ReturnType<typeof claimSheet>>>;

/**
 * Everything a supplier claim for one roll needs: the roll, its supplier, the counts and each
 * rejected section with its photo and defects (Phase 20). Per roll, never per person: no one who
 * captured or decided a section is named (D-008). Null when the batch doesn't exist.
 */
export async function claimSheet(batchId: string) {
  const [batch, verdicts] = await Promise.all([
    findClaimBatch(batchId),
    countBatchVerdicts(batchId),
  ]);
  if (!batch) return null;
  const count = (v: string | null) => verdicts.find((g) => g.finalVerdict === v)?._count._all ?? 0;
  const sections = verdicts.reduce((sum, g) => sum + g._count._all, 0);
  return {
    batchId: batch.id,
    batchCode: batch.code,
    rollCode: batch.rollCode,
    receivedAt: batch.receivedAt.toISOString().slice(0, 10),
    shoeType: batch.shoeType.name,
    supplier: batch.supplier,
    totals: {
      sections,
      pass: count("PASS"),
      rework: count("REWORK"),
      reject: count("REJECT"),
      pending: count(null),
    },
    rejected: batch.scans.map((scan) => ({
      scanId: scan.id,
      sequence: scan.sequence,
      capturedAt: scan.capturedAt.toISOString(),
      hasImage: !!scan.imagePath,
      decidedByPerson: scan.isOverride,
      defects: scan.detections.map((d) => ({
        label: d.defectType?.label ?? d.rawClassKey,
        confidence: d.confidence,
      })),
    })),
  };
}
