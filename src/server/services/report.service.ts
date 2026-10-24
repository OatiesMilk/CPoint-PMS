import { fillDays, parseRange, toCsv, type ReportRange } from "@/lib/report-rules";
import {
  dailyProduction,
  dailyScanStats,
  defectBreakdown,
  type DailyScanRow,
  type DefectRow,
} from "@/server/models/report.model";

// Reports (D-025): aggregates per Manila day, defect type or roll. Nothing here carries a
// user id, name or email (D-008); tests/unit/report.service.test.ts checks that. A section is
// Pass or Reject (D-093); a rejected section is reported "for salvage" (A-11).

export type DailyRow = DailyScanRow;

const emptyDay = (day: string): DailyRow => ({ day, scanned: 0, pass: 0, reject: 0 });

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((t, r) => t + Number(r[key] ?? 0), 0);
}

export async function qualityReport(range: ReportRange) {
  const [scanRows, defects] = await Promise.all([dailyScanStats(range), defectBreakdown(range)]);
  const days = fillDays(scanRows, range, emptyDay);
  const totals = {
    scanned: sum(days, "scanned"),
    pass: sum(days, "pass"),
    reject: sum(days, "reject"),
  };
  return {
    range: { from: range.from, to: range.to, days: range.days },
    totals,
    days,
    defects,
  };
}

export type QualityReport = Awaited<ReturnType<typeof qualityReport>>;

/** Rolls started and finished per Manila day (D-082), for the Operations daily summary. */
export async function rollFlow(range: ReportRange) {
  const production = await dailyProduction(range);
  const days = fillDays(production, range, (day) => ({ day, started: 0, completed: 0 }));
  return { days, totals: { started: sum(days, "started"), completed: sum(days, "completed") } };
}

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

// ───────────── CSV ─────────────

export async function dailyCsv(range: ReportRange) {
  const r = await qualityReport(range);
  return toCsv(r.days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Scanned", value: (d) => d.scanned },
    { header: "Pass", value: (d) => d.pass },
    { header: "Reject (for salvage)", value: (d) => d.reject },
  ]);
}

export async function defectsCsv(range: ReportRange) {
  const r = await qualityReport(range);
  return toCsv(r.defects, [
    { header: "Defect type", value: (d) => d.label },
    { header: "Class key", value: (d) => d.key },
    { header: "Known type", value: (d) => (d.known ? "yes" : "no") },
    { header: "Scans", value: (d) => d.scans },
    { header: "Pass", value: (d) => d.pass },
    { header: "Reject (for salvage)", value: (d) => d.reject },
  ]);
}
