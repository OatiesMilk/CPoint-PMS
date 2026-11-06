/**
 * The scanning timer of a roll (D-121): from the tap on Start scanning to the tap on Finish roll,
 * working time only. The day's lunch break doesn't count (Dylan, 2026-11-05), and a roll left open
 * overnight counts nothing from the factory's close to its opening the next day (A-49). Pure and
 * client-safe: Capture runs the same sum every second that the reports run once.
 */
import {
  breaksOf,
  FACTORY_CLOSES,
  FACTORY_OPENS,
  inForceOn,
  manilaDayOf,
  minutesOf,
  type BreakRule,
  type Effective,
  type LunchRule,
} from "./production-rules";
import { addDays, manilaDayStart } from "./report-rules";

const MINUTE = 60_000;

/** The lunch break in force on a Manila day, or null for none. */
export type LunchOn = (day: string) => BreakRule | null;

const at = (day: string, time: string) => manilaDayStart(day).getTime() + minutesOf(time) * MINUTE;

const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Working milliseconds from `start` to `end`, lunch (and nights) left out. */
export function scanningMs(start: Date, end: Date, lunchOn: LunchOn): number {
  const s = start.getTime();
  const e = end.getTime();
  if (!(e > s)) return 0;
  const first = manilaDayOf(start);
  const last = manilaDayOf(end);
  let total = 0;
  // A long-forgotten roll is capped at 31 days, so a loop can't run away.
  for (let day = first, n = 0; day <= last && n < 31; day = addDays(day, 1), n++) {
    const from = day === first ? s : Math.min(at(day, FACTORY_OPENS), e);
    const to = day === last ? e : Math.max(from, at(day, FACTORY_CLOSES));
    if (to <= from) continue;
    const lunch = lunchOn(day);
    const lunchMs = lunch ? overlap(from, to, at(day, lunch.startTime), at(day, lunch.endTime)) : 0;
    total += to - from - lunchMs;
  }
  return total;
}

/** True while `now` is inside its day's lunch break: Capture's timer reads "Paused for lunch". */
export function inLunch(now: Date, lunchOn: LunchOn): boolean {
  const day = manilaDayOf(now);
  const lunch = lunchOn(day);
  if (!lunch) return false;
  const t = now.getTime();
  return t >= at(day, lunch.startTime) && t < at(day, lunch.endTime);
}

/** "08:42", "1:02:03": minutes and seconds, hours once past an hour. */
export function formatScanningTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

/** Minutes with two decimals, for the CSV (the paper compares these with the stopwatch). */
export function scanningMinutes(ms: number): number {
  return Math.round((ms / MINUTE) * 100) / 100;
}

/** The average of the rolls that have a time, or null with none. */
export function averageMs(times: readonly (number | null)[]): number | null {
  const known = times.filter((t): t is number => t !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
}

/** A lunch lookup from a fixed list of days (sent to the browser for the roll's days). */
export function lunchFromMap(map: Readonly<Record<string, BreakRule | null>>): LunchOn {
  return (day) => map[day] ?? null;
}

/** The lunch in force each day from Settings → Lunch break's rows (latest from-date wins). */
export function lunchLookup(rows: readonly (LunchRule & Effective)[]): LunchOn {
  return (day) => breaksOf(inForceOn(rows, day))[0] ?? null;
}

/** The lunch of each day a roll's timer spans, to send to the browser with the roll. */
export function lunchDays(
  start: Date,
  end: Date,
  lunchOn: LunchOn,
): Record<string, BreakRule | null> {
  const out: Record<string, BreakRule | null> = {};
  const last = manilaDayOf(end);
  for (let day = manilaDayOf(start), n = 0; day <= last && n < 31; day = addDays(day, 1), n++)
    out[day] = lunchOn(day);
  return out;
}
