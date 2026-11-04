import { addDays } from "./report-rules";

/**
 * Weeks of a month for Reports → Materials (Dylan, 2026-11-02, D-109), pure and client-safe.
 * A month's weeks are consecutive seven-day ranges from its 1st: Week 1 is days 1 to 7, Week 2
 * days 8 to 14, and so on; the last week ends on the month's last day and may be shorter (29 to
 * 31, or 29 alone in a leap February). Days are Manila calendar days as "YYYY-MM-DD" strings, so
 * nothing shifts across UTC.
 */

export type MonthWeek = {
  year: number;
  month: number; // 1 to 12
  week: number; // 1 to 5
  from: string; // first day, YYYY-MM-DD
  to: string; // last day, inclusive
  /** "Week 1 · Nov 1–7" */
  label: string;
};

export type WeekSelection = { year: number; month: number; week: number };

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** Days in a month (leap years included). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "Nov 1–7", or "Feb 29" for a one-day week. */
export function dayRangeLabel(month: number, fromDay: number, toDay: number): string {
  const m = SHORT[month - 1];
  return fromDay === toDay ? `${m} ${fromDay}` : `${m} ${fromDay}–${toDay}`;
}

/** Every week of a month, Week 1 first. */
export function weeksOfMonth(year: number, month: number): MonthWeek[] {
  const last = daysInMonth(year, month);
  const weeks: MonthWeek[] = [];
  for (let start = 1, week = 1; start <= last; start += 7, week += 1) {
    const end = Math.min(start + 6, last);
    weeks.push({
      year,
      month,
      week,
      from: isoDay(year, month, start),
      to: isoDay(year, month, end),
      label: `Week ${week} · ${dayRangeLabel(month, start, end)}`,
    });
  }
  return weeks;
}

/** The week a Manila day falls in. */
export function monthWeekOf(day: string): MonthWeek {
  const [year, month, d] = day.split("-").map(Number);
  return weeksOfMonth(year, month)[Math.ceil(d / 7) - 1];
}

/** The week before, crossing into the previous month (and year) from Week 1. */
export function previousMonthWeek(w: MonthWeek): MonthWeek {
  if (w.week > 1) return weeksOfMonth(w.year, w.month)[w.week - 2];
  const year = w.month === 1 ? w.year - 1 : w.year;
  const month = w.month === 1 ? 12 : w.month - 1;
  return weeksOfMonth(year, month).at(-1)!;
}

/** `count` weeks ending with `w`, oldest first. */
export function weeksEndingWith(w: MonthWeek, count: number): MonthWeek[] {
  const out = [w];
  while (out.length < count) out.unshift(previousMonthWeek(out[0]));
  return out;
}

/** Whether a week has started by `today` (a later week has no data yet and can't be chosen). */
export const isAvailable = (w: MonthWeek, today: string) => w.from <= today;

/**
 * The week to show after the month or year changes: the same week number when that month has it
 * and it has started, otherwise the month's last week that has started. Null when nothing in that
 * month has started yet (a future month).
 */
export function keepWeek(year: number, month: number, week: number, today: string) {
  const open = weeksOfMonth(year, month).filter((w) => isAvailable(w, today));
  if (open.length === 0) return null;
  return open.find((w) => w.week === week) ?? open.at(-1)!;
}

const int = (v: unknown) => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && /^\d{1,4}$/.test(s) ? Number(s) : NaN;
};

/**
 * The week the page shows, from `?year=&month=&week=`. Default: the week today falls in. A week
 * number the month doesn't have becomes its last week; a month or week that hasn't started, or a
 * value that isn't a number, falls back to today's week. Never returns an invalid week.
 */
export function resolveWeek(
  params: { year?: unknown; month?: unknown; week?: unknown },
  today: string,
): MonthWeek {
  const current = monthWeekOf(today);
  const year = int(params.year);
  const month = int(params.month);
  const week = int(params.week);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) return current;
  if (!Number.isInteger(month) || month < 1 || month > 12) return current;
  const wanted = Number.isInteger(week) && week >= 1 ? week : 1;
  return keepWeek(year, month, wanted, today) ?? current;
}

/** "Nov 1–7, 2026" */
export function weekRangeText(w: MonthWeek): string {
  const from = Number(w.from.slice(8));
  const to = Number(w.to.slice(8));
  return `${dayRangeLabel(w.month, from, to)}, ${w.year}`;
}

/** The number of days in a week (7, or fewer for a month's last week). */
export const daysIn = (w: MonthWeek) =>
  Math.round((Date.parse(`${w.to}T00:00:00Z`) - Date.parse(`${w.from}T00:00:00Z`)) / 86_400_000) +
  1;

/** Sums values by day into the weeks they fall in (days outside every week are left out). */
export function sumByWeek(
  weeks: readonly MonthWeek[],
  rows: readonly { day: string; value: number }[],
): number[] {
  return weeks.map((w) =>
    rows.reduce((t, r) => (r.day >= w.from && r.day <= w.to ? t + r.value : t), 0),
  );
}

/** The day after a week, the exclusive end of its range. */
export const dayAfter = (w: MonthWeek) => addDays(w.to, 1);

/**
 * The working days in a week (D-118): Monday to Friday (D-105), less the days the Floor Manager
 * marked Non-working / Holiday (D-114). Lets a short week explain itself on Materials.
 */
export function workingDaysIn(w: MonthWeek, nonWorking: ReadonlySet<string>): number {
  let count = 0;
  for (let day = w.from; day <= w.to; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !nonWorking.has(day)) count += 1;
  }
  return count;
}

/** "1 working day", "5 working days". */
export const workingDaysLabel = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;
