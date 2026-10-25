/**
 * Batches (Phase 27, D-097 to D-099; before it production progression, Phase 23, D-082 to D-087).
 * A batch is one check-in interval of the working day: the Floor Manager sets how often and the
 * daily quota, the System Admin sets the lunch break that pauses a batch, and the Quality Inspector
 * finishes each batch with the pairs finished and the pairs that failed inspection. Internally a
 * finished batch is still a `ProductionCheckIn`.
 *
 * Everything returned is per batch or per day for the whole line (D-008). The only name on a batch
 * is who finished or corrected it, a log-book fact that is never totalled (D-086). Worker counts
 * come from attendance's `workforceFor` (D-080), never counted here.
 */
import type { Role } from "@/lib/domain";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { manilaToday } from "@/lib/format";
import {
  DEFAULT_LUNCH,
  DEFAULT_SCHEDULE,
  batchesFor,
  batchState,
  batchTimes,
  breaksOf,
  clockTime,
  describeInterval,
  describeMinutes,
  effectiveFromFor,
  enteredLate,
  explainShortfall,
  failedShare,
  finishOpensAt,
  finishWindow,
  inForceOn,
  lunchProblem,
  manilaDayOf,
  pairsPerConstructor,
  pausedForLunch,
  quotaProgress,
  suggestQuota,
  type Batch,
  type BatchState,
  type BreakRule,
  type DayHistory,
  type LunchRule,
  type ScheduleRule,
  type Suggestion,
} from "@/lib/production-rules";
import { addDays, toCsv, type ReportRange } from "@/lib/report-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  correctCheckIn as correctCheckInRow,
  countLunchBreaks,
  countSchedules,
  findCheckIn,
  findCheckInBySlot,
  firstCheckInDay,
  insertCheckIn,
  insertLunchBreak,
  insertQuota,
  insertSchedule,
  listCheckIns,
  listLunchBreaks,
  listQuotas,
  listSchedules,
  type CheckInRow,
} from "@/server/models/production.model";
import { checkInCoverReason, mayEnterCheckIns } from "@/server/policies/permissions";
import {
  parseBatchCounts,
  type CheckInInput,
  type CorrectionInput,
  type LunchBreakInput,
  type QuotaInput,
  type ScheduleInput,
} from "@/server/validators/production.validator";
import { qualityInspectorPresentOn, workforceByDay } from "./attendance.service";
import { recordAudit } from "./audit.service";

type Actor = { id: string; name?: string };
/** Who finishes a batch: the role decides whether they may (D-088). */
type CheckInActor = Actor & { role: Role };
type Tx = Parameters<Parameters<typeof runInTransaction>[0]>[0];

const dayString = (d: Date) => d.toISOString().slice(0, 10);

/** "12:04", Manila. */
export const clockOf = clockTime;

