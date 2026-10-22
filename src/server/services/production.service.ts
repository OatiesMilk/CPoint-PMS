/**
 * Production progression (Phase 23, D-082 to D-087): the schedule, the daily quota with its
 * suggestion, and the check-ins where the Quality Inspector counts the pairs finished since the
 * previous one. It replaces stage monitoring.
 *
 * Everything returned is per check-in, per day or per shoe type for the whole line (D-008). The
 * only name on a check-in is who entered or corrected it, an audit fact that is never totalled.
 * Worker counts come from attendance's `workforceFor` (D-080), never counted here.
 */
import type { Role } from "@/lib/domain";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { manilaToday } from "@/lib/format";
import {
  DEFAULT_SCHEDULE,
  checkInWindow,
  dayProgress,
  describeMinutes,
  effectiveFromFor,
  enteredLate,
  explainShortfall,
  inForceOn,
  manilaDayOf,
  minutesOf,
  pairsPerConstructor,
  slotState,
  slotsFor,
  suggestQuota,
  timeOf,
  type DayHistory,
  type ScheduleRule,
  type Slot,
  type SlotState,
  type Suggestion,
} from "@/lib/production-rules";
import { addDays, manilaDayStart, toCsv, type ReportRange } from "@/lib/report-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  correctCheckIn as correctCheckInRow,
  countSchedules,
  findCheckIn,
  firstCheckInDay,
  findCheckInBySlot,
  insertCheckIn,
  insertQuota,
  insertSchedule,
  listCheckIns,
  listQuotas,
  listSchedules,
  type CheckInRow,
} from "@/server/models/production.model";
import { listActiveShoeTypes, listAllShoeTypes } from "@/server/models/reference-data.model";
import { checkInCoverReason, mayEnterCheckIns } from "@/server/policies/permissions";
import {
  pairsSchema,
  quotaPairsSchema,
  type CheckInInput,
  type CorrectionInput,
  type QuotasInput,
  type ScheduleInput,
} from "@/server/validators/production.validator";
import { qualityInspectorPresentOn, workforceByDay } from "./attendance.service";
import { recordAudit } from "./audit.service";

type Actor = { id: string; name?: string };
/** Who enters a check-in: the role decides whether they may (D-088). */
type CheckInActor = Actor & { role: Role };
type ShoeTypeRef = { id: string; name: string };

const dayString = (d: Date) => d.toISOString().slice(0, 10);

/** "12:04", Manila. */
export function clockOf(at: Date): string {
  const day = manilaDayOf(at);
  return timeOf(Math.round((at.getTime() - manilaDayStart(day).getTime()) / 60_000));
}

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

/** "08:00 to 17:00, every 4 hours, Mon to Sat: check-ins at 12:00, 16:00 and 17:00". */
export function describeSchedule(rule: ScheduleRule): string {
  const days = [...rule.workingDays].sort((a, b) => a - b);
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText =
    days.length === 7
      ? "every day"
      : consecutive && days.length > 2
        ? `${names[days[0]]} to ${names[days.at(-1)!]}`
        : days.map((d) => names[d]).join(", ");
  const sample = slotsFor({ ...rule, workingDays: [1, 2, 3, 4, 5, 6, 7] }, "2026-01-05").map(
    (s) => s.time,
  );
  const list =
    sample.length > 1 ? `${sample.slice(0, -1).join(", ")} and ${sample.at(-1)}` : sample[0];
  const every =
    rule.intervalMinutes === 60 ? "every hour" : `every ${rule.intervalMinutes / 60} hours`;
  return `${rule.shiftStart} to ${rule.shiftEnd}, ${every}, ${dayText}: check-ins at ${list}`;
}

/** Earliest day the bootstrap schedule covers, so it is in force from the first day of use. */
export const DEFAULT_SCHEDULE_FROM = "2000-01-01";

/**
 * The bootstrap default (D-083, Dylan 2B): 08:00 to 17:00, every 4 hours, Monday to Saturday.
 * Only when no schedule exists; the Floor Manager changes it under Schedule and quota.
 */
