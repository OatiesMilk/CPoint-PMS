import { formatAttendanceDay } from "./attendance-rules";
import { addDays, manilaDayStart } from "./report-rules";

/**
 * Production progression rules (Phase 23, D-082 to D-087), pure and client-safe. Output is counted
 * per check-in, per day and per shoe type for the whole line, never per person (D-008). Days are
 * Manila calendar days ("YYYY-MM-DD"); times are "HH:mm" in Manila (UTC+8, no DST).
 */

export const INTERVAL_MINUTES = [60, 120, 180, 240] as const;
/** ASSUMPTION (D-084): a check-in more than 30 minutes past its time reads Late. */
export const LATE_AFTER_MINUTES = 30;
/** A sanity cap per shoe type per check-in, so a typo like 2400 is caught. */
export const MAX_PAIRS_PER_CHECK_IN = 2_000;
/** The quota suggestion averages this many full working days (D-085, Dylan 4A). */
export const SUGGESTION_DAYS = 10;
/** Fewer full days than this and there is no suggestion. */
export const MIN_SUGGESTION_DAYS = 3;
/** Working days shown under Recent days. */
export const RECENT_DAYS = 14;
/** "3 of the last 5 working days were below quota" (the attention item). */
export const ATTENTION_DAYS = 5;

export const WEEKDAYS = [
  { iso: 1, short: "Mon", label: "Monday" },
  { iso: 2, short: "Tue", label: "Tuesday" },
  { iso: 3, short: "Wed", label: "Wednesday" },
  { iso: 4, short: "Thu", label: "Thursday" },
  { iso: 5, short: "Fri", label: "Friday" },
  { iso: 6, short: "Sat", label: "Saturday" },
  { iso: 7, short: "Sun", label: "Sunday" },
] as const;

/** The default the bootstrap creates (D-083, Dylan 2B): 08:00 to 17:00, every 4 hours, Mon–Sat. */
export const DEFAULT_SCHEDULE = {
  shiftStart: "08:00",
  shiftEnd: "17:00",
  intervalMinutes: 240,
  workingDays: [1, 2, 3, 4, 5, 6],
} as const;

export type ScheduleRule = {
  shiftStart: string;
  shiftEnd: string;
  intervalMinutes: number;
  workingDays: readonly number[];
};

export type Effective = { effectiveFrom: string };

const MINUTE = 60_000;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTime(value: string): boolean {
  return HHMM.test(value);
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timeOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** ISO weekday of a calendar day: 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
}

/** "every 4 hours", "every hour". */
export function describeInterval(minutes: number): string {
  return minutes === 60 ? "every hour" : `every ${minutes / 60} hours`;
}

/** The row in force on a day: the latest `effectiveFrom` on or before it. */
export function inForceOn<T extends Effective>(rows: readonly T[], day: string): T | null {
  let best: T | null = null;
  for (const row of rows)
    if (row.effectiveFrom <= day && (!best || row.effectiveFrom >= best.effectiveFrom)) best = row;
  return best;
}

/** The UTC instant a Manila day ends (the next day's start). */
export function manilaDayEnd(day: string): Date {
  return manilaDayStart(addDays(day, 1));
}

export type Slot = {
  /** The scheduled instant. */
  at: Date;
  /** "12:00" */
  time: string;
  /** The previous check-in's time, or the shift start: "School Shoes finished since 08:00". */
  since: string;
};

/**
 * A day's check-in times (D-083): every interval from the shift start, plus one at the shift end
 * when it isn't on the grid. 08:00–17:00 every 4 hours gives 12:00, 16:00 and 17:00. None on a
 * day that isn't a working day.
 */
export function slotsFor(schedule: ScheduleRule | null, day: string): Slot[] {
  if (!schedule || !schedule.workingDays.includes(isoWeekday(day))) return [];
  const start = minutesOf(schedule.shiftStart);
  const end = minutesOf(schedule.shiftEnd);
  if (end <= start || schedule.intervalMinutes <= 0) return [];
  const times: number[] = [];
  for (let m = start + schedule.intervalMinutes; m <= end; m += schedule.intervalMinutes)
    times.push(m);
  if (times.at(-1) !== end) times.push(end);
  const dayStart = manilaDayStart(day).getTime();
  return times.map((m, i) => ({
    at: new Date(dayStart + m * MINUTE),
    time: timeOf(m),
    since: timeOf(i === 0 ? start : times[i - 1]),
  }));
}

