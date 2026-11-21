import { appNow } from "./clock";
import { addDays, DAY_MS } from "./day-math";
import { formatDayLabel, formatManilaWeekdayDate, manilaToday } from "./format";
import {
  daysInMonth,
  MONTH_NAMES,
  monthWeekOf,
  previousMonthWeek,
  resolveWeek,
  weekRangeText,
} from "./month-weeks";

/**
 * Report rules (D-025), pure and client-safe. Every report is an aggregate per day, batch, defect
 * type or roll, never per person (D-008). Days are Manila calendar days (UTC+8, no DST).
 */

export { addDays };

/** A custom range may be up to a year (A-68). */
export const MAX_RANGE_DAYS = 366;
export const DEFAULT_RANGE_DAYS = 14;
export const PRESETS = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "14d", label: "14 days", days: 14 },
  { id: "30d", label: "30 days", days: 30 },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

/** How the period was picked (Phase 35): a quick link, a day, a week or month, or any two dates. */
export type RangeMode = "preset" | "day" | "week" | "month" | "custom";

/** The URL params a report's period owns, so a link or a CSV carries the same period. */
export const PERIOD_PARAMS = [
  "preset",
  "period",
  "day",
  "year",
  "month",
  "week",
  "from",
  "to",
  "days",
] as const;

/** A real calendar day: "2026-02-30" has the shape but is not one (it would throw below). */
const isDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
};
const pad = (n: number) => String(n).padStart(2, "0");

