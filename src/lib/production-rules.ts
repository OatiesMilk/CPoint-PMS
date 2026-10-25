import { formatAttendanceDay } from "./attendance-rules";
import { addDays, manilaDayStart } from "./report-rules";

/**
 * Batches (Phase 27, D-097 to D-099; before it production progression, D-082 to D-087), pure and
 * client-safe. A batch is one check-in interval of the working day: the Floor Manager sets how
 * often, the System Admin sets a lunch break that pauses it, and the Quality Inspector finishes it
 * with the pairs finished and the pairs that failed inspection. Output is counted per batch and per
 * day for the whole line, never per person (D-008). Days are Manila calendar days ("YYYY-MM-DD");
 * times are "HH:mm" in Manila (UTC+8, no DST).
 */

/** Every 1, 2, 3 or 4 hours of working time; `null` is once at the end of the day (C-2). */
export const INTERVAL_MINUTES = [60, 120, 180, 240] as const;
/** ASSUMPTION (D-084): a batch not finished more than 30 minutes after its end reads Late. */
export const LATE_AFTER_MINUTES = 30;
/** The QI may finish a batch from 10 minutes before its end, when the first notice comes (C-28). */
export const FINISH_OPENS_MINUTES = 10;
/** A sanity cap on the pairs in one batch, so a typo like 2400 is caught (A-6). */
export const MAX_PAIRS_PER_CHECK_IN = 2_000;
/** The quota suggestion averages this many full working days (D-085, D-099). */
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

/** The default the bootstrap creates (D-083): 08:00 to 17:00, every 4 hours, Mon–Sat. */
export const DEFAULT_SCHEDULE = {
  shiftStart: "08:00",
  shiftEnd: "17:00",
  intervalMinutes: 240,
  workingDays: [1, 2, 3, 4, 5, 6],
} as const;

/** ASSUMPTION (A-4, Dylan 2026-10-24): the default lunch is 11:00 to 12:00, the visit's example. */
export const DEFAULT_LUNCH = { startTime: "11:00", endTime: "12:00" } as const;

export type ScheduleRule = {
  shiftStart: string;
  shiftEnd: string;
  /** Working minutes per batch; null = once at the end of the day. */
  intervalMinutes: number | null;
  workingDays: readonly number[];
};

/** A break that pauses a batch. Lunch is the only one (C-40); the rules take a list (A-4). */
export type BreakRule = { startTime: string; endTime: string };

/** A lunch-break row: both times null means no lunch break. */
export type LunchRule = { startTime: string | null; endTime: string | null };

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