export async function ensureDefaultSchedule(
  db: Parameters<Parameters<typeof runInTransaction>[0]>[0],
) {
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

// ───────────── day rows (Recent days, Reports, the CSV, the suggestion) ─────────────

export type DayRow = {
  day: string;
  /** Scheduled check-ins that day. */
  checkIns: number;
  entered: number;
  missed: number;
  /** Every scheduled check-in was entered. */
  full: boolean;
  /** Per shoe type. "label" is the shoe type's name (reports never carry a "name" key, D-008). */
  byType: { shoeTypeId: string; label: string; pairs: number; quota: number | null }[];
  pairs: number;
  /** Sum of the quotas of the shoe types that had one; null when none had. */
  quota: number | null;
  share: number | null;
  attendanceTaken: boolean;
  constructorsPresent: number | null;
  constructorsOnRoster: number;
  /** Line average for the day (D-008): total pairs ÷ constructors present. */
  pairsPerConstructor: number | null;
  shortfall: string | null;
};

type Loaded = {
  schedules: Awaited<ReturnType<typeof listSchedules>>;
  quotas: Awaited<ReturnType<typeof listQuotas>>;
  checkIns: CheckInRow[];
  types: { id: string; name: string; isActive: boolean }[];
};

async function load(from: string, to: string): Promise<Loaded> {
  const [schedules, quotas, checkIns, types] = await Promise.all([
    listSchedules(),
    listQuotas(),
    listCheckIns(from, to),
    listAllShoeTypes(),
  ]);
  return { schedules, quotas, checkIns, types };
}

function quotaFor(quotas: Loaded["quotas"], shoeTypeId: string, day: string): number | null {
  return (
    inForceOn(
      quotas.filter((q) => q.shoeTypeId === shoeTypeId),
      day,
    )?.pairs ?? null
  );
}

/**
 * One row per working day from `from` to `to` (a day with check-ins scheduled or entered), oldest
 * first, from the first day a check-in was ever entered. Shoe types shown are the active ones plus any with counts or a quota in the range, so a
 * type added mid-week shows from the day it has data and counts 0 before.
 */
export async function productionDays(
  from: string,
  to: string,
  now: Date = new Date(),
): Promise<{ shoeTypes: { id: string; label: string }[]; days: DayRow[] }> {
  const [data, first] = await Promise.all([load(from, to), firstCheckInDay()]);
  // Days before the first check-in ever entered weren't counted yet, so they aren't "missed".
  const days = first ? daysFrom(from > first ? from : first, to) : [];
  const workforce = await workforceByDay(days);
  const counted = new Set(data.checkIns.flatMap((c) => c.counts.map((x) => x.shoeTypeId)));
  const shoeTypes = data.types
    .filter(
      (t) =>
        t.isActive ||
        counted.has(t.id) ||
        days.some((d) => quotaFor(data.quotas, t.id, d) !== null),
    )
    .map(({ id, name }) => ({ id, label: name }));

  const rows: DayRow[] = [];
  for (const day of days) {
    const slots = slotsFor(scheduleRule(inForceOn(data.schedules, day)), day);
    const dayCheckIns = data.checkIns.filter((c) => dayString(c.day) === day);
    if (slots.length === 0 && dayCheckIns.length === 0) continue;
    const entered = slots.filter((s) =>
      dayCheckIns.some((c) => c.slotAt.getTime() === s.at.getTime()),
    ).length;
    const missed = slots.filter(
      (s) =>
        slotState(
          s,
          dayCheckIns.find((c) => c.slotAt.getTime() === s.at.getTime()) ?? null,
          now,
        ) === "MISSED",
    ).length;
    const byType = shoeTypes.map((t) => ({
      shoeTypeId: t.id,
      label: t.label,
      pairs: dayCheckIns
        .flatMap((c) => c.counts)
        .filter((x) => x.shoeTypeId === t.id)
        .reduce((s, x) => s + x.pairs, 0),
      quota: quotaFor(data.quotas, t.id, day),
    }));
    const pairs = byType.reduce((s, t) => s + t.pairs, 0);
    const withQuota = byType.filter((t) => t.quota !== null);
    const quota = withQuota.length ? withQuota.reduce((s, t) => s + (t.quota ?? 0), 0) : null;
    const quotaPairs = withQuota.reduce((s, t) => s + t.pairs, 0);
    const wf = workforce.get(day)!;
    rows.push({
      day,
      checkIns: slots.length,
      entered,
      missed,
      full: slots.length > 0 && entered === slots.length,
      byType,
      pairs,
      quota,
      share: quota ? quotaPairs / quota : null,
      attendanceTaken: wf.taken,
      constructorsPresent: wf.constructorsPresent,
      constructorsOnRoster: wf.constructorsOnRoster,
      pairsPerConstructor: pairsPerConstructor(pairs, wf.constructorsPresent),
      // Only a finished day can be "below quota"; today is still being counted.
      shortfall:
        day < manilaToday(now)
          ? explainShortfall({
              pairs: quotaPairs,
              quota,
              constructorsPresent: wf.constructorsPresent,
              constructorsOnRoster: wf.taken ? wf.constructorsOnRoster : null,
            })
          : null,
    });
  }
  return { shoeTypes, days: rows };
}

/** The last `count` working days before today, oldest first. */
export async function recentProductionDays(count: number, now: Date = new Date()) {
  const today = manilaToday(now);
  // Enough calendar days to hold `count` working days with a day off a week, and some slack.
  const from = addDays(today, -Math.ceil(count * 1.5) - 7);
  const result = await productionDays(from, addDays(today, -1), now);
  return { shoeTypes: result.shoeTypes, days: result.days.slice(-count) };
}

// ───────────── today ─────────────

export type SlotView = {
  slotAt: string;
  time: string;
  since: string;
  state: SlotState;
  /** "Late by 40 minutes", while it waits. */
  lateBy: string | null;
  checkIn: {
    id: string;
    updatedAt: string;
    enteredAt: string;
    enteredAtTime: string;
    enteredLate: boolean;
    enteredBy: string;
    constructorsPresent: number | null;
    constructorsOnRoster: number | null;
    /** Today's attendance no longer matches what was read when this was saved (D-080). */
    attendanceChanged: boolean;
    notes: string | null;
    counts: { shoeTypeId: string; pairs: number }[];
    correction: { at: string; by: string; reason: string } | null;
  } | null;
};

function slotView(
  slot: Slot,
  row: CheckInRow | undefined,
  now: Date,
  todayPresent: number | null,
): SlotView {
  const state = slotState(slot, row ?? null, now);
  return {
    slotAt: slot.at.toISOString(),
    time: slot.time,
    since: slot.since,
    state,
    lateBy:
      state === "LATE" ? `Late by ${describeMinutes(now.getTime() - slot.at.getTime())}` : null,
    checkIn: row
      ? {
          id: row.id,
          updatedAt: row.updatedAt.toISOString(),
          enteredAt: row.enteredAt.toISOString(),
          enteredAtTime: clockOf(row.enteredAt),
          enteredLate: enteredLate(slot, row.enteredAt),
          enteredBy: row.enteredBy.name,
          constructorsPresent: row.constructorsPresent,
          constructorsOnRoster: row.constructorsOnRoster,
          attendanceChanged: row.constructorsPresent !== todayPresent,
          notes: row.notes,
          counts: row.counts,
          correction:
            row.correctedAt && row.correctionReason
              ? {
                  at: clockOf(row.correctedAt),
                  by: row.correctedBy?.name ?? "Someone",
                  reason: row.correctionReason,
                }
              : null,
        }
      : null,
  };
}

/** Today on the line: each check-in, progress against the quota, the next check-in. */
export async function productionToday(viewer: { role: Role }, now: Date = new Date()) {
  const day = manilaToday(now);
  const [data, active, workforce, qiPresent] = await Promise.all([
    load(day, day),
    listActiveShoeTypes(),
    workforceByDay([day]),
    qualityInspectorPresentOn(day),
  ]);
  const wf = workforce.get(day)!;
  const rule = scheduleRule(inForceOn(data.schedules, day));
  const slots = slotsFor(rule, day);
  const rows = slots.map((s) =>
    slotView(
      s,
      data.checkIns.find((c) => c.slotAt.getTime() === s.at.getTime()),
      now,
      wf.constructorsPresent,
    ),
  );
  const quotas = new Map<string, number>();
  for (const t of active) {
    const q = quotaFor(data.quotas, t.id, day);
    if (q !== null) quotas.set(t.id, q);
  }
  const counts = data.checkIns.flatMap((c) => c.counts);
  const left = rows.filter((r) => !r.checkIn && r.state !== "MISSED").length;
  const progress = dayProgress(active, counts, quotas, left);
  const dayDone = rows.length > 0 && left === 0;
  const withQuota = progress.filter((p) => p.quota !== null);
  const shortfall = dayDone
    ? explainShortfall({
        pairs: withQuota.reduce((s, p) => s + p.pairs, 0),
        quota: withQuota.length ? withQuota.reduce((s, p) => s + (p.quota ?? 0), 0) : null,
        constructorsPresent: wf.constructorsPresent,
        constructorsOnRoster: wf.taken ? wf.constructorsOnRoster : null,
      })
    : null;
  const next =
    rows.find((r) => r.state === "DUE" || r.state === "LATE") ??
    rows.find((r) => r.state === "UPCOMING") ??
    null;
  return {
    day,
    dayLabel: formatAttendanceDay(day),
    schedule: rule ? describeSchedule(rule) : null,
    workingDay: slots.length > 0,
    rows,
    shoeTypes: active,
    progress,
    next,
    late: rows.filter((r) => r.state === "LATE").length,
    missed: rows.filter((r) => r.state === "MISSED").length,
    workforce: wf,
    shortfall,
    canEnter: mayEnterCheckIns(viewer.role, qiPresent),
    /** The Floor Manager covering for an absent Quality Inspector (D-088). */
    covering: viewer.role === "FLOOR_MANAGER" && mayEnterCheckIns(viewer.role, qiPresent),
    /** Why this viewer can't enter check-ins, or null. */
    enterNote: checkInCoverReason(viewer.role, qiPresent),
  };
}

export type ProductionToday = Awaited<ReturnType<typeof productionToday>>;

// ───────────── the plan: schedule and quotas ─────────────

/** Check-ins on the next working day from `day` (within a week), for the suggestion. */
function checkInsPerWorkingDay(schedules: Loaded["schedules"], day: string): number {
  for (let i = 0; i < 7; i++) {
    const d = addDays(day, i);
    const n = slotsFor(scheduleRule(inForceOn(schedules, d)), d).length;
    if (n > 0) return n;
  }
  return 0;
}

export async function productionPlan(now: Date = new Date()) {
  const today = manilaToday(now);
  const tomorrow = addDays(today, 1);
  const [schedules, quotas, active, history, workforce] = await Promise.all([
    listSchedules(),
    listQuotas(),
    listActiveShoeTypes(),
    recentProductionDays(20, now),
    workforceByDay([today]),
  ]);
  const current = inForceOn(schedules, today);
  const upcoming = schedules.filter((s) => s.effectiveFrom > today).at(-1) ?? null;
  const perDay = checkInsPerWorkingDay(schedules, tomorrow);
  const expected = workforce.get(today)!.constructorsOnRoster || null;

  const types = active.map((t) => {
    const own = quotas.filter((q) => q.shoeTypeId === t.id);
    const todayQuota = inForceOn(own, today);
    const pending = own.filter((q) => q.effectiveFrom > today).at(-1) ?? null;
    const dayHistory: DayHistory[] = history.days.map((d) => ({
      day: d.day,
      full: d.full,
      checkIns: d.checkIns,
      pairs: d.byType.find((b) => b.shoeTypeId === t.id)?.pairs ?? 0,
      constructorsPresent: d.constructorsPresent,
    }));
    const suggestion: Suggestion = suggestQuota(dayHistory, perDay, expected);
    return {
      shoeTypeId: t.id,
      name: t.name,
      today: todayQuota?.pairs ?? null,
      upcoming: pending ? { pairs: pending.pairs, from: pending.effectiveFrom } : null,
      /** A first quota applies from today (Dylan 5A); a change from tomorrow. */
      appliesFrom: effectiveFromFor(today, todayQuota === null),
      suggestion,
    };
  });

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
    scheduleHistory: [...schedules].reverse().map((s) => ({
      id: s.id,
      effectiveFrom: s.effectiveFrom,
      description: describeSchedule(s),
      setBy: s.createdBy?.name ?? "Default",
      setAt: s.createdAt.toISOString(),
    })),
    quotas: types,
    quotaHistory: [...quotas].reverse().map((q) => ({
      id: q.id,
      shoeType: q.shoeType.name,
      pairs: q.pairs,
      suggestedPairs: q.suggestedPairs,
      effectiveFrom: q.effectiveFrom,
      setBy: q.createdBy.name,
      setAt: q.createdAt.toISOString(),
    })),
  };
}

