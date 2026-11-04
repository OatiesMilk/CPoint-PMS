/**
 * Batches (Phase 27, D-097 to D-099; before it production progression, Phase 23, D-082 to D-087).
 * A batch is one check-in interval of the working day: the Floor Manager plans each working day on
 * a calendar (Phase 30E-2, D-114: rolls to be used, the quota, the check-in interval and the shift),
 * the System Admin sets the lunch break that pauses a batch, and the Quality Inspector
 * finishes each batch with the pairs finished and the pairs that failed inspection. Internally a
 * finished batch is still a `ProductionCheckIn`.
 *
 * Everything returned is per batch or per day for the whole line (D-008). The only names are who
 * finished or corrected a batch and who last changed a day's plan, log-book facts that are never
 * totalled (D-086). Worker counts
 * come from attendance's `workforceFor` (D-080), never counted here.
 */
import type { Role } from "@/lib/domain";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { formatManilaDateTime, manilaToday } from "@/lib/format";
import {
  DEFAULT_LUNCH,
  FACTORY_CLOSES,
  FACTORY_OPENS,
  addMonths,
  batchesFor,
  batchState,
  batchTimes,
  breaksOf,
  clockTime,
  describeInterval,
  describeMinutes,
  describePlanShort,
  enteredLate,
  explainShortfall,
  failedShare,
  finishOpensAt,
  finishWindow,
  inForceOn,
  isWeekend,
  lastDayOf,
  lunchProblem,
  manilaDayOf,
  monthOf,
  monthWeeks,
  pairsPerConstructor,
  pausedForLunch,
  planProblem,
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
  deleteDayPlan,
  findCheckIn,
  findCheckInBySlot,
  findDayPlan,
  firstCheckInDay,
  insertCheckIn,
  insertDayPlan,
  insertLunchBreak,
  listCheckIns,
  listDayPlans,
  listLunchBreaks,
  updateDayPlan,
  type CheckInRow,
  type DayPlanData,
  type DayPlanRow,
} from "@/server/models/production.model";
import { checkInCoverReason, mayEnterCheckIns } from "@/server/policies/permissions";
import {
  parseBatchCounts,
  type CheckInInput,
  type CorrectionInput,
  type DayMarkInput,
  type DayPlanInput,
  type LunchBreakInput,
} from "@/server/validators/production.validator";
import { qualityInspectorPresentOn, workforceByDay } from "./attendance.service";
import { recordAudit } from "./audit.service";
import { rollsScannedByDay, rollsUsedByCheckIn } from "./roll.service";

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

/** The shift and interval of a planned day; null when it isn't planned or is Non-working. */
function planRule(plan: DayPlanRow | null | undefined): ScheduleRule | null {
  return plan?.kind === "PLANNED" && plan.shiftStart && plan.shiftEnd
    ? {
        shiftStart: plan.shiftStart,
        shiftEnd: plan.shiftEnd,
        intervalMinutes: plan.intervalMinutes,
      }
    : null;
}

type Plans = {
  /** Day plans and Non-working marks by day. */
  plans: Map<string, DayPlanRow>;
  lunches: Awaited<ReturnType<typeof listLunchBreaks>>;
};

const byDay = (rows: DayPlanRow[]) => new Map(rows.map((r) => [r.day, r]));

function lunchOn(lunches: Plans["lunches"], day: string): LunchRule | null {
  const row = inForceOn(lunches, day);
  return row ? { startTime: row.startTime, endTime: row.endTime } : null;
}

/** A day's batches from its plan (D-114) and the lunch break in force that day. None unplanned. */
function batchesOn(plans: Plans, day: string): Batch[] {
  return batchesFor(planRule(plans.plans.get(day)), breaksOf(lunchOn(plans.lunches, day)), day);
}

/** "Batch 1 08:00–13:00, lunch 11:00–12:00; Batch 2 13:00–17:00" for a sample working day. */
export function describeBatches(rule: ScheduleRule, breaks: readonly BreakRule[]): string {
  const sample = batchesFor({ ...rule, workingDays: undefined }, breaks, "2026-01-05");
  return sample.map((b) => `Batch ${b.number} ${batchTimes(b)}`).join("; ");
}

