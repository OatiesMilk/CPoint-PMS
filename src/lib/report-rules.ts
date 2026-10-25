import { manilaToday } from "./format";

/**
 * Report rules (D-025), pure and client-safe. Every report is an aggregate per day, batch, defect
 * type or roll, never per person (D-008). Days are Manila calendar days (UTC+8, no DST).
 */

export const MAX_RANGE_DAYS = 92;
export const DEFAULT_RANGE_DAYS = 14;
export const PRESETS = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "14d", label: "14 days", days: 14 },
  { id: "30d", label: "30 days", days: 30 },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

const DAY_MS = 86_400_000;
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "2026-10-03" + n days, as a calendar date (no time zone involved). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The UTC instant a Manila calendar day starts. */
export function manilaDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+08:00`);
}

export type ReportRange = {
  from: string; // Manila day, inclusive
  to: string; // Manila day, inclusive
  days: number;
  preset: PresetId | null;
  /** UTC instants for queries: [start, end). */
  start: Date;
  end: Date;
};

/**
 * The report range from URL params. A preset wins; otherwise from/to (swapped if reversed),
 * never past today, clamped to MAX_RANGE_DAYS. Default: the last 14 days including today.
 */
export function parseRange(
  params: { preset?: unknown; from?: unknown; to?: unknown },
  now: Date = new Date(),
): ReportRange {
  const today = manilaToday(now);
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
  return {
    from,
    to,
    days: daysBetween(from, to),
    preset: matched && to === today ? matched.id : null,
    start: manilaDayStart(from),
    end: manilaDayStart(addDays(to, 1)),
  };
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

/** The range just before this one, of the same length, for "vs previous period" comparisons. */
export function previousRange(range: ReportRange, now: Date = new Date()): ReportRange {
  return parseRange({ from: addDays(range.from, -range.days), to: addDays(range.from, -1) }, now);
}