export type ProductionPlan = Awaited<ReturnType<typeof productionPlan>>;

/** A new schedule (D-083): always from tomorrow, so today's check-ins stay as they were. */
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
 * New daily quotas (D-085): a change applies from tomorrow; a shoe type's first quota from today
 * (Dylan 5A). A quota equal to the one that would be in force that day is skipped.
 */
export async function saveQuotas(input: QuotasInput, actor: Actor, now: Date = new Date()) {
  const today = manilaToday(now);
  const [active, quotas] = await Promise.all([listActiveShoeTypes(), listQuotas()]);
  const names = new Map(active.map((t) => [t.id, t.name]));
  const issues: { path: (string | number)[]; message: string }[] = [];
  const seen = new Set<string>();
  const plan: { shoeTypeId: string; pairs: number; suggestedPairs: number | null; from: string }[] =
    [];
  for (const q of input.quotas) {
    const name = names.get(q.shoeTypeId);
    if (!name) {
      issues.push({
        path: ["quotas", q.shoeTypeId],
        message: "That shoe type isn't active any more. Refresh the page.",
      });
      continue;
    }
    if (seen.has(q.shoeTypeId)) {
      issues.push({
        path: ["quotas", q.shoeTypeId],
        message: `${name} is in the list twice. Refresh the page and save again.`,
      });
      continue;
    }
    seen.add(q.shoeTypeId);
    const parsed = quotaPairsSchema(name).safeParse(q.pairs);
    if (!parsed.success) {
      issues.push({ path: ["quotas", q.shoeTypeId], message: parsed.error.issues[0].message });
      continue;
    }
    const own = quotas.filter((x) => x.shoeTypeId === q.shoeTypeId);
    const from = effectiveFromFor(today, inForceOn(own, today) === null);
    if (inForceOn(own, from)?.pairs === parsed.data) continue;
    plan.push({
      shoeTypeId: q.shoeTypeId,
      pairs: parsed.data as number,
      suggestedPairs: q.suggestedPairs ?? null,
      from,
    });
  }
  if (issues.length) throw Errors.validation(issues);
  if (plan.length === 0) return { saved: 0 };
  return runInTransaction(async (tx) => {
    for (const p of plan) {
      const row = await insertQuota(
        {
          shoeTypeId: p.shoeTypeId,
          pairs: p.pairs,
          suggestedPairs: p.suggestedPairs,
          effectiveFrom: p.from,
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
        before: {
          pairs:
            inForceOn(
              quotas.filter((x) => x.shoeTypeId === p.shoeTypeId),
              p.from,
            )?.pairs ?? null,
        },
        after: {
          shoeType: names.get(p.shoeTypeId),
          pairs: p.pairs,
          suggestedPairs: p.suggestedPairs,
          effectiveFrom: p.from,
        },
      });
    }
    return { saved: plan.length };
  });
}