/** "08:00 to 17:00, every 4 hours". */
export function describeSchedule(rule: ScheduleRule): string {
  return `${rule.shiftStart} to ${rule.shiftEnd}, ${describeInterval(rule.intervalMinutes)}`;
}

/** "11:00 to 12:00" or "No lunch break". */
export function describeLunch(lunch: LunchRule | null): string {
  return lunch?.startTime && lunch.endTime
    ? `${lunch.startTime} to ${lunch.endTime}`
    : "No lunch break";
}

/** Earliest day the bootstrap's lunch covers, so it is in force from the first day of use. */
export const DEFAULT_LUNCH_FROM = "2000-01-01";

/**
 * The bootstrap's default lunch, 11:00 to 12:00 (A-4), only when no lunch row exists. On a database
 * with no finished batches it is in force from the start; otherwise from tomorrow, so past days keep
 * the batch times they were counted at and still match their rows.
 */
export async function ensureDefaultLunchBreak(db: Tx, now: Date = new Date()) {
  if ((await countLunchBreaks(db)) > 0) return false;
  const effectiveFrom = (await firstCheckInDay(db))
    ? addDays(manilaToday(now), 1)
    : DEFAULT_LUNCH_FROM;
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
  /** Rolls to be used that day (D-114); null when not planned or converted. */
  rollsPlanned: number | null;
  /** Rolls whose scan was finished at Capture that day. */
  rollsScanned: number;
  attendanceTaken: boolean;
  constructorsPresent: number | null;
  constructorsOnRoster: number;
  /** Line average for the day (D-008): pairs finished ÷ constructors present. */
  pairsPerConstructor: number | null;
  shortfall: string | null;
};

type Loaded = Plans & {
  checkIns: CheckInRow[];
  rolls: Map<string, number>;
};

async function load(from: string, to: string): Promise<Loaded> {
  const [plans, lunches, checkIns, rolls] = await Promise.all([
    listDayPlans(from, to),
    listLunchBreaks(),
    listCheckIns(from, to),
    rollsScannedByDay(from, to),
  ]);
  return { plans: byDay(plans), lunches, checkIns, rolls };
}

/** The day's quota from its plan (D-114). */
const quotaOn = (plans: Plans["plans"], day: string) =>
  plans.get(day)?.kind === "PLANNED" ? (plans.get(day)?.quota ?? null) : null;
const rollsPlannedOn = (plans: Plans["plans"], day: string) =>
  plans.get(day)?.kind === "PLANNED" ? (plans.get(day)?.rollsPlanned ?? null) : null;

/**
 * One row per working day from `from` to `to` (a day with batches planned or finished), oldest
 * first, from the first day a batch was ever finished. Unplanned and Non-working days have no
 * batches, so they aren't working days here (D-114).
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
    const quota = quotaOn(data.plans, day);
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
      rollsPlanned: rollsPlannedOn(data.plans, day),
      rollsScanned: data.rolls.get(day) ?? 0,
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
    /** Rolls ticked Fully used at this finish (Phase 30A). */
    usedRolls: { id: string; code: string }[];
  } | null;
};

