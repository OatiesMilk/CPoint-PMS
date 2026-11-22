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

/**
 * The check-in interval a new day plan can have (D-115): every 4 hours of working time, or `null`,
 * once at the end of the day (C-2). Days planned before Phase 30E-2 may hold 60 to 180.
 */
export const INTERVAL_MINUTES = [240] as const;
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

/** Monday to Friday (D-105): the only days the calendar lets the Floor Manager plan (D-114). */
export const WEEKDAYS = [
  { iso: 1, short: "Mon", label: "Monday" },
  { iso: 2, short: "Tue", label: "Tuesday" },
  { iso: 3, short: "Wed", label: "Wednesday" },
  { iso: 4, short: "Thu", label: "Thursday" },
  { iso: 5, short: "Fri", label: "Friday" },
] as const;

/** The factory works Monday to Friday, 08:00 to 17:00 (D-105); a shift stays inside this window. */
export const FACTORY_OPENS = "08:00";
export const FACTORY_CLOSES = "17:00";
/** The days that can be planned: Monday to Friday (D-105, D-114). */
export const FACTORY_DAYS = [1, 2, 3, 4, 5] as const;

/** What a new day plan starts from (D-105, D-114): 08:00 to 17:00, every 4 hours. */
export const DEFAULT_SCHEDULE = {
  shiftStart: FACTORY_OPENS,
  shiftEnd: FACTORY_CLOSES,
  intervalMinutes: 240,
  workingDays: [1, 2, 3, 4, 5],
} as const;

/** ASSUMPTION (A-4, Dylan 2026-10-24): the default lunch is 11:00 to 12:00, the visit's example. */
export const DEFAULT_LUNCH = { startTime: "11:00", endTime: "12:00" } as const;