// ───────────── check-ins ─────────────

/**
 * Every active shoe type needs a whole number at a check-in (D-084); a type that isn't active is
 * refused. Errors are keyed `counts.<shoeTypeId>` so the form puts each under its own field.
 */
function parseCounts(
  raw: { shoeTypeId: string; pairs?: unknown }[],
  active: ShoeTypeRef[],
  since: string,
): { shoeTypeId: string; pairs: number }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];
  const byId = new Map<string, unknown>();
  for (const c of raw) {
    if (byId.has(c.shoeTypeId)) {
      issues.push({
        path: ["counts", c.shoeTypeId],
        message: "A check-in can't have the same shoe type twice. Refresh the page.",
      });
      continue;
    }
    if (!active.some((t) => t.id === c.shoeTypeId)) {
      issues.push({
        path: ["counts", c.shoeTypeId],
        message:
          "That shoe type isn't active any more. Refresh the page and enter the count again.",
      });
      continue;
    }
    byId.set(c.shoeTypeId, c.pairs);
  }
  const out: { shoeTypeId: string; pairs: number }[] = [];
  for (const t of active) {
    const parsed = pairsSchema(t.name, since).safeParse(byId.get(t.id));
    if (parsed.success) out.push({ shoeTypeId: t.id, pairs: parsed.data as number });
    else issues.push({ path: ["counts", t.id], message: parsed.error.issues[0].message });
  }
  if (issues.length) throw Errors.validation(issues);
  return out;
}