/** "every 4 hours", "every hour", "once at the end of the day". */
export function describeInterval(minutes: number | null): string {
  if (minutes === null) return "once at the end of the day";
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

/** The Manila calendar day an instant falls on. */
export function manilaDayOf(at: Date): string {
  return new Date(at.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** The breaks of a lunch row: none when it says "no lunch break". */
export function breaksOf(lunch: LunchRule | null): BreakRule[] {
  return lunch?.startTime && lunch.endTime
    ? [{ startTime: lunch.startTime, endTime: lunch.endTime }]
    : [];
}

/**
 * Why a lunch break doesn't fit, or null (C-3, A-4): it must end after it starts and sit inside
 * the shift, after the start and before the end.
 */
export function lunchProblem(
  lunch: BreakRule,
  shift: { shiftStart: string; shiftEnd: string } | null,
): { field: "startTime" | "endTime"; message: string } | null {
  const start = minutesOf(lunch.startTime);
  const end = minutesOf(lunch.endTime);
  if (end <= start) return { field: "endTime", message: "Lunch must end after it starts." };
  if (shift && (start <= minutesOf(shift.shiftStart) || end >= minutesOf(shift.shiftEnd)))
    return {
      field: "startTime",
      message: `Lunch must be inside the shift (${shift.shiftStart} to ${shift.shiftEnd}).`,
    };
  return null;
}

export type Batch = {
  /** 1, 2, 3 … */
  number: number;
  start: Date;
  /** The batch's end, which is when it is due (stored as the check-in's `slotAt`). */
  at: Date;
  /** "08:00" */
  startTime: string;
  /** "13:00" */
  time: string;
  /** The break inside the batch, if any. */
  lunch: BreakRule | null;
  /** Minutes of work, the breaks left out. */
  workingMinutes: number;
  /** "Batch 2 · 10:00–13:00, lunch 11:00–12:00" */
  label: string;
};

/** "10:00–13:00" or "10:00–13:00, lunch 11:00–12:00". */
export function batchTimes(b: { startTime: string; time: string; lunch: BreakRule | null }) {
  const times = `${b.startTime}–${b.time}`;
  return b.lunch ? `${times}, lunch ${b.lunch.startTime}–${b.lunch.endTime}` : times;
}

/**
 * A day's batches (C-2, C-26, A-2): each runs for the interval of working time, the breaks left
 * out. A batch whose working time runs out exactly when a break starts carries on and ends when the
 * break ends. The last batch ends at the shift end, even if shorter; once at the end of the day is
 * one batch. A break that isn't inside the shift is ignored. None on a day that isn't a working day.
 *
 * 08:00–17:00 with lunch 11:00–12:00: every 4 hours gives 08:00–13:00 and 13:00–17:00; every
 * 3 hours 08:00–12:00, 12:00–15:00 and 15:00–17:00.
 */
export function batchesFor(
  schedule: ScheduleRule | null,
  breaks: readonly BreakRule[],
  day: string,
): Batch[] {
  if (!schedule || !schedule.workingDays.includes(isoWeekday(day))) return [];
  const shiftStart = minutesOf(schedule.shiftStart);
  const shiftEnd = minutesOf(schedule.shiftEnd);
  if (shiftEnd <= shiftStart) return [];
  const interval = schedule.intervalMinutes;
  if (interval !== null && interval <= 0) return [];
  const inside = breaks
    .map((b) => ({ start: minutesOf(b.startTime), end: minutesOf(b.endTime), rule: b }))
    .filter((b) => b.end > b.start && b.start > shiftStart && b.end < shiftEnd)
    .sort((a, b) => a.start - b.start);

  const spans: [number, number][] = [];
  let cur = shiftStart;
  while (cur < shiftEnd) {
    let end: number;
    if (interval === null) end = shiftEnd;
    else {
      let t = cur;
      let left = interval;
      for (const b of inside) {
        if (b.end <= t) continue;
        if (b.start <= t) {
          t = b.end;
          continue;
        }
        const gap = b.start - t;
        if (left > gap) {
          left -= gap;
          t = b.end;
          continue;
        }
        t += left;
        left = 0;
        // Working time runs out exactly at the break's start: the batch ends after it (C-26).
        if (t === b.start) t = b.end;
        break;
      }
      end = Math.min(t + left, shiftEnd);
    }
    spans.push([cur, end]);
    cur = end;
  }

  const dayStart = manilaDayStart(day).getTime();
  return spans.map(([s, e], i) => {
    const within = inside.filter((b) => b.start >= s && b.end <= e);
    const lunch = within[0]?.rule ?? null;
    const startTime = timeOf(s);
    const time = timeOf(e);
    const paused = within.reduce((sum, b) => sum + (b.end - b.start), 0);
    return {
      number: i + 1,
      start: new Date(dayStart + s * MINUTE),
      at: new Date(dayStart + e * MINUTE),
      startTime,
      time,
      lunch,
      workingMinutes: e - s - paused,
      label: `Batch ${i + 1} · ${batchTimes({ startTime, time, lunch })}`,
    };
  });
}

export type BatchState = "UPCOMING" | "IN_PROGRESS" | "DUE" | "LATE" | "FINISHED" | "MISSED";

export const BATCH_STATE_LABELS: Record<BatchState, string> = {
  UPCOMING: "Upcoming",
  IN_PROGRESS: "In progress",
  DUE: "Due",
  LATE: "Late",
  FINISHED: "Finished",
  MISSED: "Missed",
};

/**
 * Where a batch stands (A-5), worked out from the clock and its record, never stored: Upcoming
 * before it starts, In progress until its end, Due at its end, Late 30 minutes after (D-084),
 * Missed once the Manila day is over with nothing saved, Finished once saved.
 */
export function batchState(
  batch: { start: Date; at: Date },
  record: { enteredAt: Date } | null,
  now: Date,
): BatchState {
  if (record) return "FINISHED";
  const t = now.getTime();
  if (t < batch.start.getTime()) return "UPCOMING";
  if (t >= manilaDayEnd(manilaDayOf(batch.at)).getTime()) return "MISSED";
  if (t < batch.at.getTime()) return "IN_PROGRESS";
  if (t > batch.at.getTime() + LATE_AFTER_MINUTES * MINUTE) return "LATE";
  return "DUE";
}

/** True while the clock is inside the batch's lunch break: it reads "Paused for lunch". */
export function pausedForLunch(batch: { at: Date; lunch: BreakRule | null }, now: Date): boolean {
  if (!batch.lunch) return false;
  const dayStart = manilaDayStart(manilaDayOf(batch.at)).getTime();
  const t = now.getTime();
  return (
    t >= dayStart + minutesOf(batch.lunch.startTime) * MINUTE &&
    t < dayStart + minutesOf(batch.lunch.endTime) * MINUTE
  );
}

/** When Finish batch opens: 10 minutes before the batch's end (C-28). */
export function finishOpensAt(batch: { at: Date }): Date {
  return new Date(batch.at.getTime() - FINISH_OPENS_MINUTES * MINUTE);
}

/** True when a saved batch was finished more than 30 minutes after its end. */
export function enteredLate(batch: { at: Date }, enteredAt: Date): boolean {
  return enteredAt.getTime() > batch.at.getTime() + LATE_AFTER_MINUTES * MINUTE;
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
 * Can a batch be finished now? From 10 minutes before its end (C-28) until the end of its Manila
 * day (D-084). The reason names the batch and what to do instead.
 */
export function finishWindow(
  batch: { number: number; at: Date },
  day: string,
  now: Date,
): { ok: true } | { ok: false; reason: string } {
  const opens = finishOpensAt(batch);
  if (now.getTime() < opens.getTime())
    return {
      ok: false,
      reason: `Batch ${batch.number} can be finished from ${clockTime(opens)}.`,
    };
  if (now.getTime() >= manilaDayEnd(day).getTime())
    return {
      ok: false,
      reason: `Batch ${batch.number} of ${formatAttendanceDay(day)} closed at midnight. Write the count in the notes of today's next batch instead.`,
    };
  return { ok: true };
}

/** "12:04", Manila. */
export function clockTime(at: Date): string {
  const day = manilaDayOf(at);
  return timeOf(Math.round((at.getTime() - manilaDayStart(day).getTime()) / MINUTE));
}

// ───────────── notices (A-9, C-6, C-31) ─────────────

export type Notice = {
  /** SOON from 10 minutes before the end, DUE from the end until the batch is finished. */
  kind: "SOON" | "DUE";
  number: number;
  slotAt: string;
  message: string;
};

/**
 * The on-screen notices for today's batches, worked out in the browser from the clock (no
 * scheduler, push or sound, C-31): at 10 minutes before a batch's end "Batch 2 ends at 13:00. Get
 * ready to count the finished pairs.", and at its end "Batch 2 is due. Finish it now.", until it is
 * finished or the day is over. `nextAt` is when the next notice comes, for a timer.
 */
export function noticesFor(
  batches: readonly { number: number; at: Date; time: string }[],
  finished: ReadonlySet<string>,
  now: Date,
): { current: Notice[]; nextAt: Date | null } {
  const t = now.getTime();
  const current: Notice[] = [];
  let nextAt: number | null = null;
  for (const b of batches) {
    const slotAt = b.at.toISOString();
    if (finished.has(slotAt)) continue;
    const dayEnd = manilaDayEnd(manilaDayOf(b.at)).getTime();
    const soon = finishOpensAt(b).getTime();
    const due = b.at.getTime();
    if (t >= dayEnd) continue;
    if (t >= due)
      current.push({
        kind: "DUE",
        number: b.number,
        slotAt,
        message: `Batch ${b.number} is due. Finish it now.`,
      });
    else if (t >= soon)
      current.push({
        kind: "SOON",
        number: b.number,
        slotAt,
        message: `Batch ${b.number} ends at ${b.time}. Get ready to count the finished pairs.`,
      });
    for (const at of [soon, due]) if (at > t && (nextAt === null || at < nextAt)) nextAt = at;
  }
  return { current, nextAt: nextAt === null ? null : new Date(nextAt) };
}

// ───────────── progress against the quota ─────────────

export type QuotaProgress = {
  /** Pairs that passed inspection so far today (C-41). */
  passed: number;
  finished: number;
  failed: number;
  quota: number | null;
  /** passed ÷ quota; null without a quota. */
  share: number | null;
  /** "38 pairs more over 2 batches to reach the quota." */
  pace: string;
};

export const pairsWord = (n: number) => `${n.toLocaleString("en-PH")} pair${n === 1 ? "" : "s"}`;

/** Passed pairs so far today against the one daily quota, with the pace still needed (C-30, C-41). */
export function quotaProgress(
  finished: number,
  failed: number,
  quota: number | null,
  batchesLeft: number,
): QuotaProgress {
  const passed = Math.max(0, finished - failed);
  return {
    passed,
    finished,
    failed,
    quota,
    share: quota ? passed / quota : null,
    pace: paceSentence(passed, quota, batchesLeft),
  };
}

export function paceSentence(passed: number, quota: number | null, batchesLeft: number): string {
  if (quota === null) return "No daily quota is set yet.";
  if (passed >= quota) return "Quota reached.";
  const more = quota - passed;
  if (batchesLeft <= 0) return `Below quota by ${pairsWord(more)}.`;
  return `${pairsWord(more)} more over ${batchesLeft} batch${batchesLeft === 1 ? "" : "es"} to reach the quota.`;
}

/** The share of finished pairs that failed inspection; null when none were finished. */
export function failedShare(finished: number, failed: number): number | null {
  return finished > 0 ? failed / finished : null;
}

/**
 * One sentence on why a day fell short, from the day's numbers only (D-086). Never a name.
 * `pairs` are the pairs that passed (C-41). Null when the day met its quota or had none.
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
  /** Every scheduled batch was finished. */
  full: boolean;
  /** Pairs that passed inspection that day (C-41). */
  passed: number;
  constructorsPresent: number | null;
};

export type Suggestion =
  | { pairs: number; days: number; sentence: string; perConstructor: string | null }
  | { pairs: null; reason: string };

/**
 * The daily quota to suggest (D-099, Dylan 2026-10-24): the average passed pairs per full working
 * day over the last 10 such days (a day with every batch finished), and beside it the line average
 * per constructor present × the constructors expected. Needs at least 3 full days. A day's total
 * doesn't depend on how often the QI checks in, so a schedule change doesn't move the suggestion.
 */
export function suggestQuota(
  history: readonly DayHistory[],
  expectedConstructors: number | null,
): Suggestion {
  const full = [...history]
    .filter((d) => d.full)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, SUGGESTION_DAYS);
  if (full.length < MIN_SUGGESTION_DAYS)
    return {
      pairs: null,
      reason: `A suggestion needs at least ${MIN_SUGGESTION_DAYS} working days with every batch finished. There ${full.length === 1 ? "is" : "are"} ${full.length} so far.`,
    };
  const average = full.reduce((s, d) => s + d.passed, 0) / full.length;
  const suggested = Math.max(1, Math.round(average));
  const rounded = Math.round(average * 10) / 10;
  const sentence = `Average ${rounded.toLocaleString("en-PH")} passed pairs a day over the last ${full.length} full working days = ${pairsWord(suggested)}.`;

  const withAttendance = full.filter((d) => d.constructorsPresent);
  let perConstructor: string | null = null;
  if (withAttendance.length > 0 && expectedConstructors) {
    const people = withAttendance.reduce((s, d) => s + (d.constructorsPresent ?? 0), 0);
    const each = withAttendance.reduce((s, d) => s + d.passed, 0) / people;
    const byPeople = Math.round(each * expectedConstructors);
    perConstructor = `Or ${Math.round(each * 10) / 10} passed pairs per Shoe Constructor present × ${expectedConstructors} expected = ${pairsWord(byPeople)}.`;
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
 * When a schedule, lunch or quota change takes effect (D-083, D-085): tomorrow, except the first
 * quota ever, which applies from today (Dylan 5A).
 */
export function effectiveFromFor(today: string, first = false): string {
  return first ? today : addDays(today, 1);
}