function daysFrom(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function scheduleRule(row: ScheduleRule | null): ScheduleRule | null {
  return row
    ? {
        shiftStart: row.shiftStart,
        shiftEnd: row.shiftEnd,
        intervalMinutes: row.intervalMinutes,
        workingDays: row.workingDays,
      }
    : null;
}

type Plans = {
  schedules: Awaited<ReturnType<typeof listSchedules>>;
  lunches: Awaited<ReturnType<typeof listLunchBreaks>>;
};

function lunchOn(lunches: Plans["lunches"], day: string): LunchRule | null {
  const row = inForceOn(lunches, day);
  return row ? { startTime: row.startTime, endTime: row.endTime } : null;
}

/** A day's batches from the schedule and the lunch break in force that day. */
function batchesOn(plans: Plans, day: string): Batch[] {
  return batchesFor(
    scheduleRule(inForceOn(plans.schedules, day)),
    breaksOf(lunchOn(plans.lunches, day)),
    day,
  );
}

const WEEKDAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function describeDays(workingDays: readonly number[]): string {
  const days = [...workingDays].sort((a, b) => a - b);
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (days.length === 7) return "every day";
  if (consecutive && days.length > 2)
    return `${WEEKDAY_NAMES[days[0]]} to ${WEEKDAY_NAMES[days.at(-1)!]}`;
  return days.map((d) => WEEKDAY_NAMES[d]).join(", ");
}

/** "Batch 1 08:00–13:00, lunch 11:00–12:00; Batch 2 13:00–17:00" for a sample working day. */
export function describeBatches(rule: ScheduleRule, breaks: readonly BreakRule[]): string {
  const sample = batchesFor({ ...rule, workingDays: [1, 2, 3, 4, 5, 6, 7] }, breaks, "2026-01-05");
  return sample.map((b) => `Batch ${b.number} ${batchTimes(b)}`).join("; ");
}

/** "08:00 to 17:00, every 4 hours, Mon to Sat". */
export function describeSchedule(rule: ScheduleRule): string {
  return `${rule.shiftStart} to ${rule.shiftEnd}, ${describeInterval(rule.intervalMinutes)}, ${describeDays(rule.workingDays)}`;
}

/** "11:00 to 12:00" or "No lunch break". */
export function describeLunch(lunch: LunchRule | null): string {
  return lunch?.startTime && lunch.endTime
    ? `${lunch.startTime} to ${lunch.endTime}`
    : "No lunch break";
}

/** Earliest day the bootstrap defaults cover, so they are in force from the first day of use. */
export const DEFAULT_SCHEDULE_FROM = "2000-01-01";

/**
 * The bootstrap default (D-083): 08:00 to 17:00, every 4 hours, Monday to Saturday. Only when no
 * schedule exists; the Floor Manager changes it under Batches → Plan.
 */
export async function ensureDefaultSchedule(db: Tx) {
  if ((await countSchedules(db)) > 0) return false;
  const row = await insertSchedule(
    {
      ...DEFAULT_SCHEDULE,
      workingDays: [...DEFAULT_SCHEDULE.workingDays],
      effectiveFrom: DEFAULT_SCHEDULE_FROM,
      createdById: null,
    },
    db,
  );
  await recordAudit(db, {
    actor: { type: "SYSTEM" },
    action: "production.schedule.default",
    entity: "ProductionSchedule",
    entityId: row.id,
    after: { ...DEFAULT_SCHEDULE, effectiveFrom: DEFAULT_SCHEDULE_FROM },
  });
  return true;
}

/**
 * The bootstrap's default lunch, 11:00 to 12:00 (A-4), only when no lunch row exists. On a database
 * with no finished batches it is in force from the start; otherwise from tomorrow, so past days keep
 * the batch times they were counted at and still match their rows.
 */
export async function ensureDefaultLunchBreak(db: Tx, now: Date = new Date()) {
  if ((await countLunchBreaks(db)) > 0) return false;
  const effectiveFrom = (await firstCheckInDay(db))
    ? addDays(manilaToday(now), 1)
    : DEFAULT_SCHEDULE_FROM;
  const row = await insertLunchBreak({ ...DEFAULT_LUNCH, effectiveFrom, createdById: null }, db);
  await recordAudit(db, {
    actor: { type: "SYSTEM" },
    action: "production.lunch.default",
    entity: "LunchBreak",
    entityId: row.id,
    after: { ...DEFAULT_LUNCH, effectiveFrom },
  });
  return true;
}

// ───────────── day rows (Recent days, Reports, the CSV, the suggestion) ─────────────

export type DayRow = {
  day: string;
  /** Scheduled batches that day. */
  batches: number;
  finishedBatches: number;
  missed: number;
  /** Every scheduled batch was finished. */
  full: boolean;
  /** Pairs finished, the pairs of them that failed inspection, and the pairs that passed (C-27). */
  finished: number;
  failed: number;
  passed: number;
  /** failed ÷ finished; null when nothing was finished. */
  failedShare: number | null;
  quota: number | null;
  /** passed ÷ quota (C-41). */
  share: number | null;
  attendanceTaken: boolean;
  constructorsPresent: number | null;
  constructorsOnRoster: number;
  /** Line average for the day (D-008): pairs finished ÷ constructors present. */
  pairsPerConstructor: number | null;
  shortfall: string | null;
};

type Loaded = Plans & {
  quotas: Awaited<ReturnType<typeof listQuotas>>;
  checkIns: CheckInRow[];
};

async function load(from: string, to: string): Promise<Loaded> {
  const [schedules, lunches, quotas, checkIns] = await Promise.all([
    listSchedules(),
    listLunchBreaks(),
    listQuotas(),
    listCheckIns(from, to),
  ]);
  return { schedules, lunches, quotas, checkIns };
}

const quotaOn = (quotas: Loaded["quotas"], day: string) => inForceOn(quotas, day)?.pairs ?? null;

/**
 * One row per working day from `from` to `to` (a day with batches scheduled or finished), oldest
 * first, from the first day a batch was ever finished.
 */
export async function productionDays(
  from: string,
  to: string,
  now: Date = new Date(),
): Promise<{ days: DayRow[] }> {
  const [data, first] = await Promise.all([load(from, to), firstCheckInDay()]);
  // Days before the first batch ever finished weren't counted yet, so they aren't "missed".
  const days = first ? daysFrom(from > first ? from : first, to) : [];
  const workforce = await workforceByDay(days);

  const rows: DayRow[] = [];
  for (const day of days) {
    const batches = batchesOn(data, day);
    const dayCheckIns = data.checkIns.filter((c) => dayString(c.day) === day);
    if (batches.length === 0 && dayCheckIns.length === 0) continue;
    const recordFor = (b: Batch) =>
      dayCheckIns.find((c) => c.slotAt.getTime() === b.at.getTime()) ?? null;
    const finishedBatches = batches.filter((b) => recordFor(b)).length;
    const missed = batches.filter((b) => batchState(b, recordFor(b), now) === "MISSED").length;
    const finished = dayCheckIns.reduce((s, c) => s + c.pairs, 0);
    const failed = dayCheckIns.reduce((s, c) => s + c.failedPairs, 0);
    const passed = Math.max(0, finished - failed);
    const quota = quotaOn(data.quotas, day);
    const wf = workforce.get(day)!;
    rows.push({
      day,
      batches: batches.length,
      finishedBatches,
      missed,
      full: batches.length > 0 && finishedBatches === batches.length,
      finished,
      failed,
      passed,
      failedShare: failedShare(finished, failed),
      quota,
      share: quota ? passed / quota : null,
      attendanceTaken: wf.taken,
      constructorsPresent: wf.constructorsPresent,
      constructorsOnRoster: wf.constructorsOnRoster,
      pairsPerConstructor: pairsPerConstructor(finished, wf.constructorsPresent),
      // Only a finished day can be "below quota"; today is still being counted.
      shortfall:
        day < manilaToday(now)
          ? explainShortfall({
              pairs: passed,
              quota,
              constructorsPresent: wf.constructorsPresent,
              constructorsOnRoster: wf.taken ? wf.constructorsOnRoster : null,
            })
          : null,
    });
  }
  return { days: rows };
}

/** The last `count` working days before today, oldest first. */
export async function recentProductionDays(count: number, now: Date = new Date()) {
  const today = manilaToday(now);
  // Enough calendar days to hold `count` working days with a day off a week, and some slack.
  const from = addDays(today, -Math.ceil(count * 1.5) - 7);
  const result = await productionDays(from, addDays(today, -1), now);
  return { days: result.days.slice(-count) };
}

// ───────────── today ─────────────

export type BatchView = {
  number: number;
  /** The batch's end (ISO), which identifies it. */
  slotAt: string;
  startTime: string;
  time: string;
  lunch: BreakRule | null;
  /** "10:00–13:00, lunch 11:00–12:00" */
  times: string;
  label: string;
  state: BatchState;
  /** In progress and inside its lunch break. */
  pausedForLunch: boolean;
  /** Finish batch is open now: from 10 minutes before the end until midnight (C-28). */
  canFinishNow: boolean;
  /** "14:50", when Finish batch opens. */
  finishOpensAt: string;
  /** "Late by 40 minutes", while it waits. */
  lateBy: string | null;
  checkIn: {
    id: string;
    updatedAt: string;
    enteredAt: string;
    enteredAtTime: string;
    enteredLate: boolean;
    enteredBy: string;
    pairs: number;
    failedPairs: number;
    constructorsPresent: number | null;
    constructorsOnRoster: number | null;
    /** Today's attendance no longer matches what was read when this was saved (D-080). */
    attendanceChanged: boolean;
    notes: string | null;
    correction: { at: string; by: string; reason: string } | null;
  } | null;
};

function batchView(
  batch: Batch,
  row: CheckInRow | undefined,
  now: Date,
  todayPresent: number | null,
): BatchView {
  const state = batchState(batch, row ?? null, now);
  const opens = finishOpensAt(batch);
  return {
    number: batch.number,
    slotAt: batch.at.toISOString(),
    startTime: batch.startTime,
    time: batch.time,
    lunch: batch.lunch,
    times: batchTimes(batch),
    label: batch.label,
    state,
    pausedForLunch: state === "IN_PROGRESS" && pausedForLunch(batch, now),
    canFinishNow: !row && state !== "MISSED" && now.getTime() >= opens.getTime(),
    finishOpensAt: clockTime(opens),
    lateBy:
      state === "LATE" ? `Late by ${describeMinutes(now.getTime() - batch.at.getTime())}` : null,
    checkIn: row
      ? {
          id: row.id,
          updatedAt: row.updatedAt.toISOString(),
          enteredAt: row.enteredAt.toISOString(),
          enteredAtTime: clockTime(row.enteredAt),
          enteredLate: enteredLate(batch, row.enteredAt),
          enteredBy: row.enteredBy.name,
          pairs: row.pairs,
          failedPairs: row.failedPairs,
          constructorsPresent: row.constructorsPresent,
          constructorsOnRoster: row.constructorsOnRoster,
          attendanceChanged: row.constructorsPresent !== todayPresent,
          notes: row.notes,
          correction:
            row.correctedAt && row.correctionReason
              ? {
                  at: clockTime(row.correctedAt),
                  by: row.correctedBy?.name ?? "Someone",
                  reason: row.correctionReason,
                }
              : null,
        }
      : null,
  };
}

/** Today on the line: each batch, passed pairs against the quota, the next batch to finish. */
export async function productionToday(viewer: { role: Role }, now: Date = new Date()) {
  const day = manilaToday(now);
  const [data, workforce, qiPresent] = await Promise.all([
    load(day, day),
    workforceByDay([day]),
    qualityInspectorPresentOn(day),
  ]);
  const wf = workforce.get(day)!;
  const rule = scheduleRule(inForceOn(data.schedules, day));
  const lunch = lunchOn(data.lunches, day);
  const batches = batchesOn(data, day);
  const rows = batches.map((b) =>
    batchView(
      b,
      data.checkIns.find((c) => c.slotAt.getTime() === b.at.getTime()),
      now,
      wf.constructorsPresent,
    ),
  );
  const quota = quotaOn(data.quotas, day);
  const finished = data.checkIns.reduce((s, c) => s + c.pairs, 0);
  const failed = data.checkIns.reduce((s, c) => s + c.failedPairs, 0);
  const left = rows.filter((r) => !r.checkIn && r.state !== "MISSED").length;
  const progress = quotaProgress(finished, failed, quota, left);
  const dayDone = rows.length > 0 && left === 0;
  const shortfall = dayDone
    ? explainShortfall({
        pairs: progress.passed,
        quota,
        constructorsPresent: wf.constructorsPresent,
        constructorsOnRoster: wf.taken ? wf.constructorsOnRoster : null,
      })
    : null;
  const next =
    rows.find((r) => r.state === "DUE" || r.state === "LATE") ??
    rows.find((r) => r.state === "IN_PROGRESS") ??
    rows.find((r) => r.state === "UPCOMING") ??
    null;
  const canEnter = mayEnterCheckIns(viewer.role, qiPresent);
  return {
    day,
    dayLabel: formatAttendanceDay(day),
    schedule: rule ? describeSchedule(rule) : null,
    lunch: describeLunch(lunch),
    workingDay: batches.length > 0,
    rows,
    progress,
    next,
    late: rows.filter((r) => r.state === "LATE").length,
    missed: rows.filter((r) => r.state === "MISSED").length,
    workforce: wf,
    shortfall,
    /** May this viewer finish and correct today's batches (D-088)? */
    canEnter,
    /** The Floor Manager covering for an absent Quality Inspector (D-088). */
    covering: viewer.role === "FLOOR_MANAGER" && canEnter,
    /** Why this viewer can't finish batches, or null. */
    enterNote: checkInCoverReason(viewer.role, qiPresent),
  };
}

export type ProductionToday = Awaited<ReturnType<typeof productionToday>>;

// ───────────── the plan: schedule, quota and lunch ─────────────

export async function productionPlan(now: Date = new Date()) {
  const today = manilaToday(now);
  const tomorrow = addDays(today, 1);
  const [schedules, lunches, quotas, history, workforce] = await Promise.all([
    listSchedules(),
    listLunchBreaks(),
    listQuotas(),
    recentProductionDays(20, now),
    workforceByDay([today]),
  ]);
  const current = inForceOn(schedules, today);
  const upcoming = schedules.filter((s) => s.effectiveFrom > today).at(-1) ?? null;
  const expected = workforce.get(today)!.constructorsOnRoster || null;

  const todayQuota = inForceOn(quotas, today);
  const pending = quotas.filter((q) => q.effectiveFrom > today).at(-1) ?? null;
  const dayHistory: DayHistory[] = history.days.map((d) => ({
    day: d.day,
    full: d.full,
    passed: d.passed,
    constructorsPresent: d.constructorsPresent,
  }));
  const suggestion: Suggestion = suggestQuota(dayHistory, expected);
  const tomorrowLunch = lunchOn(lunches, tomorrow);
  const tomorrowRule = scheduleRule(inForceOn(schedules, tomorrow));
  const lunchOutside =
    tomorrowLunch?.startTime && tomorrowLunch.endTime && tomorrowRule
      ? lunchProblem(
          { startTime: tomorrowLunch.startTime, endTime: tomorrowLunch.endTime },
          tomorrowRule,
        )
      : null;

  return {
    today,
    tomorrow,
    schedule: current
      ? {
          shiftStart: current.shiftStart,
          shiftEnd: current.shiftEnd,
          intervalMinutes: current.intervalMinutes,
          workingDays: current.workingDays,
          description: describeSchedule(current),
        }
      : null,
    upcomingSchedule: upcoming
      ? { from: upcoming.effectiveFrom, description: describeSchedule(upcoming) }
      : null,
    /** Tomorrow's lunch, for the preview: the System Admin sets it (C-3). */
    tomorrowLunch: tomorrowLunch?.startTime && tomorrowLunch.endTime ? tomorrowLunch : null,
    tomorrowLunchText: describeLunch(tomorrowLunch),
    /** Tomorrow's lunch isn't inside tomorrow's shift, so the batches ignore it. */
    lunchWarning: lunchOutside
      ? `Tomorrow's lunch (${describeLunch(tomorrowLunch)}) isn't inside the shift, so the batches don't pause for it. Ask the System Admin to change it under Settings → Lunch break.`
      : null,
    scheduleHistory: [...schedules].reverse().map((s) => ({
      id: s.id,
      effectiveFrom: s.effectiveFrom,
      description: describeSchedule(s),
      setBy: s.createdBy?.name ?? "Default",
      setAt: s.createdAt.toISOString(),
    })),
    quota: {
      today: todayQuota?.pairs ?? null,
      upcoming: pending ? { pairs: pending.pairs, from: pending.effectiveFrom } : null,
      /** The first quota applies from today (Dylan 5A); a change from tomorrow. */
      appliesFrom: effectiveFromFor(today, quotas.length === 0),
      suggestion,
    },
    quotaHistory: [...quotas].reverse().map((q) => ({
      id: q.id,
      pairs: q.pairs,
      suggestedPairs: q.suggestedPairs,
      effectiveFrom: q.effectiveFrom,
      setBy: q.createdBy.name,
      setAt: q.createdAt.toISOString(),
    })),
  };
}

export type ProductionPlan = Awaited<ReturnType<typeof productionPlan>>;

/** A new schedule (D-083): always from tomorrow, so today's batches stay as they were. */
export async function saveSchedule(input: ScheduleInput, actor: Actor, now: Date = new Date()) {
  const effectiveFrom = addDays(manilaToday(now), 1);
  const workingDays = [...new Set(input.workingDays)].sort((a, b) => a - b);
  return runInTransaction(async (tx) => {
    const row = await insertSchedule(
      {
        shiftStart: input.shiftStart,
        shiftEnd: input.shiftEnd,
        intervalMinutes: input.intervalMinutes,
        workingDays,
        effectiveFrom,
        createdById: actor.id,
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.schedule.set",
      entity: "ProductionSchedule",
      entityId: row.id,
      after: { ...input, workingDays, effectiveFrom },
    });
    return { id: row.id, effectiveFrom };
  });
}

/**
 * The one daily quota for the whole line (D-085, D-099): a change applies from tomorrow; the
 * first quota ever from today (Dylan 5A). A quota equal to the one in force that day is skipped.
 */
export async function saveQuota(input: QuotaInput, actor: Actor, now: Date = new Date()) {
  const today = manilaToday(now);
  const quotas = await listQuotas();
  const from = effectiveFromFor(today, quotas.length === 0);
  const before = inForceOn(quotas, from)?.pairs ?? null;
  const pairs = input.pairs as number;
  if (before === pairs) return { saved: false, effectiveFrom: from };
  return runInTransaction(async (tx) => {
    const row = await insertQuota(
      {
        pairs,
        suggestedPairs: input.suggestedPairs ?? null,
        effectiveFrom: from,
        createdById: actor.id,
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.quota.set",
      entity: "DailyQuota",
      entityId: row.id,
      before: { pairs: before },
      after: { pairs, suggestedPairs: input.suggestedPairs ?? null, effectiveFrom: from },
    });
    return { saved: true, effectiveFrom: from };
  });
}

/** Settings → Lunch break (C-3): tomorrow's lunch, the shift it must sit in, and the history. */
export async function lunchBreakSettings(now: Date = new Date()) {
  const today = manilaToday(now);
  const tomorrow = addDays(today, 1);
  const [lunches, schedules] = await Promise.all([listLunchBreaks(), listSchedules()]);
  const current = lunchOn(lunches, today);
  const next = lunchOn(lunches, tomorrow);
  const shift = scheduleRule(inForceOn(schedules, tomorrow));
  const upcoming = lunches.filter((l) => l.effectiveFrom > today).at(-1) ?? null;
  return {
    today,
    tomorrow,
    current: { text: describeLunch(current), startTime: current?.startTime ?? null },
    /** What the form starts from: tomorrow's lunch. */
    form: { startTime: next?.startTime ?? null, endTime: next?.endTime ?? null },
    upcoming: upcoming ? { from: upcoming.effectiveFrom, text: describeLunch(upcoming) } : null,
    shift: shift ? { shiftStart: shift.shiftStart, shiftEnd: shift.shiftEnd } : null,
    history: [...lunches].reverse().map((l) => ({
      id: l.id,
      effectiveFrom: l.effectiveFrom,
      text: describeLunch(l),
      setBy: l.createdBy?.name ?? "Default",
      setAt: l.createdAt.toISOString(),
    })),
  };
}

export type LunchBreakSettings = Awaited<ReturnType<typeof lunchBreakSettings>>;

/**
 * The System Admin's lunch break (C-3, C-25, A-4): the same every working day, inside the shift in
 * force tomorrow, applying from tomorrow like the schedule (D-083).
 */
export async function saveLunchBreak(input: LunchBreakInput, actor: Actor, now: Date = new Date()) {
  const effectiveFrom = addDays(manilaToday(now), 1);
  if (input.startTime && input.endTime) {
    const shift = scheduleRule(inForceOn(await listSchedules(), effectiveFrom));
    const problem = lunchProblem({ startTime: input.startTime, endTime: input.endTime }, shift);
    if (problem) throw Errors.validation([{ path: [problem.field], message: problem.message }]);
  }
  return runInTransaction(async (tx) => {
    const row = await insertLunchBreak(
      { ...input, effectiveFrom, createdById: actor.id, createdAt: now },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.lunch.set",
      entity: "LunchBreak",
      entityId: row.id,
      after: { ...input, effectiveFrom },
    });
    return { id: row.id, effectiveFrom };
  });
}

