import {
  ATTENTION,
  buildAttention,
  compare,
  daysOfCover,
  paretoShares,
  stockLevel,
  supplierIsHigh,
} from "@/lib/ops-rules";
import { previousRange, toCsv, type ReportRange } from "@/lib/report-rules";
import { belowQuotaAttention, ATTENTION_DAYS } from "@/lib/production-rules";
import { countOpenRolls } from "@/server/models/roll.model";
import {
  countRollVerdicts,
  findClaimRoll,
  rollsWithMostRejects,
  stockPosition,
  supplierDefects,
  supplierQuality,
} from "@/server/models/ops-report.model";
import { productionReport, recentProductionDays } from "./production.service";
import { qualityReport, rollFlow } from "./report.service";

// Operations report (D-033): what is happening on the floor, in resources, flow, stock and supply.
// Aggregates per day, batch, roll, item or supplier. Nothing here carries a user id, name or
// email (D-008); tests/unit/ops-report.service.test.ts checks that.

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);
/** Rolls listed under Supplier quality, and in its CSV. */
const ROLLS_SHOWN = 5;
const ROLLS_CSV = 100;

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
    stockRows,
    supplierRows,
    supplierDefectRows,
    rejectedRolls,
  ] = await Promise.all([
    productionReport(range, now),
    productionReport(prev, now),
    rollFlow(range),
    rollFlow(prev),
    countOpenRolls(),
    recentProductionDays(ATTENTION_DAYS, now),
    qualityReport(range),
    qualityReport(prev),
    stockPosition(range),
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

  // Supply: how each supplier's leather performed on the camera, worst first (Phase 20). A
  // rejected section is reported "for salvage" (A-11).
  const lineRejectShare = share(quality.totals.reject, quality.totals.scanned);
  const suppliers = supplierRows
    .map((r) => {
      const decided = r.pass + r.reject;
      const rejectShare = share(r.reject, decided);
      // Rows come most common first, so the first one for this supplier is its top defect.
      const top = supplierDefectRows.find((d) => d.groupId === r.id);
      return {
        id: r.id,
        supplier: r.name,
        rolls: r.rolls,
        sections: r.scanned,
        decided,
        pass: r.pass,
        reject: r.reject,
        passShare: share(r.pass, decided),
        rejectShare,
        topDefect: top?.label ?? null,
        high: supplierIsHigh({ sections: r.scanned, rejectShare }, lineRejectShare),
      };
    })
    .sort((a, b) => (b.rejectShare ?? -1) - (a.rejectShare ?? -1) || b.sections - a.sections);

  const qt = quality.totals;
  const pt = prevQuality.totals;
  const fpy = (t: typeof qt) => share(t.pass, t.scanned);

  const kpis = {
    pairs: compare(production.totals.finished, prevProduction.totals.finished),
    failedPairs: compare(production.totals.failed, prevProduction.totals.failed),
    ofQuota: compare(production.totals.share, prevProduction.totals.share),
    rollsFinished: compare(rolls.totals.completed, prevRolls.totals.completed),
    rollsOpen: rollsNow,
    firstPassYield: compare(fpy(qt), fpy(pt)),
    rejectRate: compare(share(qt.reject, qt.scanned), share(pt.reject, pt.scanned)),
    sectionsScanned: compare(qt.scanned, pt.scanned),
  };

  const attention = buildAttention({
    belowQuota: belowQuotaAttention(
      recent.days.map((d) => ({ day: d.day, pairs: d.passed, quota: d.quota })),
    ),
    stock: {
      out: stock.out,
      low: stock.low,
      shortCover: shortCover.map((i) => ({ item: i.item, days: i.coverDays ?? 0 })),
    },
    suppliers: suppliers.map((s) => ({
      supplier: s.supplier,
      sections: s.sections,
      rejectShare: s.rejectShare,
    })),
    lineRejectShare,
  });

  // One row per day: rolls started and finished, and the camera's checkpoint.
  const productionByDay = new Map(rolls.days.map((d) => [d.day, d]));
  const days = quality.days.map((d) => ({
    day: d.day,
    started: productionByDay.get(d.day)?.started ?? 0,
    completed: productionByDay.get(d.day)?.completed ?? 0,
    scanned: d.scanned,
    pass: d.pass,
    reject: d.reject,
  }));

  return {
    range: { from: range.from, to: range.to, days: range.days },
    previous: { from: prev.from, to: prev.to },
    asOf: now.toISOString(),
    kpis,
    attention,
    /** Per day the pairs finished, failed and passed against the quota (Phase 27). */
    production,
    days,
    stock,
    suppliers,
    rejectedRolls,
    lineRejectShare,
    /**
     * Rejected sections, reported "for salvage" (A-11): the period's total, and by defect type
     * (the main defect of each section). Per day is in `days`, per roll in `rejectedRolls`, per
     * supplier in `suppliers`. It moves no leather (C-20).
     */
    forSalvage: {
      total: qt.reject,
      byDefect: quality.defects
        .filter((d) => d.reject > 0)
        .map((d) => ({ key: d.key, label: d.label, sections: d.reject }))
        .sort((a, b) => b.sections - a.sections || a.label.localeCompare(b.label)),
    },
    /** The checkpoint before cutting, kept as a short summary; the full view is Quality. */
    checkpoint: {
      totals: { ...qt, firstPassYield: fpy(qt) },
      defects: paretoShares(quality.defects).slice(0, 5),
    },
  };
}

export type OperationsReport = Awaited<ReturnType<typeof operationsReport>>;

// ───────────── CSV ─────────────

const pct = (v: number | null) => (v === null ? "" : (Math.round(v * 1000) / 10).toFixed(1));

/** One row per Manila day: rolls and the checkpoint. */
export async function operationsCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Rolls started", value: (d) => d.started },
    { header: "Rolls finished", value: (d) => d.completed },
    { header: "Sections scanned", value: (d) => d.scanned },
    { header: "Pass", value: (d) => d.pass },
    { header: "Reject (for salvage)", value: (d) => d.reject },
  ]);
}

