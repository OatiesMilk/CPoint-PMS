import { STAGE_ORDER, type Stage } from "@/lib/domain";
import {
  ATTENTION,
  buildAttention,
  compare,
  daysOfCover,
  findStuckBatches,
  paretoShares,
  stageShares,
  stockLevel,
} from "@/lib/ops-rules";
import {
  agreementRate,
  parseRange,
  previousRange,
  toCsv,
  type ReportRange,
} from "@/lib/report-rules";
import { stageDurations } from "@/server/models/report.model";
import {
  leadTimes,
  openBatches,
  procurementFlow,
  repairQueue,
  repairTurnaround,
  stockPosition,
  supplierQuality,
} from "@/server/models/ops-report.model";
import { productionReport, qualityReport } from "./report.service";

// Operations report (D-033): what is happening on the floor, in resources, flow, stock, purchasing
// and supply. Aggregates per batch, stage, item, supplier or request. Nothing here carries a user
// id, name or email (D-008); tests/unit/ops-report.service.test.ts checks that.

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

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
  const baseline = parseRange({ preset: "30d" }, now);
  const [
    production,
    prevProduction,
    quality,
    prevQuality,
    lead,
    prevLead,
    open,
    baselineStages,
    repairs,
    stockRows,
    procurement,
    supplierRows,
  ] = await Promise.all([
    productionReport(range, now),
    productionReport(prev, now),
    qualityReport(range),
    qualityReport(prev),
    leadTimes(range),
    leadTimes(prev),
    openBatches(now),
    stageDurations(baseline),
    repairStation(range, now),
    stockPosition(range),
    procurementFlow(range, now),
    supplierQuality(range),
  ]);

  // Flow: where the batches are, and which have waited longer than that stage usually takes.
  const stuck = findStuckBatches(open, baselineStages);
  const stuckIds = new Set(stuck.map((b) => b.id));
  const shares = stageShares(production.stages);
  const lanes = STAGE_ORDER.map((stage: Stage) => {
    const s = production.stages.find((x) => x.stage === stage)!;
    return {
      ...s,
      shareOfLeadTime: shares.get(stage) ?? null,
      batches: open
        .filter((b) => b.stage === stage)
        .sort((a, b) => b.inStageMs - a.inStageMs)
        .map((b) => ({
          id: b.id,
          code: b.code,
          shoeType: b.shoeType,
          inStageMs: b.inStageMs,
          openRepairs: b.openRepairs,
          stuck: stuckIds.has(b.id),
        })),
    };
  });

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

  // Supply: how each supplier's leather performed on the camera.
  const suppliers = supplierRows.map((r) => {
    const decided = r.pass + r.rework + r.reject;
    return {
      id: r.id,
      supplier: r.name,
      batches: r.batches,
      sections: r.scanned,
      decided,
      pass: r.pass,
      rework: r.rework,
      reject: r.reject,
      cleanShare: share(r.pass, decided),
      problemShare: share(r.rework + r.reject, decided),
    };
  });
  const lineDecided = quality.totals.pass + quality.totals.rework + quality.totals.reject;
  const lineProblemShare = share(quality.totals.rework + quality.totals.reject, lineDecided);

  const qt = quality.totals;
  const pt = prevQuality.totals;
  const fpy = (t: typeof qt) => share(t.pass, t.pass + t.rework + t.reject);

  const kpis = {
    completed: compare(production.totals.completed, prevProduction.totals.completed),
    started: compare(production.totals.started, prevProduction.totals.started),
    leadTimeMedianMs: compare(lead.medianMs, prevLead.medianMs),
    firstPassYield: compare(fpy(qt), fpy(pt)),
    rejectRate: compare(
      share(qt.reject, lineDecided),
      share(pt.reject, pt.pass + pt.rework + pt.reject),
    ),
    sectionsScanned: compare(qt.scanned, pt.scanned),
    wip: open.length,
    repairsOpen: repairs.total,
  };

  const attention = buildAttention({
    stages: production.stages,
    bottleneck: production.bottleneck,
    stuck,
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
      urgentPending: procurement.urgentPending,
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

  // One row per day: the flow (started, finished), the camera's checkpoint and repairs done.
  const productionByDay = new Map(production.days.map((d) => [d.day, d]));
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
    flow: {
      lanes,
      bottleneck: production.bottleneck,
      stuck: stuck.length,
      leadTime: { medianMs: lead.medianMs, avgMs: lead.avgMs, batches: lead.batches },
    },
    days,
    repairs,
    stock,
    procurement,
    suppliers,
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

/** One row per Manila day: flow, checkpoint and repairs. */
export async function operationsCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Batches started", value: (d) => d.started },
    { header: "Batches completed", value: (d) => d.completed },
    { header: "Sections scanned", value: (d) => d.scanned },
    { header: "Pass", value: (d) => d.pass },
    { header: "Rework", value: (d) => d.rework },
    { header: "Reject", value: (d) => d.reject },
    { header: "Repairs done", value: (d) => d.repairsDone },
  ]);
}

export async function suppliersCsv(range: ReportRange) {
  const r = await operationsReport(range);
  return toCsv(r.suppliers, [
    { header: "Supplier", value: (s) => s.supplier },
    { header: "Batches", value: (s) => s.batches },
    { header: "Sections scanned", value: (s) => s.sections },
    { header: "Pass", value: (s) => s.pass },
    { header: "Rework", value: (s) => s.rework },
    { header: "Reject", value: (s) => s.reject },
    { header: "Pass %", value: (s) => pct(s.cleanShare) },
    { header: "Rework + reject %", value: (s) => pct(s.problemShare) },
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