// ───────────── finishing a batch ─────────────

function counts(batchNumber: number, raw: { pairs?: unknown; failedPairs?: unknown }) {
  const parsed = parseBatchCounts(batchNumber, raw);
  if (!parsed.ok)
    throw Errors.validation(
      Object.entries(parsed.errors).map(([field, message]) => ({ path: [field], message })),
    );
  return { pairs: parsed.pairs, failedPairs: parsed.failedPairs };
}

function alreadyFinished(row: CheckInRow, number: number) {
  return Errors.stale(
    `${row.enteredBy.name} already finished Batch ${number} at ${clockTime(row.enteredAt)}. Refresh to see it.`,
  );
}

/**
 * Who may finish or correct a batch on a day (D-084, D-088, C-29): the Quality Inspector, or the
 * Floor Manager when that day's attendance shows no Quality Inspector present. 403 with the reason.
 */
async function assertMayEnter(actor: CheckInActor, day: string): Promise<{ covering: boolean }> {
  if (actor.role === "QUALITY_INSPECTOR") return { covering: false };
  const qiPresent = actor.role === "FLOOR_MANAGER" ? await qualityInspectorPresentOn(day) : null;
  const reason = checkInCoverReason(actor.role, qiPresent);
  if (reason) throw Errors.forbidden(reason);
  return { covering: true };
}

