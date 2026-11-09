import { appNow } from "@/lib/clock";
import { fillDays, parseRange, toCsv, type ReportRange } from "@/lib/report-rules";
import { getCvSettings } from "@/server/models/cv-settings.model";
import {
  dailyProduction,
  dailyRollStats,
  defectBreakdown,
  type DailyRollRow,
} from "@/server/models/report.model";

// Reports (D-025): aggregates per Manila day, defect type or roll. Nothing here carries a
// user id, name or email (D-008); tests/unit/report.service.test.ts checks that. Since D-117 the
// reports count whole leather rolls, each Scanning passed or Returned to supplier (D-116), on the
// day it was finished at Capture; each shot's Pass or Reject stays on the roll's own page.

export type DailyRow = DailyRollRow;

const emptyDay = (day: string): DailyRow => ({ day, rolls: 0, passed: 0, returned: 0 });

/** "A defect counts as found at" when it isn't set yet (the bootstrap default, D-053). */
const DEFAULT_FOUND_AT = 0.5;

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((t, r) => t + Number(r[key] ?? 0), 0);
}

/** The found-at threshold the defect counts use, as set now. */
export async function foundAt(): Promise<number> {
  return (await getCvSettings())?.foundAtOrAbove ?? DEFAULT_FOUND_AT;
}

export async function qualityReport(range: ReportRange) {
  const [rollRows, defects] = await Promise.all([
    dailyRollStats(range),
    foundAt().then((f) => defectBreakdown(range, f)),
  ]);
  const days = fillDays(rollRows, range, emptyDay);
  const totals = {
    rolls: sum(days, "rolls"),
    passed: sum(days, "passed"),
    returned: sum(days, "returned"),
  };
  return {
    range: { from: range.from, to: range.to, days: range.days },
    totals,
    days,
    defects,
  };
}

export type QualityReport = Awaited<ReturnType<typeof qualityReport>>;

/** Rolls started per Manila day (D-082), for the Operations daily summary. */
export async function rollFlow(range: ReportRange) {
  const production = await dailyProduction(range);
  const days = fillDays(production, range, (day) => ({ day, started: 0, completed: 0 }));
  return { days, totals: { started: sum(days, "started"), completed: sum(days, "completed") } };
}

// ───────────── home cards ─────────────

/** Today's rolls, passed or returned (the FM home's Rolls today). */
export async function todaySplit(now: Date = appNow()) {
  const report = await qualityReport(parseRange({ preset: "today" }, now));
  return report.totals;
}

/** Yesterday and today side by side (FM home "Daily summary"). */
export async function recentDays(now: Date = appNow()) {
  const report = await qualityReport(parseRange({ preset: "7d" }, now));
  const [yesterday, today] = report.days.slice(-2);
  return { yesterday, today };
}

// ───────────── CSV ─────────────

export async function dailyCsv(range: ReportRange) {
  const r = await qualityReport(range);
  return toCsv(r.days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Rolls scanned", value: (d) => d.rolls },
    { header: "Scanning passed", value: (d) => d.passed },
    { header: "Returned to supplier", value: (d) => d.returned },
  ]);
}

export async function defectsCsv(range: ReportRange) {
  const r = await qualityReport(range);
  return toCsv(r.defects, [
    { header: "Defect type", value: (d) => d.label },
    { header: "Class key", value: (d) => d.key },
    { header: "Rolls found on", value: (d) => d.rolls },
    { header: "Returned to supplier", value: (d) => d.returned },
  ]);
}