function alreadyEntered(row: CheckInRow, time: string) {
  return Errors.stale(
    `${row.enteredBy.name} already entered the ${time} check-in at ${clockOf(row.enteredAt)}. Refresh to see it.`,
  );
}

/**
 * Who may enter or correct a check-in on a day (D-084, D-088): the Quality Inspector, or the Floor
 * Manager when that day's attendance shows no Quality Inspector present. 403 with the reason.
 */
async function assertMayEnter(actor: CheckInActor, day: string): Promise<{ covering: boolean }> {
  if (actor.role === "QUALITY_INSPECTOR") return { covering: false };
  const qiPresent = actor.role === "FLOOR_MANAGER" ? await qualityInspectorPresentOn(day) : null;
  const reason = checkInCoverReason(actor.role, qiPresent);
  if (reason) throw Errors.forbidden(reason);
  return { covering: true };
}

/**
 * The count at one scheduled check-in (D-084): the Quality Inspector, or the Floor Manager on a
 * day no Quality Inspector is present (D-088).
 */
export async function saveCheckIn(
  input: CheckInInput,
  actor: CheckInActor,
  now: Date = new Date(),
) {
  const slotAt = new Date(input.slotAt);
  const day = manilaDayOf(slotAt);
  const { covering } = await assertMayEnter(actor, day);
  const [schedules, active, workforce] = await Promise.all([
    listSchedules(),
    listActiveShoeTypes(),
    workforceByDay([day]),
  ]);
  const slot = slotsFor(scheduleRule(inForceOn(schedules, day)), day).find(
    (s) => s.at.getTime() === slotAt.getTime(),
  );
  if (!slot)
    throw Errors.conflict(
      `There's no ${clockOf(slotAt)} check-in on the schedule for ${formatAttendanceDay(day)}. Refresh the page.`,
    );
  const window = checkInWindow(slot, day, now);
  if (!window.ok) throw Errors.conflict(window.reason);
  const existing = await findCheckInBySlot(day, slotAt);
  if (existing) throw alreadyEntered(existing, slot.time);
  const counts = parseCounts(input.counts, active, slot.since);
  const wf = workforce.get(day)!;

  try {
    return await runInTransaction(async (tx) => {
      const row = await insertCheckIn(
        {
          day,
          slotAt,
          enteredAt: now,
          enteredById: actor.id,
          constructorsPresent: wf.constructorsPresent,
          constructorsOnRoster: wf.taken ? wf.constructorsOnRoster : null,
          notes: input.notes ?? null,
          counts,
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
          slot: slot.time,
          counts: countsForAudit(counts, active),
          constructorsPresent: wf.constructorsPresent,
          notes: input.notes ?? null,
          ...(covering ? { coveringForQualityInspector: true } : {}),
        },
      });
      return { id: row.id, time: slot.time };
    });
  } catch (error) {
    // Two people saving the same check-in at once: the unique slot decides, the second is stale.
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await findCheckInBySlot(day, slotAt);
      if (winner) throw alreadyEntered(winner, slot.time);
    }
    throw error;
  }
}

