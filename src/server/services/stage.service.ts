/**
 * Stages and work in progress (Phase 34, D-130): the Floor Manager says who works at which stage
 * each day (A-72, A-86), the constructors there (or the Floor Manager) count the pairs at their
 * stage, and the board shows each stage's count, its repairs and what waits for inspection.
 *
 * One shared number per stage, latest wins. Figures are per stage for the whole line (D-008): the
 * names that appear are who is assigned to a stage today, shown below the figures, never beside
 * them, and who entered a count is in the audit log only.
 */
import { appNow } from "@/lib/clock";
import type { Role } from "@/lib/domain";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { manilaToday } from "@/lib/format";
import { clockTime, queueState, isQueued } from "@/lib/production-rules";
import { addDays, manilaDayStart } from "@/lib/report-rules";
import {
  STAGES,
  parseStageCount,
  STAGE_LABEL,
  captureStageMessage,
  countReminderDue,
  latestCounts,
  leatherDefectsLine,
  mayCountStage,
  oneStagePerPerson,
  prefillAssignments,
  returnedRollsLine,
  waitingLine,
  wipTotals,
  type Assignment,
  type Stage,
} from "@/lib/repair-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import { listBatchRows, listDayPlans, listOpenBatchRows } from "@/server/models/production.model";
import { countOpenRolls } from "@/server/models/roll.model";
import { defectBreakdown } from "@/server/models/report.model";
import { listRepairsByStatus } from "@/server/models/repair.model";
import {
  insertCount,
  listActiveConstructors,
  listAssignments,
  listCaptureConstructors,
  listCounts,
  listStoredAssignments,
  replaceAssignments,
} from "@/server/models/stage.model";
import type { StageAssignmentsInput } from "@/server/validators/repair.validator";
import { getAttendanceDay } from "./attendance.service";
import { recordAudit } from "./audit.service";
import { foundAt } from "./report.service";
import { rollOutcomesByDay } from "./roll.service";

type Actor = { id: string; name?: string; role: Role };

// ───────────── who works where (the Plan dialog) ─────────────

/** How many working days the prefill looks back through (A-74). */
const PREFILL_LOOKBACK = 14;

/**
 * One day's stage assignments for the Plan dialog: the active constructors, who is ticked at each
 * stage, who was marked absent that day, and, for an empty day, the suggestion from the last
 * working day that had one (A-74: shown with a banner, stored only when saved). A constructor with
 * Capture access (`captureAccess`) is always at Preparation, locked, and is never in
 * `assignments` or the suggestion (Addendum 1, A-95): it is read from the flag, not stored.
 */
export async function stageAssignmentsFor(day: string, now: Date = appNow()) {
  const today = manilaToday(now);
  const [constructors, saved, plans, attendance] = await Promise.all([
    listActiveConstructors(),
    listStoredAssignments(day),
    listDayPlans(addDays(day, -PREFILL_LOOKBACK), day),
    getAttendanceDay(day, { role: "FLOOR_MANAGER" }, now),
  ]);
  const plan = plans.find((p) => p.day === day);
  const planned = plan?.kind === "PLANNED";
  const editable = planned && day >= today;
  const absent = new Set(
    attendance.taken ? attendance.roster.filter((p) => !p.present).map((p) => p.id) : [],
  );
  // Only constructors without Capture access can be suggested or ticked (A-95).
  const active = new Set(constructors.filter((c) => !c.canCapture).map((c) => c.id));
  let prefill: { from: string; label: string; assignments: Assignment[] } | null = null;
  if (saved.length === 0 && editable) {
    const working = new Set(plans.filter((p) => p.kind === "PLANNED").map((p) => p.day));
    const history = new Map<string, Assignment[]>();
    for (const d of working) {
      if (d >= day) continue;
      const rows = await listStoredAssignments(d);
      if (rows.length)
        history.set(
          d,
          rows.map((r) => ({ userId: r.userId, stage: r.stage })),
        );
    }
    const found = prefillAssignments(day, history, (d) => working.has(d), active);
    if (found) prefill = { ...found, label: formatAttendanceDay(found.from) };
  }
  const current = saved.map((r) => ({ userId: r.userId, stage: r.stage }));
  return {
    day,
    editable,
    /** Why it can't be changed, or null. */
    lockedReason: editable
      ? null
      : !planned
        ? "Plan the day first."
        : "This day has passed, so who worked where can't change.",
    constructors: constructors.map((c) => ({
      id: c.id,
      name: c.name,
      absent: absent.has(c.id),
      /** Has Capture access: at Preparation every working day, locked (A-95). */
      captureAccess: c.canCapture,
    })),
    assignments: current,
    prefill,
  };
}