/** The UTC instant a Manila calendar day starts. */
export function manilaDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+08:00`);
}

export type ReportRange = {
  from: string; // Manila day, inclusive
  to: string; // Manila day, inclusive
  days: number;
  preset: PresetId | null;
  mode: RangeMode;
  /** The period in words: "Week 3 · Nov 15–21, 2026", "November 2026", "Sat, 21 Nov". */
  label: string;
  /** UTC instants for queries: [start, end). */
  start: Date;
  end: Date;
};

export type PeriodParams = {
  preset?: unknown;
  from?: unknown;
  to?: unknown;
  period?: unknown;
  day?: unknown;
  year?: unknown;
  month?: unknown;
  week?: unknown;
};

function build(
  from: string,
  to: string,
  mode: RangeMode,
  label: string,
  preset: PresetId | null = null,
): ReportRange {
  return {
    from,
    to,
    days: daysBetween(from, to),
    preset,
    mode,
    label,
    start: manilaDayStart(from),
    end: manilaDayStart(addDays(to, 1)),
  };
}

/** "Oct 3", "Oct 3 – Oct 16", with the years when the range crosses one. */
function spanLabel(from: string, to: string): string {
  if (from === to) return formatDayLabel(from);
  const years = from.slice(0, 4) !== to.slice(0, 4);
  const one = (d: string) => `${formatDayLabel(d)}${years ? `, ${d.slice(0, 4)}` : ""}`;
  return `${one(from)} – ${one(to)}`;
}

const intParam = (v: unknown) => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && /^\d{1,4}$/.test(s) ? Number(s) : NaN;
};

/**
 * The report range from URL params (Phase 35). `period=day&day=`, `period=week&year=&month=&week=`
 * (a week of the month, as Materials, D-109) or `period=month&year=&month=` pick a period; otherwise
 * a preset wins, then from/to (swapped if reversed). A day, week or month in the future ends at
 * today, and an invalid one falls back to today's. A custom range is clamped to MAX_RANGE_DAYS.
 * Default: the last 14 days including today.
 */
export function parseRange(params: PeriodParams, now: Date = appNow()): ReportRange {
  const today = manilaToday(now);
  const upToToday = (d: string) => (d < today ? d : today);
  if (params.period === "day") {
    const day = isDay(params.day) ? upToToday(params.day) : today;
    const year = day.slice(0, 4) === today.slice(0, 4) ? "" : ` ${day.slice(0, 4)}`;
    return build(day, day, "day", `${formatManilaWeekdayDate(manilaDayStart(day))}${year}`);
  }
  if (params.period === "week") {
    const w = resolveWeek(params, today);
    return build(w.from, upToToday(w.to), "week", `Week ${w.week} · ${weekRangeText(w)}`);
  }
  if (params.period === "month") {
    const [ty, tm] = today.split("-").map(Number);
    let year = intParam(params.year);
    let month = intParam(params.month);
    const valid =
      year >= 2000 && month >= 1 && month <= 12 && (year < ty || (year === ty && month <= tm));
    if (!valid) [year, month] = [ty, tm];
    return build(
      `${year}-${pad(month)}-01`,
      upToToday(`${year}-${pad(month)}-${pad(daysInMonth(year, month))}`),
      "month",
      `${MONTH_NAMES[month - 1]} ${year}`,
    );
  }
  const preset = PRESETS.find((p) => p.id === params.preset);
  let from: string;
  let to: string;
  if (preset) {
    to = today;
    from = addDays(today, -(preset.days - 1));
  } else if (isDay(params.from) || isDay(params.to)) {
    to = isDay(params.to) && params.to < today ? params.to : today;
    from = isDay(params.from) ? params.from : addDays(to, -(DEFAULT_RANGE_DAYS - 1));
    if (from > to) [from, to] = [to, from];
  } else {
    to = today;
    from = addDays(today, -(DEFAULT_RANGE_DAYS - 1));
  }
  if (daysBetween(from, to) > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1));
  const matched =
    preset ?? (params.from === undefined && params.to === undefined ? PRESETS[2] : undefined);
  const named = matched && to === today ? matched.id : null;
  return build(from, to, named ? "preset" : "custom", spanLabel(from, to), named);
}

/** Inclusive number of days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** One row per day in the range (oldest first), using `empty` for days with no data. */
export function fillDays<T extends { day: string }>(
  rows: T[],
  range: { from: string; to: string },
  empty: (day: string) => T,
): T[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: T[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(byDay.get(d) ?? empty(d));
  return out;
}

// ───────────── CSV ─────────────

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

const BOM = "﻿";

/** One CSV cell: quoted when needed, and safe from spreadsheet formula injection. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // A text cell starting with = + - @ (or a tab/CR) runs as a formula in Excel. Numbers are fine.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with CRLF line ends and a UTF-8 BOM, so Excel opens it with the right encoding. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

/**
 * The period just before this one, for "vs previous period" comparisons: the day before, the week
 * of the month before, the month before, otherwise the same number of days (Phase 35).
 */
export function previousRange(range: ReportRange): ReportRange {
  if (range.mode === "week") {
    const w = previousMonthWeek(monthWeekOf(range.from));
    return build(w.from, w.to, "week", `Week ${w.week} · ${weekRangeText(w)}`);
  }
  if (range.mode === "month") {
    const [y, m] = range.from.split("-").map(Number);
    const [year, month] = m === 1 ? [y - 1, 12] : [y, m - 1];
    const label = `${MONTH_NAMES[month - 1]} ${year}`;
    return build(
      `${year}-${pad(month)}-01`,
      `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
      "month",
      label,
    );
  }
  const from = addDays(range.from, -range.days);
  const to = addDays(range.from, -1);
  const label =
    range.mode === "day" ? formatManilaWeekdayDate(manilaDayStart(from)) : spanLabel(from, to);
  return build(from, to, range.mode, label);
}

/** The words after a change figure: "vs yesterday", "vs previous 7 days", "vs previous month". */
export function compareLabel(range: ReportRange): string {
  if (range.mode === "month") return "vs previous month";
  if (range.mode === "week") return "vs previous week";
  if (range.mode === "day") return "vs the day before";
  return range.days === 1 ? "vs yesterday" : `vs previous ${range.days} days`;
}