function countsForAudit(counts: { shoeTypeId: string; pairs: number }[], types: ShoeTypeRef[]) {
  return Object.fromEntries(
    counts.map((c) => [types.find((t) => t.id === c.shoeTypeId)?.name ?? c.shoeTypeId, c.pairs]),
  );
}

/** Correct a saved check-in the same Manila day, with a reason; both values go in the audit. */
export async function correctCheckIn(
  id: string,
  input: CorrectionInput,
  actor: CheckInActor,
  now: Date = new Date(),
) {
  const row = await findCheckIn(id);
  if (!row) throw Errors.notFound("This check-in");
  const day = dayString(row.day);
  const { covering } = await assertMayEnter(actor, day);
  if (day !== manilaToday(now))
    throw Errors.conflict(
      `A check-in can only be corrected on the same day. This one was for ${formatAttendanceDay(day)}.`,
    );
  if (row.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString())
    throw Errors.stale(
      row.correctedAt
        ? `This check-in was already corrected by ${row.correctedBy?.name ?? "someone"} at ${clockOf(row.correctedAt)}. Refresh to see it.`
        : "This check-in was changed by someone else. Refresh to see it.",
    );
  const [active, schedules] = await Promise.all([listActiveShoeTypes(), listSchedules()]);
  const slot = slotsFor(scheduleRule(inForceOn(schedules, day)), day).find(
    (s) => s.at.getTime() === row.slotAt.getTime(),
  );
  const since = slot?.since ?? timeOf(minutesOf(clockOf(row.slotAt)));
  const counts = parseCounts(input.counts, active, since);
  const types = await listAllShoeTypes();

  return runInTransaction(async (tx) => {
    const ok = await correctCheckInRow(
      id,
      row.updatedAt,
      { correctedAt: now, correctedById: actor.id, correctionReason: input.reason, counts },
      tx,
    );
    if (!ok) throw Errors.stale("This check-in was changed by someone else. Refresh to see it.");
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.checkin.correct",
      entity: "ProductionCheckIn",
      entityId: id,
      before: { counts: countsForAudit(row.counts, types) },
      after: {
        counts: countsForAudit(counts, types),
        reason: input.reason,
        ...(covering ? { coveringForQualityInspector: true } : {}),
      },
    });
    return { id, time: clockOf(row.slotAt) };
  });
}