export type SlotState = "UPCOMING" | "DUE" | "LATE" | "ENTERED" | "MISSED";

export const SLOT_STATE_LABELS: Record<SlotState, string> = {
  UPCOMING: "Upcoming",
  DUE: "Due",
  LATE: "Late",
  ENTERED: "Entered",
  MISSED: "Missed",
};

/**
 * Where a check-in stands (D-084). Open from its time to the end of the Manila day; Late more than
 * 30 minutes after its time; Missed once the day is over with nothing entered.
 */
export function slotState(
  slot: { at: Date },
  checkIn: { enteredAt: Date } | null,
  now: Date,
): SlotState {
  if (checkIn) return "ENTERED";
  const t = now.getTime();
  if (t < slot.at.getTime()) return "UPCOMING";
  if (t >= manilaDayEnd(manilaDayOf(slot.at)).getTime()) return "MISSED";
  if (t > slot.at.getTime() + LATE_AFTER_MINUTES * MINUTE) return "LATE";
  return "DUE";
}

/** True when a saved check-in was entered more than 30 minutes after its time. */
export function enteredLate(slot: { at: Date }, enteredAt: Date): boolean {
  return enteredAt.getTime() > slot.at.getTime() + LATE_AFTER_MINUTES * MINUTE;
}

/** The Manila calendar day an instant falls on. */
export function manilaDayOf(at: Date): string {
  return new Date(at.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** "40 minutes", "1 hour 5 minutes". */
export function describeMinutes(ms: number): string {
  const total = Math.max(1, Math.round(ms / MINUTE));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts = [
    h > 0 ? `${h} hour${h === 1 ? "" : "s"}` : "",
    m > 0 ? `${m} minute${m === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * Can a check-in be entered now? From its time until the end of its Manila day (D-084). The
 * reason names the check-in and what to do instead.
 */
export function checkInWindow(
  slot: { at: Date; time: string },
  day: string,
  now: Date,
): { ok: true } | { ok: false; reason: string } {
  if (now.getTime() < slot.at.getTime())
    return {
      ok: false,
      reason: `The ${slot.time} check-in isn't open yet. You can enter it from ${slot.time}.`,
    };
  if (now.getTime() >= manilaDayEnd(day).getTime())
    return {
      ok: false,
      reason: `The check-in for ${formatAttendanceDay(day)} closed at midnight. Write the count in the notes of today's next check-in instead.`,
    };
  return { ok: true };
}

// ───────────── progress against the quota ─────────────

export type CountLike = { shoeTypeId: string; pairs: number };

export type TypeProgress = {
  shoeTypeId: string;
  name: string;
  pairs: number;
  quota: number | null;
  /** pairs ÷ quota; null without a quota. */
  share: number | null;
  /** "38 pairs more over 2 check-ins to reach the quota." */
  pace: string;
};

const pairsWord = (n: number) => `${n.toLocaleString("en-PH")} pair${n === 1 ? "" : "s"}`;

/** Pairs per shoe type so far today, against the quota, with the pace still needed. */
export function dayProgress(
  shoeTypes: readonly { id: string; name: string }[],
  counts: readonly CountLike[],
  quotas: ReadonlyMap<string, number>,
  checkInsLeft: number,
): TypeProgress[] {
  return shoeTypes.map((t) => {
    const pairs = counts.filter((c) => c.shoeTypeId === t.id).reduce((s, c) => s + c.pairs, 0);
    const quota = quotas.get(t.id) ?? null;
    return {
      shoeTypeId: t.id,
      name: t.name,
      pairs,
      quota,
      share: quota ? pairs / quota : null,
      pace: paceSentence(t.name, pairs, quota, checkInsLeft),
    };
  });
}

export function paceSentence(
  name: string,
  pairs: number,
  quota: number | null,
  checkInsLeft: number,
): string {
  if (quota === null) return `No daily quota is set for ${name} yet.`;
  if (pairs >= quota) return "Quota reached.";
  const more = quota - pairs;
  if (checkInsLeft <= 0) return `Below quota by ${pairsWord(more)}.`;
  return `${pairsWord(more)} more over ${checkInsLeft} check-in${checkInsLeft === 1 ? "" : "s"} to reach the quota.`;
}

/**
 * One sentence on why a day fell short, from the day's numbers only (D-086). Never a name.
 * Null when the day met its quota or had none.
 */
export function explainShortfall(d: {
  pairs: number;
  quota: number | null;
  constructorsPresent: number | null;
  constructorsOnRoster: number | null;
}): string | null {
  if (d.quota === null || d.pairs >= d.quota) return null;
  const below = `Below quota by ${pairsWord(d.quota - d.pairs)}`;
  if (d.constructorsPresent === null || d.constructorsOnRoster === null)
    return `${below}. Attendance wasn't taken that day.`;
  const absent = Math.max(0, d.constructorsOnRoster - d.constructorsPresent);
  if (absent === 0) return `${below} with everyone present.`;
  return `${below}. ${absent} of ${d.constructorsOnRoster} Shoe Constructors ${absent === 1 ? "was" : "were"} absent.`;
}

/** Total pairs per constructor present for a day, a line average (D-008). Null without one. */
export function pairsPerConstructor(pairs: number, constructorsPresent: number | null) {
  if (!constructorsPresent) return null;
  return Math.round((pairs / constructorsPresent) * 10) / 10;
}

// ───────────── the quota suggestion ─────────────

export type DayHistory = {
  day: string;
  /** Every scheduled check-in was entered. */
  full: boolean;
  /** Check-ins that day. */
  checkIns: number;
  pairs: number;
  constructorsPresent: number | null;
};

export type Suggestion =
  | { pairs: number; days: number; sentence: string; perConstructor: string | null }
  | { pairs: null; reason: string };

/**
 * The daily quota to suggest for one shoe type (D-085): the average pairs per check-in over the
 * last 10 full working days × today's check-ins, and beside it the line average per constructor
 * present × the constructors expected. Needs at least 3 full days.
 */
export function suggestQuota(
  history: readonly DayHistory[],
  checkInsPerDay: number,
  expectedConstructors: number | null,
): Suggestion {
  const full = [...history]
    .filter((d) => d.full && d.checkIns > 0)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, SUGGESTION_DAYS);
  if (full.length < MIN_SUGGESTION_DAYS)
    return {
      pairs: null,
      reason: `A suggestion needs at least ${MIN_SUGGESTION_DAYS} working days with every check-in entered. There ${full.length === 1 ? "is" : "are"} ${full.length} so far.`,
    };
  if (checkInsPerDay <= 0) return { pairs: null, reason: "The schedule has no check-ins a day." };
  const pairs = full.reduce((s, d) => s + d.pairs, 0);
  const checkIns = full.reduce((s, d) => s + d.checkIns, 0);
  const average = pairs / checkIns;
  const suggested = Math.max(1, Math.round(average * checkInsPerDay));
  const rounded = Math.round(average * 10) / 10;
  const sentence = `Average ${rounded} pairs per check-in over the last ${full.length} full working days × ${checkInsPerDay} check-ins a day = ${pairsWord(suggested)}.`;

  const withAttendance = full.filter((d) => d.constructorsPresent);
  let perConstructor: string | null = null;
  if (withAttendance.length > 0 && expectedConstructors) {
    const people = withAttendance.reduce((s, d) => s + (d.constructorsPresent ?? 0), 0);
    const each = withAttendance.reduce((s, d) => s + d.pairs, 0) / people;
    const byPeople = Math.round(each * expectedConstructors);
    perConstructor = `Or ${Math.round(each * 10) / 10} pairs per Shoe Constructor present × ${expectedConstructors} expected = ${pairsWord(byPeople)}.`;
  }
  return { pairs: suggested, days: full.length, sentence, perConstructor };
}

/** "3 of the last 5 working days were below quota", or null when fewer than 2 were. */
export function belowQuotaAttention(
  days: readonly { day: string; pairs: number; quota: number | null }[],
): { below: number; of: number } | null {
  const recent = [...days]
    .filter((d) => d.quota !== null)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, ATTENTION_DAYS);
  const below = recent.filter((d) => d.pairs < (d.quota ?? 0)).length;
  return below >= 2 ? { below, of: recent.length } : null;
}

/**
 * When a schedule or quota change takes effect (D-083, D-085): tomorrow, except the first quota
 * for a shoe type, which applies from today (Dylan 5A).
 */
export function effectiveFromFor(today: string, firstForType = false): string {
  return firstForType ? today : addDays(today, 1);
}
