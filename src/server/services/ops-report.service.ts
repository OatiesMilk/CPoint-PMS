import { appNow } from "@/lib/clock";
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
import type { RepairFilters } from "@/lib/repair-rules";
import { belowQuotaAttention, ATTENTION_DAYS } from "@/lib/production-rules";
import { countDefectsForRolls } from "@/server/models/roll.model";
import {
  countRollVerdicts,
  findClaimRoll,
  rollsWithMostDefects,
  stockPosition,
  supplierDefects,
  supplierRolls,
} from "@/server/models/ops-report.model";
import { productionReport, recentProductionDays } from "./production.service";
import { repairReport } from "./repair.service";
import { wipReport } from "./stage.service";
import { foundAt, qualityReport, rollFlow } from "./report.service";

// Operations report (D-033): what is happening on the floor, in resources, flow, stock and supply.
// Aggregates per day, batch, roll, item or supplier. Nothing here carries a user id, name or
// email (D-008); tests/unit/ops-report.service.test.ts checks that. Since D-117 the camera's side
// counts whole leather rolls, Scanning passed or Returned to supplier, never sections.

export type OpsFilters = RepairFilters & { supplierId?: string };

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);
/** Rolls with the most defects under Supplier quality, and in its CSV. */
const ROLLS_SHOWN = 5;
const ROLLS_CSV = 100;

// ───────────── operations ─────────────

/** The Operations report; its filters (Phase 35, A-101) narrow the defect cards and Supplier quality only. */
export async function operationsReport(
  range: ReportRange,
  now: Date = appNow(),
  filters: OpsFilters = {},
) {
  const prev = previousRange(range);
  const found = await foundAt();
  const [
    production,
    prevProduction,
    rolls,
    recent,
    quality,
    prevQuality,
    stockRows,
    supplierRows,
    supplierDefectRows,
    worstRolls,
    repairSections,
    wip,
  ] = await Promise.all([
    productionReport(range, now),
    productionReport(prev, now),
    rollFlow(range),
    recentProductionDays(ATTENTION_DAYS, now),
    qualityReport(range),
    qualityReport(prev),
    stockPosition(range),
    supplierRolls(range),
    supplierDefects(range, found),
    rollsWithMostDefects(range, ROLLS_SHOWN, filters.supplierId),
    repairReport(range, filters),
    wipReport(range),
  ]);
  const mostDefects = await withDefects(worstRolls, found);

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

  // Supply: how each supplier's rolls came out of the camera check, worst first (D-117).
  const qt = quality.totals;
  const pt = prevQuality.totals;
  const lineReturnedShare = share(qt.returned, qt.rolls);
  const suppliers = supplierRows
    .map((r) => {
      const returnedShare = share(r.returned, r.rolls);
      // Rows come most rolls first, so the first one for this supplier is its top defect.
      const top = supplierDefectRows.find((d) => d.groupId === r.id);
      return {
        id: r.id,
        supplier: r.name,
        rolls: r.rolls,
        passed: r.rolls - r.returned,
        returned: r.returned,
        returnedShare,
        topDefect: top?.label ?? null,
        high: supplierIsHigh({ rolls: r.rolls, returnedShare }, lineReturnedShare),
      };
    })
    .sort((a, b) => (b.returnedShare ?? -1) - (a.returnedShare ?? -1) || b.rolls - a.rolls);

  const kpis = {
    pairs: compare(production.totals.finished, prevProduction.totals.finished),
    failedPairs: compare(production.totals.failed, prevProduction.totals.failed),
    ofQuota: compare(production.totals.share, prevProduction.totals.share),
    rollsPassed: compare(share(qt.passed, qt.rolls), share(pt.passed, pt.rolls)),
    rollsReturned: compare(share(qt.returned, qt.rolls), share(pt.returned, pt.rolls)),
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
      rolls: s.rolls,
      returnedShare: s.returnedShare,
    })),
    lineReturnedShare,
  });

  // One row per day: rolls started, and the rolls scanned, passed or returned.
  const startedByDay = new Map(rolls.days.map((d) => [d.day, d.started]));
  const days = quality.days.map((d) => ({
    day: d.day,
    started: startedByDay.get(d.day) ?? 0,
    rolls: d.rolls,
    passed: d.passed,
    returned: d.returned,
  }));

  return {
    range: { from: range.from, to: range.to, days: range.days },
    previous: { from: prev.from, to: prev.to },
    asOf: now.toISOString(),
    kpis,
    attention,
    /** Per day the pairs finished, failed and passed against the quota (Phase 27). */
    production,
    /** Final defects, where they come from, repairs and work in progress (Phase 34, D-130). */
    finalDefects: repairSections.finalDefects,
    origins: repairSections.origins,
    repairs: repairSections.repairs,
    wip,
    days,
    stock,
    suppliers,
    /** The rolls finished in the range with the highest Defect % (D-117). */
    mostDefects,
    lineReturnedShare,
    /** The checkpoint before cutting, kept as a short summary; the full view is Quality. */
    checkpoint: {
      totals: qt,
      defects: paretoShares(quality.defects).slice(0, 5),
    },
  };
}