// ───────────── reports ─────────────

/** Reports → Operations: pairs per day per shoe type against the quota (replaces stage times). */
export async function productionReport(range: ReportRange, now: Date = new Date()) {
  const { shoeTypes, days } = await productionDays(range.from, range.to, now);
  const pairs = days.reduce((s, d) => s + d.pairs, 0);
  const finished = days.filter((d) => d.day < manilaToday(now) && d.quota !== null);
  const quota = finished.reduce((s, d) => s + (d.quota ?? 0), 0);
  const quotaPairs = finished.reduce(
    (s, d) => s + d.byType.filter((t) => t.quota !== null).reduce((x, t) => x + t.pairs, 0),
    0,
  );
  return {
    shoeTypes,
    days,
    totals: {
      pairs,
      /** Pairs against the quota over finished days that had one. */
      share: quota > 0 ? quotaPairs / quota : null,
      daysBelow: finished.filter((d) => d.shortfall !== null).length,
      daysWithQuota: finished.length,
    },
  };
}

export type ProductionReport = Awaited<ReturnType<typeof productionReport>>;

const pct = (v: number | null) => (v === null ? "" : (Math.round(v * 1000) / 10).toFixed(1));

/** `production.csv`: one row per day and shoe type (replaces `stages.csv`). */
export async function productionCsv(range: ReportRange, now: Date = new Date()) {
  const { days } = await productionDays(range.from, range.to, now);
  const rows = days.flatMap((d) => d.byType.map((t) => ({ d, t })));
  return toCsv(rows, [
    { header: "Date (Manila)", value: (r) => r.d.day },
    { header: "Shoe type", value: (r) => r.t.label },
    { header: "Pairs finished", value: (r) => r.t.pairs },
    { header: "Daily quota", value: (r) => r.t.quota ?? "" },
    { header: "% of quota", value: (r) => pct(r.t.quota ? r.t.pairs / r.t.quota : null) },
    { header: "Check-ins entered", value: (r) => r.d.entered },
    { header: "Check-ins scheduled", value: (r) => r.d.checkIns },
    { header: "Shoe Constructors present", value: (r) => r.d.constructorsPresent ?? "" },
    { header: "Shoe Constructors on the roster", value: (r) => r.d.constructorsOnRoster },
    {
      header: "Pairs per constructor present (line average)",
      value: (r) => pairsPerConstructor(r.t.pairs, r.d.constructorsPresent) ?? "",
    },
    { header: "Day below quota", value: (r) => r.d.shortfall ?? "" },
  ]);
}