export async function suppliersCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.suppliers, [
    { header: "Supplier", value: (s) => s.supplier },
    { header: "Rolls", value: (s) => s.rolls },
    { header: "Sections scanned", value: (s) => s.sections },
    { header: "Pass", value: (s) => s.pass },
    { header: "Reject (for salvage)", value: (s) => s.reject },
    { header: "Pass %", value: (s) => pct(s.passShare) },
    { header: "Reject %", value: (s) => pct(s.rejectShare) },
    { header: "Top defect", value: (s) => s.topDefect ?? "" },
    { header: "High", value: (s) => (s.high ? "yes" : "") },
  ]);
}

/** The rolls with the most rejects, as shown on the report (D-008: per roll, never per person). */
export async function supplierRollsCsv(range: ReportRange) {
  const rolls = await rollsWithMostRejects(range, ROLLS_CSV);
  return toCsv(rolls, [
    { header: "Roll", value: (r) => r.rollCode },
    { header: "Tag number", value: (r) => r.tagCode ?? "" },
    { header: "Supplier", value: (r) => r.supplier },
    { header: "Sections", value: (r) => r.sections },
    { header: "Rejected (for salvage)", value: (r) => r.rejected },
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
    { header: "Added in period", value: (i) => i.received },
    { header: "Days of cover", value: (i) => (i.coverDays === null ? "" : i.coverDays.toFixed(1)) },
    { header: "Status", value: (i) => i.level },
  ]);
}

// ───────────── claim sheet ─────────────

export type ClaimSheet = NonNullable<Awaited<ReturnType<typeof claimSheet>>>;

/**
 * Everything a supplier claim for one roll needs: the roll, its supplier, the counts and each
 * rejected section with its photo and defects (Phase 20). Per roll, never per person: no one who
 * captured a section is named (D-008). Null when the roll doesn't exist.
 */
export async function claimSheet(rollId: string) {
  const [roll, verdicts] = await Promise.all([findClaimRoll(rollId), countRollVerdicts(rollId)]);
  if (!roll) return null;
  const count = (v: string) => verdicts.find((g) => g.finalVerdict === v)?._count._all ?? 0;
  const sections = verdicts.reduce((sum, g) => sum + g._count._all, 0);
  return {
    rollId: roll.id,
    rollCode: roll.code,
    tagCode: roll.tagCode,
    receivedAt: roll.receivedAt?.toISOString().slice(0, 10) ?? null,
    startedAt: (roll.startedAt ?? roll.createdAt).toISOString(),
    areaSqFt: roll.areaSqFt === null ? null : Number(roll.areaSqFt),
    supplier: roll.supplier,
    totals: {
      sections,
      pass: count("PASS"),
      reject: count("REJECT"),
    },
    rejected: roll.scans.map((scan) => ({
      scanId: scan.id,
      sequence: scan.sequence,
      capturedAt: scan.capturedAt.toISOString(),
      hasImage: !!scan.imagePath,
      defects: scan.detections.map((d) => ({
        label: d.defectType?.label ?? d.rawClassKey,
        confidence: d.confidence,
      })),
    })),
  };
}