/** Each roll with the defects found on it ("Cut 4 · Hole 1": detections from found-at). */
async function withDefects<T extends { rollId: string }>(rows: T[], foundAtOrAbove: number) {
  const found = await countDefectsForRolls(
    rows.map((r) => r.rollId),
    foundAtOrAbove,
  );
  return rows.map((r) => ({
    ...r,
    defects: found
      .filter((d) => d.rollId === r.rollId)
      .map((d) => ({ label: d.label, detections: Number(d.detections) })),
  }));
}

export type OperationsReport = Awaited<ReturnType<typeof operationsReport>>;

// ───────────── CSV ─────────────

const pct = (v: number | null) => (v === null ? "" : (Math.round(v * 1000) / 10).toFixed(1));

/** One row per Manila day: rolls started, and the rolls scanned, passed or returned (D-117). */
export async function operationsCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Rolls started", value: (d) => d.started },
    { header: "Rolls scanned", value: (d) => d.rolls },
    { header: "Scanning passed", value: (d) => d.passed },
    { header: "Returned to supplier", value: (d) => d.returned },
  ]);
}

export async function suppliersCsv(range: ReportRange, supplierId?: string) {
  const r = await operationsReport(range);
  return toCsv(supplierId ? r.suppliers.filter((s) => s.id === supplierId) : r.suppliers, [
    { header: "Supplier", value: (s) => s.supplier },
    { header: "Rolls", value: (s) => s.rolls },
    { header: "Scanning passed", value: (s) => s.passed },
    { header: "Returned to supplier", value: (s) => s.returned },
    { header: "Returned %", value: (s) => pct(s.returnedShare) },
    { header: "Top defect", value: (s) => s.topDefect ?? "" },
    { header: "High", value: (s) => (s.high ? "yes" : "") },
  ]);
}

/** The rolls with the highest Defect %, as on the report (D-008: per roll, never per person). */
export async function supplierRollsCsv(range: ReportRange, supplierId?: string) {
  const rolls = await withDefects(
    await rollsWithMostDefects(range, ROLLS_CSV, supplierId),
    await foundAt(),
  );
  return toCsv(rolls, [
    { header: "Roll", value: (r) => r.rollCode },
    { header: "Tag number", value: (r) => r.tagCode ?? "" },
    { header: "Supplier", value: (r) => r.supplier },
    { header: "Defect %", value: (r) => r.defectSharePct.toFixed(1) },
    { header: "Status", value: (r) => (r.returned ? "Returned to supplier" : "Scanning passed") },
    {
      header: "Defects",
      value: (r) => r.defects.map((d) => `${d.label} ${d.detections}`).join(" · "),
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
        lengthIn: d.lengthIn,
      })),
    })),
  };
}