function batchView(
  batch: Batch,
  row: CheckInRow | undefined,
  now: Date,
  todayPresent: number | null,
  usedRolls: { id: string; code: string }[] = [],
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
          usedRolls,
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
  const plan = data.plans.get(day) ?? null;
  const rule = planRule(plan);
  const lunch = lunchOn(data.lunches, day);
  const batches = batchesOn(data, day);
  const canEnter = mayEnterCheckIns(viewer.role, qiPresent);
  // Rolls ticked Fully used before Phase 30E still show on their batch (history).
  const used = await rollsUsedByCheckIn(data.checkIns.map((c) => c.id));
  const rows = batches.map((b) => {
    const row = data.checkIns.find((c) => c.slotAt.getTime() === b.at.getTime());
    return batchView(b, row, now, wf.constructorsPresent, row ? (used.get(row.id) ?? []) : []);
  });
  const quota = quotaOn(data.plans, day);
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
  return {
    day,
    dayLabel: formatAttendanceDay(day),
    schedule: rule ? describeSchedule(rule) : null,
    lunch: describeLunch(lunch),
    workingDay: batches.length > 0,
    /** Today's plan in short ("5 rolls · 128 pairs · every 4 h"), or null (D-114). */
    plan: rule && plan ? describePlanShort(plan) : null,
    /** Marked Non-working / Holiday: no batches and no notice. */
    nonWorking: plan?.kind === "NON_WORKING",
    /** A weekday with no plan yet: no batches, and the Floor Manager's start-of-day notice (A-37). */
    planNeeded: !plan && !isWeekend(day),
    rollsPlanned: rollsPlannedOn(data.plans, day),
    rollsScanned: data.rolls.get(day) ?? 0,
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

// ───────────── the planning calendar (Phase 30E-2, D-114, D-115) ─────────────

export const TODAY_LOCKED =
  "A batch is already finished today, so today's plan can't change. Plan the coming days instead.";

/** The quota suggestion (D-099) from the recent full working days, for the day dialog. */
async function quotaSuggestion(now: Date): Promise<Suggestion> {
  const today = manilaToday(now);
  const [history, workforce] = await Promise.all([
    recentProductionDays(20, now),
    workforceByDay([today]),
  ]);
  const expected = workforce.get(today)!.constructorsOnRoster || null;
  const dayHistory: DayHistory[] = history.days.map((d) => ({
    day: d.day,
    full: d.full,
    passed: d.passed,
    constructorsPresent: d.constructorsPresent,
  }));
  return suggestQuota(dayHistory, expected);
}

function changedBy(row: DayPlanRow): string {
  return row.updatedBy?.name ?? row.createdBy?.name ?? "Converted from the old schedule";
}

/**
 * Batches → Plan (D-114): a month of the calendar. Each day says whether it is planned, marked
 * Non-working / Holiday or not planned, whether the Floor Manager may change it now, and, for
 * today and past days, the rolls scanned against the rolls planned.
 */
export async function planMonth(month: string, now: Date = new Date()) {
  const today = manilaToday(now);
  const from = `${month}-01`;
  const to = lastDayOf(month);
  const [rows, lunches, todayCheckIns, rolls, suggestion] = await Promise.all([
    listDayPlans(from, to),
    listLunchBreaks(),
    listCheckIns(today, today),
    rollsScannedByDay(from, to),
    quotaSuggestion(now),
  ]);
  const plans = byDay(rows);
  const todayLocked = todayCheckIns.length > 0 && plans.get(today)?.kind === "PLANNED";
  const days = monthWeeks(month)
    .flat()
    .filter((d): d is string => d !== null)
    .map((day) => {
      const row = plans.get(day) ?? null;
      const rule = planRule(row);
      const lunch = breaksOf(lunchOn(lunches, day))[0] ?? null;
      const problem =
        planProblem(day, today) ?? (day === today && todayLocked ? TODAY_LOCKED : null);
      return {
        day,
        label: formatAttendanceDay(day),
        weekend: isWeekend(day),
        past: day < today,
        isToday: day === today,
        kind: row?.kind ?? null,
        plan:
          row && rule
            ? {
                rollsPlanned: row.rollsPlanned,
                quota: row.quota,
                intervalMinutes: row.intervalMinutes,
                shiftStart: rule.shiftStart,
                shiftEnd: rule.shiftEnd,
                short: describePlanShort(row),
                batches: describeBatches(rule, lunch ? [lunch] : []),
              }
            : null,
        updatedAt: row ? row.updatedAt.toISOString() : null,
        changed: row ? { by: changedBy(row), at: row.updatedAt.toISOString() } : null,
        /** That day's lunch, for the dialog's preview (the System Admin's, C-3). */
        lunch,
        /** Today and past days: rolls whose scan was finished that day. */
        rollsScanned: day <= today ? (rolls.get(day) ?? 0) : null,
        editable: problem === null,
        lockedReason: problem,
      };
    });
  const lastMonth = monthOf(lastDayOf(addMonths(monthOf(today), 3)));
  return {
    month,
    today,
    weeks: monthWeeks(month),
    days,
    prevMonth: addMonths(month, -1),
    nextMonth: month < lastMonth ? addMonths(month, 1) : null,
    suggestion,
    factory: { opens: FACTORY_OPENS, closes: FACTORY_CLOSES },
  };
}

export type PlanMonth = Awaited<ReturnType<typeof planMonth>>;
export type PlanDay = PlanMonth["days"][number];

/**
 * A day the Floor Manager may plan or mark now (D-114, A-36); 409 with the reason otherwise.
 * Today locks once one of its planned batches is finished. A today with batches finished before
 * it had a plan (older data) stays open, so the Floor Manager is never left with a notice they
 * can't act on.
 */
async function openDay(day: string, now: Date): Promise<DayPlanRow | null> {
  const today = manilaToday(now);
  const problem = planProblem(day, today);
  if (problem) throw Errors.conflict(problem);
  const row = await findDayPlan(day);
  if (day === today && row?.kind === "PLANNED" && (await listCheckIns(today, today)).length > 0)
    throw Errors.conflict(TODAY_LOCKED);
  return row;
}

/** STALE when the day changed since the dialog opened (`expected` is the updatedAt it saw). */
function assertUnchanged(row: DayPlanRow | null, expected: string | null) {
  const current = row ? row.updatedAt.toISOString() : null;
  const seen = expected ? new Date(expected).toISOString() : null;
  if (current === seen) return;
  throw Errors.stale(
    row
      ? `${changedBy(row)} changed ${formatAttendanceDay(row.day)} at ${formatManilaDateTime(row.updatedAt)}. Refresh to see it.`
      : "Someone else cleared this day. Refresh to see it.",
  );
}

function planAudit(row: DayPlanRow | null) {
  if (!row) return null;
  return {
    kind: row.kind,
    rollsPlanned: row.rollsPlanned,
    quota: row.quota,
    intervalMinutes: row.intervalMinutes,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
  };
}

const samePlan = (row: DayPlanRow, data: DayPlanData) =>
  row.kind === data.kind &&
  row.rollsPlanned === data.rollsPlanned &&
  row.quota === data.quota &&
  row.intervalMinutes === data.intervalMinutes &&
  row.shiftStart === data.shiftStart &&
  row.shiftEnd === data.shiftEnd;

/** Writes a day's plan or mark: a new row, or a change guarded by the updatedAt it was read at. */
async function writeDay(
  day: string,
  row: DayPlanRow | null,
  data: DayPlanData,
  action: string,
  actor: Actor,
  now: Date,
) {
  try {
    return await runInTransaction(async (tx) => {
      let id: string;
      if (row) {
        const ok = await updateDayPlan(row.id, row.updatedAt, data, actor.id, now, tx);
        if (!ok) throw Errors.stale("Someone else changed this day. Refresh to see it.");
        id = row.id;
      } else id = (await insertDayPlan(day, data, actor.id, now, tx)).id;
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action,
        entity: "DayPlan",
        entityId: id,
        before: planAudit(row),
        after: { day, ...data },
      });
      return { saved: true, day };
    });
  } catch (error) {
    // Two people planning the same new day at once: the unique day decides, the second is stale.
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await findDayPlan(day);
      assertUnchanged(winner, null);
    }
    throw error;
  }
}