/**
 * Finish a batch (C-5, C-7, C-27): the pairs finished and, of these, the pairs that failed
 * inspection. From 10 minutes before its end (C-28) until midnight; one finish per batch.
 */
export async function saveCheckIn(
  input: CheckInInput,
  actor: CheckInActor,
  now: Date = new Date(),
) {
  const slotAt = new Date(input.slotAt);
  const day = manilaDayOf(slotAt);
  const { covering } = await assertMayEnter(actor, day);
  const [schedules, lunches, workforce] = await Promise.all([
    listSchedules(),
    listLunchBreaks(),
    workforceByDay([day]),
  ]);
  const batch = batchesOn({ schedules, lunches }, day).find(
    (b) => b.at.getTime() === slotAt.getTime(),
  );
  if (!batch)
    throw Errors.conflict(
      `There's no batch ending at ${clockTime(slotAt)} on ${formatAttendanceDay(day)}. Refresh the page.`,
    );
  const window = finishWindow(batch, day, now);
  if (!window.ok) throw Errors.conflict(window.reason);
  const existing = await findCheckInBySlot(day, slotAt);
  if (existing) throw alreadyFinished(existing, batch.number);
  const { pairs, failedPairs } = counts(batch.number, input);
  const wf = workforce.get(day)!;

  try {
    return await runInTransaction(async (tx) => {
      const row = await insertCheckIn(
        {
          day,
          slotAt,
          enteredAt: now,
          enteredById: actor.id,
          pairs,
          failedPairs,
          constructorsPresent: wf.constructorsPresent,
          constructorsOnRoster: wf.taken ? wf.constructorsOnRoster : null,
          notes: input.notes ?? null,
        },
        tx,
      );
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action: "production.checkin",
        entity: "ProductionCheckIn",
        entityId: row.id,
        after: {
          day,
          batch: batch.label,
          pairs,
          failedPairs,
          constructorsPresent: wf.constructorsPresent,
          notes: input.notes ?? null,
          ...(covering ? { coveringForQualityInspector: true } : {}),
        },
      });
      return { id: row.id, number: batch.number, time: batch.time };
    });
  } catch (error) {
    // Two people finishing the same batch at once: the unique slot decides, the second is stale.
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await findCheckInBySlot(day, slotAt);
      if (winner) throw alreadyFinished(winner, batch.number);
    }
    throw error;
  }
}