export type ScheduleRule = {
  shiftStart: string;
  shiftEnd: string;
  /** Working minutes per batch; null = once at the end of the day. */
  intervalMinutes: number | null;
  /** When given, a day outside these ISO weekdays has no batches. A day plan leaves it out. */
  workingDays?: readonly number[];
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

/**
 * A batch's code (Phase 33, D-129, A-57): "B-261116-2" is the second batch of 16 Nov 2026. The
 * number never changes once a batch is queued, so the code can be worked out anywhere.
 */
export function batchCode(day: string, number: number): string {
  return `B-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-${number}`;
}

/** True for a batch code such as B-261116-2 (any case). */
export function isBatchCode(value: string): boolean {
  return /^B-\d{6}-\d{1,2}$/i.test(value.trim());
}

export type Batch = {
  /** 1, 2, 3 … */
  number: number;
  /** "B-261116-2" (Phase 33) */
  code: string;
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
  /** "B-261116-2 · 10:00–13:00, lunch 11:00–12:00" */
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
  if (!schedule || (schedule.workingDays && !schedule.workingDays.includes(isoWeekday(day))))
    return [];
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
    const code = batchCode(day, i + 1);
    return {
      number: i + 1,
      code,
      start: new Date(dayStart + s * MINUTE),
      at: new Date(dayStart + e * MINUTE),
      startTime,
      time,
      lunch,
      workingMinutes: e - s - paused,
      label: `${code} · ${batchTimes({ startTime, time, lunch })}`,
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
 * Can a batch be finished now? From 10 minutes before its end (C-28). Since Phase 33 (D-129) it no
 * longer closes at midnight: it waits in the Inspection queue until it is inspected or voided.
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
      reason: `${batchCode(day, batch.number)} can be finished from ${clockTime(opens)}${
        day === manilaDayOf(now) ? "" : ` on ${formatAttendanceDay(day)}`
      }.`,
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
  /** "B-261116-2" (Phase 33) */
  code: string;
  slotAt: string;
  message: string;
};

// ───────────── the Inspection queue (Phase 33, D-129) ─────────────

export type QueueState =
  "UPCOMING" | "IN_PROGRESS" | "WAITING" | "LATE" | "INSPECTING" | "INSPECTED" | "VOID";

export const QUEUE_STATE_LABELS: Record<QueueState, string> = {
  UPCOMING: "Upcoming",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  LATE: "Late",
  INSPECTING: "Being inspected",
  INSPECTED: "Inspected",
  VOID: "Void",
};

export type StoredBatchStatus = "OPEN" | "INSPECTING" | "INSPECTED" | "VOID";
export type BatchPriority = "NORMAL" | "URGENT";

/**
 * Where a queued batch stands. Only what people did is stored (open, being inspected, inspected,
 * void); the rest comes from the clock, so the demo clock moves it too (D-125): Upcoming before its
 * start, In progress until its end, Waiting from its end, Late 30 minutes after (D-084). It never
 * becomes Missed at midnight.
 */
export function queueState(
  batch: { status: StoredBatchStatus; startAt: Date; slotAt: Date },
  now: Date,
): QueueState {
  if (batch.status === "INSPECTED") return "INSPECTED";
  if (batch.status === "VOID") return "VOID";
  if (batch.status === "INSPECTING") return "INSPECTING";
  const t = now.getTime();
  if (t < batch.startAt.getTime()) return "UPCOMING";
  if (t < batch.slotAt.getTime()) return "IN_PROGRESS";
  if (t > batch.slotAt.getTime() + LATE_AFTER_MINUTES * MINUTE) return "LATE";
  return "WAITING";
}

/** In the queue: waiting (or late) for inspection, or being inspected. */
export function isQueued(state: QueueState): boolean {
  return state === "WAITING" || state === "LATE" || state === "INSPECTING";
}

/** The queue's order (A-58): Urgent first, then the batch that has waited longest, then its number. */
export function compareQueue(
  a: { priority: BatchPriority; slotAt: Date; number: number },
  b: { priority: BatchPriority; slotAt: Date; number: number },
): number {
  const urgent = (x: { priority: BatchPriority }) => (x.priority === "URGENT" ? 0 : 1);
  return urgent(a) - urgent(b) || a.slotAt.getTime() - b.slotAt.getTime() || a.number - b.number;
}

/** "Waiting 3 hours 10 minutes" from the batch's end. */
export function waitingFor(slotAt: Date, now: Date): string {
  return `Waiting ${describeMinutes(now.getTime() - slotAt.getTime())}`;
}

/** Why a never-inspected batch from before Phase 33 is Void (A-61). */
export const BEFORE_QUEUE_REASON = "Not inspected, from before the queue";

/**
 * What went into a batch: the rolls whose scan finished at Capture inside it (A-83), by leather.
 * "6 rolls (Full-grain black ×4, Suede brown ×2)", "1 roll (Suede brown)", "No rolls scanned".
 */
export function batchRollsLine(rolls: readonly { item: string | null }[]): string {
  if (rolls.length === 0) return "No rolls scanned";
  const counts = new Map<string, number>();
  for (const r of rolls) {
    const name = r.item ?? "Leather";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const parts = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) =>
      counts.size === 1 && n === rolls.length && n === 1 ? name : `${name} ×${n}`,
    );
  return `${rolls.length} roll${rolls.length === 1 ? "" : "s"} (${parts.join(", ")})`;
}

export type ExistingBatchRow = {
  id: string;
  number: number;
  slotAt: Date;
  status: StoredBatchStatus;
  priority: BatchPriority;
  /** A finish (check-in) is linked to it. */
  inspected: boolean;
};

export type BatchSync = {
  /** New rows for slots that have none. */
  insert: { number: number; code: string; startAt: Date; slotAt: Date; void: boolean }[];
  /** Open, normal rows whose slot is gone from the plan. */
  remove: string[];
  /** Rows a person acted on whose slot would move or vanish: the plan can't change. */
  blocked: { code: string; reason: string }[];
};

/**
 * Lines a day's stored batch rows up with the batches its plan gives now (Phase 33). Rows nobody
 * acted on are remade freely; a row that is being inspected, inspected, void or Urgent keeps its
 * slot and number, so its code never changes (A-36 already stops plan changes after the first
 * finish). Slots that ended before the queue began and were never inspected are made Void (A-61).
 */
export function syncBatches(
  day: string,
  batches: readonly Pick<Batch, "number" | "start" | "at">[],
  existing: readonly ExistingBatchRow[],
  queueStart: Date | null,
): BatchSync {
  const bySlot = new Map(batches.map((b) => [b.at.getTime(), b]));
  const rowBySlot = new Map(existing.map((r) => [r.slotAt.getTime(), r]));
  const actedOn = (r: ExistingBatchRow) =>
    r.inspected || r.status !== "OPEN" || r.priority === "URGENT";
  const remove: string[] = [];
  const blocked: BatchSync["blocked"] = [];
  for (const r of existing) {
    const b = bySlot.get(r.slotAt.getTime());
    if (b && b.number === r.number) continue;
    if (actedOn(r)) {
      blocked.push({
        code: batchCode(day, r.number),
        reason:
          r.status === "INSPECTING"
            ? "is being inspected"
            : r.inspected || r.status === "INSPECTED"
              ? "is already inspected"
              : r.status === "VOID"
                ? "was voided"
                : "is marked Urgent",
      });
    } else remove.push(r.id);
  }
  const insert: BatchSync["insert"] = [];
  for (const b of batches) {
    const row = rowBySlot.get(b.at.getTime());
    if (row && row.number === b.number) continue;
    insert.push({
      number: b.number,
      code: batchCode(day, b.number),
      startAt: b.start,
      slotAt: b.at,
      void: queueStart !== null && b.at.getTime() < queueStart.getTime(),
    });
  }
  return { insert, remove, blocked };
}

/**
 * The on-screen notices for today's batches, worked out in the browser from the clock (no
 * scheduler, push or sound, C-31): at 10 minutes before a batch's end "B-261116-2 ends at 13:00.
 * Get ready to count the finished pairs.", and at its end "B-261116-2 is due. Finish it now.", until
 * it is finished or the day is over (a batch is named by its code since Phase 33, D-129). `nextAt`
 * is when the next notice comes, for a timer.
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
        code: batchCode(manilaDayOf(b.at), b.number),
        slotAt,
        message: `${batchCode(manilaDayOf(b.at), b.number)} is due. Finish it now.`,
      });
    else if (t >= soon)
      current.push({
        kind: "SOON",
        number: b.number,
        code: batchCode(manilaDayOf(b.at), b.number),
        slotAt,
        message: `${batchCode(manilaDayOf(b.at), b.number)} ends at ${b.time}. Get ready to count the finished pairs.`,
      });
    for (const at of [soon, due]) if (at > t && (nextAt === null || at < nextAt)) nextAt = at;
  }
  return { current, nextAt: nextAt === null ? null : new Date(nextAt) };
}

// ───────────── progress against the quota ─────────────

export type QuotaProgress = {
  /** Pairs that passed inspection so far today (C-41), repaired pairs that passed included. */
  passed: number;
  /** Of these, pairs that passed after a repair today (Phase 34, A-64). */
  repairedPassed: number;
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
  repairedPassed = 0,
): QuotaProgress {
  // A repaired pair that passes counts on the day it passes; it was never counted as finished twice.
  const passed = Math.max(0, finished - failed) + repairedPassed;
  return {
    passed,
    repairedPassed,
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

// ───────────── the planning calendar (Phase 30E-2, D-114) ─────────────

/** Rolls to be used on one day: an estimate, at most this many (A-40). */
export const MAX_ROLLS_PLANNED = 200;
/** ASSUMPTION (A-40): a day can be planned up to the end of the third month after this one. */
export const PLAN_MONTHS_AHEAD = 3;

/** "2026-11" for a day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The month `n` months after `month` ("2026-11", 2 → "2027-01"). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The last calendar day of a month. */
export function lastDayOf(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

/** The last day the Floor Manager may plan (A-40). */
export function lastPlannableDay(today: string): string {
  return lastDayOf(addMonths(monthOf(today), PLAN_MONTHS_AHEAD));
}

/**
 * The month as calendar weeks, Monday to Sunday (D-114). Days of the next or previous month that
 * fill the first and last week are null.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const last = lastDayOf(month);
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array.from({ length: isoWeekday(first) - 1 }, () => null);
  for (let d = first; d <= last; d = addDays(d, 1)) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push([...week, ...Array.from({ length: 7 - week.length }, () => null)]);
  return weeks;
}

export function isWeekend(day: string): boolean {
  return isoWeekday(day) > 5;
}

/**
 * Why a day can't be planned or marked, or null (D-105, D-114, A-40): Saturdays and Sundays never,
 * past days never, and nothing after the last plannable day.
 */
export function planProblem(day: string, today: string): string | null {
  if (isWeekend(day))
    return "Saturdays and Sundays can't be planned. The factory works Monday to Friday.";
  if (day < today) return `${formatAttendanceDay(day)} has passed, so its plan can't change.`;
  const last = lastPlannableDay(today);
  if (day > last) return `Days can be planned up to ${formatAttendanceDay(last)}.`;
  return null;
}

/** "every 4 h", "once a day": the short interval on a calendar day. */
export function shortInterval(minutes: number | null): string {
  if (minutes === null) return "once a day";
  return minutes === 60 ? "every 1 h" : `every ${minutes / 60} h`;
}

/**
 * "5 rolls · 128 pairs · every 4 h" (a converted day has no rolls: "128 pairs · every 2 h").
 * Without the interval when the line already says it in full (Batches, 30F-3).
 */
export function describePlanShort(
  p: {
    rollsPlanned: number | null;
    quota: number | null;
    intervalMinutes: number | null;
  },
  { interval = true }: { interval?: boolean } = {},
): string {
  return [
    p.rollsPlanned === null ? null : `${p.rollsPlanned} roll${p.rollsPlanned === 1 ? "" : "s"}`,
    p.quota === null ? null : pairsWord(p.quota),
    interval ? shortInterval(p.intervalMinutes) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "3 of 5 rolls scanned", or "3 rolls scanned" when none were planned (a converted day), with
 * " · 1 returned" when some went over the defect limit (D-116, D-118).
 */
export function rollsScannedLine(scanned: number, planned: number | null, returned = 0): string {
  const line =
    planned === null
      ? `${scanned} roll${scanned === 1 ? "" : "s"} scanned`
      : `${scanned} of ${planned} roll${planned === 1 ? "" : "s"} scanned`;
  return returned > 0 ? `${line} · ${returned} returned` : line;
}

/** Capture shows today and the planned days after it, five days in all (Phase 30D, D-118). */
export const CAPTURE_PLAN_DAYS = 5;

export type CapturePlanDay = {
  day: string;
  isToday: boolean;
  /** Today may be unplanned or Non-working; the days after it are planned days only. */
  kind: "PLANNED" | "NON_WORKING" | "NOT_PLANNED";
  /** Rolls to be used (D-114); null when not planned, or on a converted day. */
  planned: number | null;
  /** Rolls whose scan was finished at Capture that day (0 for the days ahead). */
  scanned: number;
};

/**
 * The days on Capture's counter (D-118): today whatever its plan, then the next planned days in
 * order (Non-working days and days not planned yet are skipped), at most `count` days in all.
 */
export function capturePlanDays(
  today: string,
  plans: { day: string; kind: "PLANNED" | "NON_WORKING"; rollsPlanned: number | null }[],
  scannedToday: number,
  count: number = CAPTURE_PLAN_DAYS,
): CapturePlanDay[] {
  const todays = plans.find((p) => p.day === today);
  const first: CapturePlanDay = {
    day: today,
    isToday: true,
    kind: todays?.kind ?? "NOT_PLANNED",
    planned: todays?.kind === "PLANNED" ? todays.rollsPlanned : null,
    scanned: scannedToday,
  };
  const ahead = plans
    .filter((p) => p.day > today && p.kind === "PLANNED")
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, Math.max(0, count - 1))
    .map((p): CapturePlanDay => ({
      day: p.day,
      isToday: false,
      kind: "PLANNED",
      planned: p.rollsPlanned,
      scanned: 0,
    }));
  return [first, ...ahead];
}

/** "Leather rolls scanned 3/15", or "Leather rolls scanned 3" with no rolls planned (D-118). */
export function leatherRollsLine(scanned: number, planned: number | null): string {
  return planned === null
    ? `Leather rolls scanned ${scanned}`
    : `Leather rolls scanned ${scanned}/${planned}`;
}
