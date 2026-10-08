import { STAGE_LABELS, STAGE_ORDER, type Stage, type Verdict } from "@/lib/domain";
import {
  agreementRate,
  fillDays,
  parseRange,
  pickBottleneck,
  toCsv,
  type ReportRange,
} from "@/lib/report-rules";
import {
  dailyProduction,
  dailyRepairsDone,
  dailyScanStats,
  defectBreakdown,
  openStageWaits,
  stageDurations,
  verdictMatrix,
  type DailyScanRow,
  type DefectRow,
} from "@/server/models/report.model";

// Reports (D-025): aggregates per Manila day, defect type, stage or batch. Nothing here carries a
// user id, name or email (D-008); tests/unit/report.service.test.ts checks that.

export type DailyRow = DailyScanRow & { repairsDone: number; agreement: number | null };

const emptyDay = (day: string): DailyRow => ({
  day,
  scanned: 0,
  pass: 0,
  rework: 0,
  reject: 0,
  pending: 0,
  overridden: 0,
  aiDecided: 0,
  agreed: 0,
  personResolved: 0,
  repairsDone: 0,
  agreement: null,
});

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((t, r) => t + Number(r[key] ?? 0), 0);
}

const MATRIX_AI: Verdict[] = ["PASS", "REWORK", "REJECT", "NEEDS_REVIEW"];
const MATRIX_FINAL = ["PASS", "REWORK", "REJECT", "PENDING"] as const;

export async function qualityReport(range: ReportRange) {
  const [scanRows, repairRows, defects, matrixRows] = await Promise.all([
    dailyScanStats(range),
    dailyRepairsDone(range),
    defectBreakdown(range),
    verdictMatrix(range),
  ]);
  const repairs = new Map(repairRows.map((r) => [r.day, r.done]));
  const days = fillDays(
    scanRows.map((r) => ({ ...r, repairsDone: 0, agreement: agreementRate(r) })),
    range,
    emptyDay,
  ).map((d) => ({ ...d, repairsDone: repairs.get(d.day) ?? 0 }));

  const totals = {
    scanned: sum(days, "scanned"),
    pass: sum(days, "pass"),
    rework: sum(days, "rework"),
    reject: sum(days, "reject"),
    pending: sum(days, "pending"),
    overridden: sum(days, "overridden"),
    aiDecided: sum(days, "aiDecided"),
    agreed: sum(days, "agreed"),
    personResolved: sum(days, "personResolved"),
    repairsDone: sum(days, "repairsDone"),
  };

  const matrix = MATRIX_AI.map((ai) => ({
    ai,
    counts: Object.fromEntries(
      MATRIX_FINAL.map((f) => [
        f,
        matrixRows
          .filter((m) => m.ai === ai && (m.final ?? "PENDING") === f)
          .reduce((t, m) => t + m.count, 0),
      ]),
    ) as Record<(typeof MATRIX_FINAL)[number], number>,
  }));

  return {
    range: { from: range.from, to: range.to, days: range.days },
    totals: { ...totals, agreement: agreementRate(totals) },
    days,
    defects,
    matrix,
  };
}

export type QualityReport = Awaited<ReturnType<typeof qualityReport>>;

export async function productionReport(range: ReportRange, now: Date = new Date()) {
  const [durations, waits, production] = await Promise.all([
    stageDurations(range),
    openStageWaits(now),
    dailyProduction(range),
  ]);
  const stages = STAGE_ORDER.map((stage: Stage) => {
    const d = durations.find((x) => x.stage === stage);
    const w = waits.find((x) => x.stage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      visits: d?.visits ?? 0,
      medianMs: d?.medianMs ?? null,
      p90Ms: d?.p90Ms ?? null,
      avgMs: d?.avgMs ?? null,
      inStageNow: w?.batches ?? 0,
      longestWaitMs: w?.longestMs ?? null,
    };
  });
  const days = fillDays(production, range, (day) => ({ day, started: 0, completed: 0 }));
  return {
    range: { from: range.from, to: range.to, days: range.days },
    stages,
    bottleneck: pickBottleneck(stages),
    days,
    totals: { started: sum(days, "started"), completed: sum(days, "completed") },
  };
}

export type ProductionReport = Awaited<ReturnType<typeof productionReport>>;

// ───────────── home cards ─────────────

/** Today's verdict split (FM home). */
export async function todaySplit(now: Date = new Date()) {
  const report = await qualityReport(parseRange({ preset: "today" }, now));
  return report.totals;
}

/** Yesterday and today side by side (FM home "Daily summary"). */
export async function recentDays(now: Date = new Date()) {
  const report = await qualityReport(parseRange({ preset: "7d" }, now));
  const [yesterday, today] = report.days.slice(-2);
  return { yesterday, today };
}

/** Today's defects by type (QI home). */
export async function defectsToday(now: Date = new Date()): Promise<DefectRow[]> {
  return defectBreakdown(parseRange({ preset: "today" }, now));
}

/** Agreement today and over the last 7 days (QI home). */
export async function agreementSummary(now: Date = new Date()) {
  const [today, week] = await Promise.all([
    qualityReport(parseRange({ preset: "today" }, now)),
    qualityReport(parseRange({ preset: "7d" }, now)),
  ]);
  const pick = (r: QualityReport) => ({
    rate: r.totals.agreement,
    agreed: r.totals.agreed,
    aiDecided: r.totals.aiDecided,
  });
  return { today: pick(today), week: pick(week) };
}

// ───────────── CSV ─────────────

const pct = (v: number | null) => (v === null ? "" : (Math.round(v * 1000) / 10).toFixed(1));
const hours = (ms: number | null) => (ms === null ? "" : (ms / 3_600_000).toFixed(2));

export async function dailyCsv(range: ReportRange) {
  const r = await qualityReport(range);
  return toCsv(r.days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Scanned", value: (d) => d.scanned },
    { header: "Pass", value: (d) => d.pass },
    { header: "Rework", value: (d) => d.rework },
    { header: "Reject", value: (d) => d.reject },
    { header: "Pending review", value: (d) => d.pending },
    { header: "Overridden", value: (d) => d.overridden },
    { header: "AI agreement %", value: (d) => pct(d.agreement) },
    { header: "Resolved by a person (unknown class)", value: (d) => d.personResolved },
    { header: "Repairs done", value: (d) => d.repairsDone },
  ]);
}

export async function defectsCsv(range: ReportRange) {
  const r = await qualityReport(range);
  return toCsv(r.defects, [
    { header: "Defect type", value: (d) => d.label },
    { header: "Class key", value: (d) => d.key },
    { header: "Known type", value: (d) => (d.known ? "yes" : "no") },
    { header: "Scans", value: (d) => d.scans },
    { header: "Final Pass", value: (d) => d.pass },
    { header: "Final Rework", value: (d) => d.rework },
    { header: "Final Reject", value: (d) => d.reject },
    { header: "Pending review", value: (d) => d.pending },
  ]);
}

export async function stagesCsv(range: ReportRange) {
  const r = await productionReport(range);
  return toCsv(r.stages, [
    { header: "Stage", value: (s) => s.label },
    { header: "Visits completed", value: (s) => s.visits },
    { header: "Median hours", value: (s) => hours(s.medianMs) },
    { header: "Average hours", value: (s) => hours(s.avgMs) },
    { header: "Batches in stage now", value: (s) => s.inStageNow },
    { header: "Longest current wait (hours)", value: (s) => hours(s.longestWaitMs) },
    { header: "Bottleneck", value: (s) => (s.stage === r.bottleneck ? "yes" : "") },
  ]);
}