/**
 * Plan a day (D-114, D-115): rolls to be used, the quota, the check-in interval and the shift. A
 * weekday from today to the last plannable day (A-40); today only until its first batch is
 * finished (A-36). A plan equal to the one saved is skipped (D-107).
 */
export async function saveDayPlan(
  day: string,
  input: DayPlanInput,
  actor: Actor,
  now: Date = new Date(),
) {
  const row = await openDay(day, now);
  assertUnchanged(row, input.expectedUpdatedAt);
  const data: DayPlanData = {
    kind: "PLANNED",
    rollsPlanned: input.rollsPlanned as number,
    quota: input.quota as number,
    suggestedQuota: input.suggestedQuota,
    intervalMinutes: input.intervalMinutes,
    shiftStart: input.shiftStart,
    shiftEnd: input.shiftEnd,
  };
  if (row && samePlan(row, data)) return { saved: false, day };
  return writeDay(day, row, data, "production.plan.set", actor, now);
}

/** Mark a weekday Non-working / Holiday (D-114): no batches, no notice, no stock reminder. */
export async function markNonWorking(
  day: string,
  input: DayMarkInput,
  actor: Actor,
  now: Date = new Date(),
) {
  const row = await openDay(day, now);
  assertUnchanged(row, input.expectedUpdatedAt);
  if (row?.kind === "NON_WORKING") return { saved: false, day };
  const data: DayPlanData = {
    kind: "NON_WORKING",
    rollsPlanned: null,
    quota: null,
    suggestedQuota: null,
    intervalMinutes: null,
    shiftStart: null,
    shiftEnd: null,
  };
  return writeDay(day, row, data, "production.plan.nonWorking", actor, now);
}

