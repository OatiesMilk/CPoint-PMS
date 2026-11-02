import { addDays } from "./report-rules";
import { isoWeekday } from "./production-rules";

/**
 * Stock updates and what was used (Phase 29, D-102), pure and client-safe. The Floor Manager
 * records per item what was added (+), used (−) or corrected; only the Used entries count as
 * consumption. Weeks run Monday to Sunday by the Manila date. Totals are per item and per week,
 * never per person (D-008).
 */

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/** The days a stock reminder can fall on: Monday to Friday, the factory's working days (D-105). */
export const REMINDER_DAY_CHOICES = [1, 2, 3, 4, 5] as const;

/** Wednesday and Friday (C-32). */
export const DEFAULT_REMINDER_DAYS = [3, 5];

/** The weeks the Materials report shows, and the days the pace and "per 100 pairs" look back. */
export const TREND_WEEKS = 8;
export const PACE_DAYS = 28;

/** The Monday of the week a Manila calendar day falls in. */
export function weekStart(day: string): string {
  return addDays(day, 1 - isoWeekday(day));
}

/** The Mondays of the last `count` weeks, oldest first, ending with this week's. */
export function lastWeeks(today: string, count: number = TREND_WEEKS): string[] {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
}

/** A reminder day with no Update stock saved yet that day (C-32). */
export function stockUpdateDue(
  today: string,
  reminderDays: readonly number[],
  savedToday: boolean,
) {
  return !savedToday && reminderDays.includes(isoWeekday(today));
}

/** Days from today to the next reminder day after today (1 to 7); null with no reminder days. */
export function daysToNextReminder(today: string, reminderDays: readonly number[]): number | null {
  if (reminderDays.length === 0) return null;
  for (let n = 1; n <= 7; n++) if (reminderDays.includes(isoWeekday(addDays(today, n)))) return n;
  return null;
}

/** "Wednesday and Friday", "Monday, Wednesday and Friday", "no day". */
export function describeReminderDays(days: readonly number[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]);
  if (names.length === 0) return "no day";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** This week against last week: the difference and the change as a fraction (null from 0). */
export function weekChange(thisWeek: number, lastWeek: number) {
  const diff = Math.round((thisWeek - lastWeek) * 100) / 100;
  return { diff, change: lastWeek > 0 ? diff / lastWeek : null };
}

/** Used per 100 pairs finished (failed ones count as made). Null when no pairs were made. */
export function perHundredPairs(used: number, pairs: number): number | null {
  if (pairs <= 0) return null;
  return Math.round((used / pairs) * 100 * 100) / 100;
}

/** Days the stock lasts at the pace of the last `paceDays`; null when nothing was used. */
export function daysLeft(onHand: number, usedInPace: number, paceDays = PACE_DAYS): number | null {
  if (usedInPace <= 0 || paceDays <= 0) return null;
  return Math.max(0, onHand) / (usedInPace / paceDays);
}

/** "May run out before the next update": fewer days left than days to the next reminder day. */
export function mayRunOut(left: number | null, toNextReminder: number | null): boolean {
  return left !== null && toNextReminder !== null && left < toNextReminder;
}