/** Correct a finished batch the same Manila day, with a reason; both counts go in the audit. */
export async function correctCheckIn(
  id: string,
  input: CorrectionInput,
  actor: CheckInActor,
  now: Date = new Date(),
) {
  const row = await findCheckIn(id);
  if (!row) throw Errors.notFound("This batch");
  const day = dayString(row.day);
  const { covering } = await assertMayEnter(actor, day);
  if (day !== manilaToday(now))
    throw Errors.conflict(
      `A batch can only be corrected on the same day. This one was on ${formatAttendanceDay(day)}.`,
    );
  if (row.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString())
    throw Errors.stale(
      row.correctedAt
        ? `This batch was already corrected by ${row.correctedBy?.name ?? "someone"} at ${clockTime(row.correctedAt)}. Refresh to see it.`
        : "This batch was changed by someone else. Refresh to see it.",
    );
  const [schedules, lunches] = await Promise.all([listSchedules(), listLunchBreaks()]);
  const batch = batchesOn({ schedules, lunches }, day).find(
    (b) => b.at.getTime() === row.slotAt.getTime(),
  );
  const number = batch?.number ?? 0;
  const next = counts(number, input);

  return runInTransaction(async (tx) => {
    const ok = await correctCheckInRow(
      id,
      row.updatedAt,
      { correctedAt: now, correctedById: actor.id, correctionReason: input.reason, ...next },
      tx,
    );
    if (!ok) throw Errors.stale("This batch was changed by someone else. Refresh to see it.");
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.checkin.correct",
      entity: "ProductionCheckIn",
      entityId: id,
      before: { pairs: row.pairs, failedPairs: row.failedPairs },
      after: {
        ...next,
        reason: input.reason,
        ...(covering ? { coveringForQualityInspector: true } : {}),
      },
    });
    return { id, number, time: clockTime(row.slotAt) };
  });
}