/** Undo a Non-working mark: the day is a working day again, still to be planned. */
export async function clearNonWorking(
  day: string,
  input: DayMarkInput,
  actor: Actor,
  now: Date = new Date(),
) {
  const row = await openDay(day, now);
  assertUnchanged(row, input.expectedUpdatedAt);
  if (row?.kind !== "NON_WORKING")
    throw Errors.conflict(`${formatAttendanceDay(day)} isn't marked Non-working / Holiday.`);
  return runInTransaction(async (tx) => {
    const ok = await deleteDayPlan(row.id, row.updatedAt, tx);
    if (!ok) throw Errors.stale("Someone else changed this day. Refresh to see it.");
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.plan.cleared",
      entity: "DayPlan",
      entityId: row.id,
      before: { day, ...planAudit(row) },
    });
    return { saved: true, day };
  });
}

/**
 * The Floor Manager's start-of-day notice (A-37): from 00:00 on a weekday that has no plan and
 * isn't marked Non-working / Holiday, until the plan is saved.
 */
export async function planNoticeDue(now: Date = new Date()): Promise<boolean> {
  const today = manilaToday(now);
  if (isWeekend(today)) return false;
  return (await findDayPlan(today)) === null;
}

/** Settings → Lunch break (C-3): tomorrow's lunch, the shift it must sit in, and the history. */
export async function lunchBreakSettings(now: Date = new Date()) {
  const today = manilaToday(now);
  const tomorrow = addDays(today, 1);
  const lunches = await listLunchBreaks();
  const current = lunchOn(lunches, today);
  const next = lunchOn(lunches, tomorrow);
  // Each day plans its own shift (D-114), so lunch sits inside the factory's hours (D-105).
  const shift = { shiftStart: FACTORY_OPENS, shiftEnd: FACTORY_CLOSES };
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
 * The System Admin's lunch break (C-3, C-25, A-4): the same every working day, inside the factory's
 * hours (D-105), applying from tomorrow. A day planned with a shorter shift that leaves it out
 * ignores it (the day dialog says so).
 */
export async function saveLunchBreak(input: LunchBreakInput, actor: Actor, now: Date = new Date()) {
  const effectiveFrom = addDays(manilaToday(now), 1);
  if (input.startTime && input.endTime) {
    const problem = lunchProblem(
      { startTime: input.startTime, endTime: input.endTime },
      { shiftStart: FACTORY_OPENS, shiftEnd: FACTORY_CLOSES },
    );
    if (problem) throw Errors.validation([{ path: [problem.field], message: problem.message }]);
  }
  // A lunch equal to the one in force tomorrow is skipped (team QA, 2026-11-02), like the schedule.
  const before = lunchOn(await listLunchBreaks(), effectiveFrom);
  if (
    (before?.startTime ?? null) === input.startTime &&
    (before?.endTime ?? null) === input.endTime
  )
    return { saved: false, effectiveFrom };
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
    return { saved: true, id: row.id, effectiveFrom };
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
  const [plan, lunches, workforce] = await Promise.all([
    findDayPlan(day),
    listLunchBreaks(),
    workforceByDay([day]),
  ]);
  const batch = batchesOn({ plans: byDay(plan ? [plan] : []), lunches }, day).find(
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
  const [plan, lunches] = await Promise.all([findDayPlan(day), listLunchBreaks()]);
  const batch = batchesOn({ plans: byDay(plan ? [plan] : []), lunches }, day).find(
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
    { header: "Rolls planned", value: (d) => d.rollsPlanned ?? "" },
    { header: "Rolls scanned", value: (d) => d.rollsScanned },
    { header: "Shoe Constructors present", value: (d) => d.constructorsPresent ?? "" },
    { header: "Shoe Constructors on the roster", value: (d) => d.constructorsOnRoster },
    {
      header: "Pairs per constructor present (line average)",
      value: (d) => d.pairsPerConstructor ?? "",
    },
    { header: "Day below quota", value: (d) => d.shortfall ?? "" },
  ]);
}