export type StageAssignmentsView = Awaited<ReturnType<typeof stageAssignmentsFor>>;

/**
 * Saves who works at each stage on a day: today and later planned days, even after the plan locks;
 * a constructor is at one stage a day (A-86). Audit keeps the before and after.
 */
export async function saveStageAssignments(
  day: string,
  input: StageAssignmentsInput,
  actor: Actor,
  now: Date = appNow(),
) {
  const view = await stageAssignmentsFor(day, now);
  if (!view.editable) throw Errors.conflict(view.lockedReason ?? "This day can't change.");
  const active = new Map(view.constructors.map((c) => [c.id, c]));
  const flat: Assignment[] = [];
  for (const group of input.assignments)
    for (const userId of group.userIds) {
      if (!active.has(userId))
        throw Errors.validation([
          {
            path: ["assignments"],
            message: "Only active Shoe Constructors can be assigned. Refresh the page.",
          },
        ]);
      const person = active.get(userId)!;
      // A constructor with Capture access is at Preparation only (A-95): never anywhere else, and
      // at Preparation they are derived from the flag, so no row is stored for them.
      if (person.captureAccess && group.stage !== "PREPARATION")
        throw Errors.validation([
          { path: ["assignments"], message: captureStageMessage(person.name) },
        ]);
      if (!person.captureAccess) flat.push({ userId, stage: group.stage });
    }
  const next = oneStagePerPerson(flat);
  return runInTransaction(async (tx) => {
    await replaceAssignments(day, next, actor.id, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "stage.assign",
      entity: "StageAssignment",
      entityId: day,
      before: { day, assignments: view.assignments },
      after: { day, assignments: next },
    });
    return { day, saved: true, count: next.length };
  });
}

// ───────────── counts ─────────────

/** The count's number: a whole number from 0 (A-72). */
export const parseCount = parseStageCount;

/**
 * Saves the pairs at a stage now (A-72, A-73): one shared number, latest wins. The Floor Manager
 * may count any stage; a constructor only the stage they are assigned to today.
 */
export async function saveStageCount(
  input: { stage: Stage; pairs: unknown },
  actor: Actor,
  now: Date = appNow(),
) {
  const today = manilaToday(now);
  const assigned = await listAssignments(today);
  if (!mayCountStage(actor, input.stage, assigned))
    throw Errors.forbidden(
      actor.role === "SHOE_CONSTRUCTOR"
        ? `You are not assigned to ${STAGE_LABEL[input.stage]} today. Ask the Floor Manager.`
        : "Only the Floor Manager and the constructors assigned to a stage can count it.",
    );
  const parsed = parseCount(input.pairs);
  if (!parsed.ok) throw Errors.validation([{ path: ["pairs"], message: parsed.message }]);
  // The batch whose interval holds the moment of the count, null outside the shift.
  const rows = await listBatchRows(today, today);
  const batch = rows.find(
    (b) => now.getTime() >= b.startAt.getTime() && now.getTime() < b.slotAt.getTime(),
  );
  return runInTransaction(async (tx) => {
    const row = await insertCount(
      {
        day: today,
        stage: input.stage,
        pairs: parsed.pairs,
        enteredById: actor.id,
        enteredAt: now,
        batchId: batch?.id ?? null,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "stage.count",
      entity: "StageCount",
      entityId: row.id,
      after: { day: today, stage: input.stage, pairs: parsed.pairs, batch: batch?.code ?? null },
    });
    return { stage: input.stage, pairs: parsed.pairs, at: clockTime(now) };
  });
}