// ───────────── reports ─────────────

/** Reports → Operations: per day the pairs finished, failed and passed against the quota. */
export async function productionReport(range: ReportRange, now: Date = new Date()) {
  const { days } = await productionDays(range.from, range.to, now);
  const finished = days.reduce((s, d) => s + d.finished, 0);
  const failed = days.reduce((s, d) => s + d.failed, 0);
  const done = days.filter((d) => d.day < manilaToday(now) && d.quota !== null);
  const quota = done.reduce((s, d) => s + (d.quota ?? 0), 0);
  const passedOnQuotaDays = done.reduce((s, d) => s + d.passed, 0);
  return {
    days,
    totals: {
      finished,
      failed,
      passed: Math.max(0, finished - failed),
      failedShare: failedShare(finished, failed),
      /** Passed pairs against the quota over finished days that had one (C-41). */
      share: quota > 0 ? passedOnQuotaDays / quota : null,
      daysBelow: done.filter((d) => d.shortfall !== null).length,
      daysWithQuota: done.length,
    },
  };
}

export type ProductionReport = Awaited<ReturnType<typeof productionReport>>;

const pct = (v: number | null) => (v === null ? "" : (Math.round(v * 1000) / 10).toFixed(1));

/** `production.csv`: one row a day (Phase 27; per day only, never per person, D-008). */
export async function productionCsv(range: ReportRange, now: Date = new Date()) {
  const { days } = await productionDays(range.from, range.to, now);
  return toCsv(days, [
    { header: "Date (Manila)", value: (d) => d.day },
    { header: "Pairs finished", value: (d) => d.finished },
    { header: "Failed inspection", value: (d) => d.failed },
    { header: "% failed", value: (d) => pct(d.failedShare) },
    { header: "Pairs passed", value: (d) => d.passed },
    { header: "Daily quota", value: (d) => d.quota ?? "" },
    { header: "% of quota (passed)", value: (d) => pct(d.share) },
    { header: "Batches finished", value: (d) => d.finishedBatches },
    { header: "Batches scheduled", value: (d) => d.batches },
    { header: "Shoe Constructors present", value: (d) => d.constructorsPresent ?? "" },
    { header: "Shoe Constructors on the roster", value: (d) => d.constructorsOnRoster },
    {
      header: "Pairs per constructor present (line average)",
      value: (d) => d.pairsPerConstructor ?? "",
    },
    { header: "Day below quota", value: (d) => d.shortfall ?? "" },
  ]);
}