// ───────────── My stage (Capture) ─────────────

/** "Last counted 14:05 for all of Sole-ing" */
const lastCountedLine = (stage: Stage, at: Date | null) =>
  at ? `Last counted ${clockTime(at)} for all of ${STAGE_LABEL[stage]}` : "Not counted today";

/**
 * The constructor's own stage today (A-73): the shared count, the repairs at the stage, and a
 * reminder when a batch ended since the last count. Null when they aren't assigned. Reads only the
 * viewer's stage, never another person's.
 */
export async function myStage(viewer: { id: string }, now: Date = appNow()) {
  const today = manilaToday(now);
  const assigned = await listAssignments(today);
  const mine = assigned.find((a) => a.userId === viewer.id);
  if (!mine) return null;
  const [counts, repairs, batches, capture] = await Promise.all([
    listCounts(today, today),
    listRepairsByStatus(["AT_STAGE"]),
    listBatchRows(today, today),
    listCaptureConstructors(),
  ]);
  const current = latestCounts(counts, today).get(mine.stage) ?? null;
  const reminder = countReminderDue(
    current?.enteredAt ?? null,
    batches.filter((b) => b.status !== "VOID").map((b) => ({ code: b.code, slotAt: b.slotAt })),
    now,
  );
  return {
    stage: mine.stage,
    label: STAGE_LABEL[mine.stage],
    /** Has Capture access, so the stage is always Preparation (Addendum 1, A-95). */
    captureAccess: capture.some((c) => c.id === viewer.id),
    pairs: current?.pairs ?? null,
    lastCounted: lastCountedLine(mine.stage, current?.enteredAt ?? null),
    reminder: reminder ? `${reminder.code} just ended. Update the count.` : null,
    repairs: repairs
      .filter((r) => r.stage === mine.stage)
      .map((r) => ({
        id: r.id,
        code: r.code,
        pairs: r.pairs,
        defect: r.finding.finalDefectType.label,
        batchCode: r.finding.checkIn.batch?.code ?? "",
      })),
  };
}

export type MyStage = NonNullable<Awaited<ReturnType<typeof myStage>>>;

// ───────────── the board (Batches → Work in progress) ─────────────

export type StageCard = {
  stage: Stage;
  label: string;
  /** The count now, or null when not counted today. */
  pairs: number | null;
  /** "as of 14:05", or "Not counted today". */
  asOf: string;
  /** Pairs in repair at this stage and what they are for ("Lifted sole ×2"). */
  repairPairs: number;
  repairDefects: string[];
  repairs: { id: string; code: string; pairs: number; defect: string }[];
  /** "Assigned today: Ana, Ben", below the figures; null when nobody is. */
  assigned: string | null;
};

/**
 * What the camera found on the raw leather rolls finished today (Phase 38, D-136, A-113), the same
 * count as Reports → Rolls: rolls per leather defect type, never sections. These are the leather
 * defects, a different list from the final shoe defects checked after Preparation (A-62, A-66).
 */
export type LeatherDefects = {
  rows: { key: string; label: string; rolls: number }[];
  /** "Scratch 9, Crease 7", or empty when the camera found nothing. */
  line: string;
  /** "Returned to supplier: 2 rolls.", or null when none came back today. */
  returnedLine: string | null;
};

/** The Preparation card's roll figures: rolls being scanned and scanned today, and the camera's defects. */
export type PreparationRolls = {
  beingScanned: number;
  scannedToday: number;
  leatherDefects: LeatherDefects;
};

/**
 * The work in progress board (Phase 34, A-72): each stage in line order with its count, its
 * repairs and who is assigned today, and what waits for inspection. Counts are per stage; no
 * person's name is ever beside a number.
 */
export async function wipBoard(viewer: { role: Role }, now: Date = appNow()) {
  const today = manilaToday(now);
  const todayRange = { start: manilaDayStart(today), end: manilaDayStart(addDays(today, 1)) };
  const [assigned, counts, atStage, back, open, outcomes, beingScanned, defects] =
    await Promise.all([
      listAssignments(today),
      listCounts(today, today),
      listRepairsByStatus(["AT_STAGE"]),
      listRepairsByStatus(["BACK_FOR_INSPECTION"]),
      listOpenBatchRows(),
      rollOutcomesByDay(today, today),
      countOpenRolls(),
      foundAt().then((found) => defectBreakdown(todayRange, found)),
    ]);
  const todayRolls = outcomes.get(today) ?? { scanned: 0, returned: 0 };
  const leatherDefects: LeatherDefects = {
    rows: defects.map((d) => ({ key: d.key, label: d.label, rolls: d.rolls })),
    line: leatherDefectsLine(defects),
    returnedLine: returnedRollsLine(todayRolls.returned),
  };
  const latest = latestCounts(counts, today);
  const cards: StageCard[] = STAGES.map((stage) => {
    const c = latest.get(stage) ?? null;
    const jobs = atStage.filter((r) => r.stage === stage);
    const byDefect = new Map<string, number>();
    for (const j of jobs)
      byDefect.set(
        j.finding.finalDefectType.label,
        (byDefect.get(j.finding.finalDefectType.label) ?? 0) + j.pairs,
      );
    const names = assigned.filter((a) => a.stage === stage).map((a) => a.name);
    return {
      stage,
      label: STAGE_LABEL[stage],
      pairs: c?.pairs ?? null,
      asOf: c ? `as of ${clockTime(c.enteredAt)}` : "Not counted today",
      repairPairs: jobs.reduce((s, j) => s + j.pairs, 0),
      repairDefects: [...byDefect].map(([label, n]) => `${label} ×${n}`),
      repairs: jobs.map((j) => ({
        id: j.id,
        code: j.code,
        pairs: j.pairs,
        defect: j.finding.finalDefectType.label,
      })),
      assigned: names.length ? `Assigned today: ${names.join(", ")}` : null,
    };
  });
  const waitingBatches = open.filter((r) => isQueued(queueState(r, now))).length;
  return {
    day: today,
    cards,
    preparation: {
      beingScanned,
      scannedToday: todayRolls.scanned,
      leatherDefects,
    } satisfies PreparationRolls,
    waiting: {
      batches: waitingBatches,
      repairs: back.length,
      line: waitingLine(waitingBatches, back.length),
    },
    /** The Floor Manager may update any stage's count and change a repair. */
    canCount: viewer.role === "FLOOR_MANAGER",
    canManageRepairs: viewer.role === "FLOOR_MANAGER",
  };
}

export type WipBoard = Awaited<ReturnType<typeof wipBoard>>;

// ───────────── Reports → Operations: work in progress ─────────────

/**
 * Per stage the days counted and the average, highest and latest of each day's last count, and per
 * day the last count at each stage. Stage totals only (D-008).
 */
export async function wipReport(range: { from: string; to: string }) {
  const rows = await listCounts(range.from, range.to);
  const totals = wipTotals(rows);
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const perDay = days.map((day) => {
    const latest = latestCounts(rows, day);
    return {
      day,
      label: formatAttendanceDay(day),
      counts: Object.fromEntries(STAGES.map((s) => [s, latest.get(s)?.pairs ?? null])) as Record<
        Stage,
        number | null
      >,
    };
  });
  const top = Math.max(0, ...totals.map((t) => t.average ?? 0));
  return {
    stages: totals.map((t) => ({
      ...t,
      label: STAGE_LABEL[t.stage],
      /** 0 to 1 against the busiest stage, for the bar list (the bottleneck view). */
      barShare: top > 0 && t.average !== null ? t.average / top : 0,
    })),
    perDay,
    counted: days.length,
  };
}

export type WipReport = Awaited<ReturnType<typeof wipReport>>;
