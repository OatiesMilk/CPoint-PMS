/**
 * The Inspection queue (Phase 33, D-129; the panel's revision 2). Every batch has a code
 * (B-261116-2) and waits here from its end until it is inspected or voided, across days: Urgent
 * first, then the one that has waited longest (A-58). Only what people did is stored (open, being
 * inspected, inspected, void); Waiting and Late come from the clock, so the demo clock moves them.
 *
 * Figures stay per batch for the whole line (D-008). The names shown are who is inspecting a batch
 * now, who marked it Urgent and who voided it: log-book facts, never totalled.
 */
import { appNow } from "@/lib/clock";
import type { Role } from "@/lib/domain";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { manilaToday } from "@/lib/format";
import {
  batchRollsLine,
  batchTimes,
  clockTime,
  compareQueue,
  finishOpensAt,
  isQueued,
  manilaDayOf,
  queueState,
  waitingFor,
  QUEUE_STATE_LABELS,
  type QueueState,
} from "@/lib/production-rules";
import { addDays } from "@/lib/report-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  findBatch,
  findBatchBySlot,
  listDoneBatchRows,
  listOpenBatchRows,
  updateBatch,
  type BatchRow,
} from "@/server/models/production.model";
import { listRollsFinishedWithItem } from "@/server/models/roll.model";
import {
  insertRepair,
  listFinishedRepairs,
  listRepairsByStatus,
  repairCodesWithPrefix,
  transitionRepair,
  findRepair,
  type RepairRow,
} from "@/server/models/repair.model";
import {
  REPAIR_STATUS_LABEL,
  STAGE_LABEL,
  compareWaiting,
  nextRepairSeq,
  nextRepairState,
  parseRepairResult,
  repairCodeForBatch,
  type Stage,
} from "@/lib/repair-rules";
import type { RepairInspectInput } from "@/server/validators/repair.validator";
import { findingsForCheckIns, type CheckInFindings } from "./repair.service";
import { can, checkInCoverReason, mayEnterCheckIns } from "@/server/policies/permissions";
import type {
  PriorityInput,
  QueueQuery,
  StartInspectionInput,
  VoidBatchInput,
} from "@/server/validators/production.validator";
import { qualityInspectorPresentOn } from "./attendance.service";
import { recordAudit } from "./audit.service";
import { assertMayEnter, ensureBatchRows } from "./production.service";

type Actor = { id: string; name?: string; role: Role };

/** Done batches shown under the queue: inspected or voided in the last 7 days. */
export const DONE_DAYS = 7;
/** How far back the queue makes missing rows on read (older days are made by Recent days). */
const QUEUE_LOOKBACK_DAYS = 31;

export type QueueItem = {
  id: string;
  code: string;
  day: string;
  /** "Mon, 16 Nov 2026" */
  dayLabel: string;
  /** "12:00–15:00" */
  times: string;
  state: QueueState;
  stateLabel: string;
  priority: "NORMAL" | "URGENT";
  priorityReason: string | null;
  priorityBy: string | null;
  /** "Waiting 3 hours 10 minutes", while it waits. */
  waiting: string | null;
  /** "6 rolls (Full-grain black ×4, Suede brown ×2)" */
  rolls: string;
  inspectingBy: string | null;
  inspectingSince: string | null;
  /** The person looking started this inspection. */
  inspectingByMe: boolean;
  finished: {
    checkInId: string;
    updatedAt: string;
    pairs: number;
    failedPairs: number;
    by: string;
    at: string;
    /** Inspected today, so it can still be corrected (Phase 33, until Phase 35). */
    correctable: boolean;
    /** What was wrong with the failed pairs, and whether it can change (Phase 34). */
    findings: CheckInFindings;
  } | null;
  voidReason: string | null;
  voidedBy: string | null;
  /** Finish batch is open for it (from 10 minutes before its end). */
  canFinish: boolean;
  updatedAt: string;
};

/** Rolls finished inside each batch, by leather (A-83), in one query over the batches' span. */
async function rollsByBatch(rows: BatchRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;
  const start = new Date(Math.min(...rows.map((r) => r.startAt.getTime())));
  const end = new Date(Math.max(...rows.map((r) => r.slotAt.getTime())));
  const rolls = await listRollsFinishedWithItem(start, end);
  for (const r of rows) {
    const inside = rolls.filter(
      (x) =>
        x.finishedAt.getTime() >= r.startAt.getTime() &&
        x.finishedAt.getTime() < r.slotAt.getTime(),
    );
    out.set(r.id, batchRollsLine(inside));
  }
  return out;
}

const noFindings: CheckInFindings = { lines: [], summary: [], lockedReason: null };

function toItem(
  r: BatchRow,
  rolls: string,
  viewerId: string,
  now: Date,
  findings: Map<string, CheckInFindings> = new Map(),
): QueueItem {
  const state = queueState(r, now);
  const lunchFree = { startTime: clockTime(r.startAt), time: clockTime(r.slotAt), lunch: null };
  return {
    id: r.id,
    code: r.code,
    day: r.day,
    dayLabel: formatAttendanceDay(r.day),
    times: batchTimes(lunchFree),
    state,
    stateLabel: QUEUE_STATE_LABELS[state],
    priority: r.priority,
    priorityReason: r.priorityReason,
    priorityBy: r.priority === "URGENT" ? (r.prioritySetBy?.name ?? null) : null,
    waiting:
      state === "WAITING" || state === "LATE" || state === "INSPECTING"
        ? waitingFor(r.slotAt, now)
        : null,
    rolls,
    inspectingBy: r.status === "INSPECTING" ? (r.inspectionStartedBy?.name ?? "Someone") : null,
    inspectingSince:
      r.status === "INSPECTING" && r.inspectionStartedAt
        ? manilaDayOf(r.inspectionStartedAt) === manilaDayOf(now)
          ? clockTime(r.inspectionStartedAt)
          : `${formatAttendanceDay(manilaDayOf(r.inspectionStartedAt))} ${clockTime(r.inspectionStartedAt)}`
        : null,
    inspectingByMe: r.status === "INSPECTING" && r.inspectionStartedById === viewerId,
    finished: r.checkIn
      ? {
          checkInId: r.checkIn.id,
          updatedAt: r.checkIn.updatedAt.toISOString(),
          correctable: manilaDayOf(r.checkIn.enteredAt) === manilaDayOf(now),
          findings: findings.get(r.checkIn.id) ?? noFindings,
          pairs: r.checkIn.pairs,
          failedPairs: r.checkIn.failedPairs,
          by: r.checkIn.enteredBy.name,
          at: `${formatAttendanceDay(manilaDayOf(r.checkIn.enteredAt))} ${clockTime(r.checkIn.enteredAt)}`,
        }
      : null,
    voidReason: r.voidReason,
    voidedBy: r.status === "VOID" ? (r.voidedBy?.name ?? null) : null,
    canFinish:
      (r.status === "OPEN" || r.status === "INSPECTING") &&
      now.getTime() >= finishOpensAt({ at: r.slotAt }).getTime(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const matches = (item: QueueItem, q: QueueQuery) =>
  (!q.day || item.day === q.day) &&
  (!q.priority || item.priority === q.priority) &&
  (!q.status ||
    (q.status === "INSPECTING" ? item.state === "INSPECTING" : item.state === q.status)) &&
  (!q.q || item.code.toUpperCase().includes(q.q.toUpperCase()));

/**
 * Batches → Queue: every batch waiting or being inspected, across days, in queue order, and the
 * batches inspected or voided in the last 7 days below it. Filters by day, status, priority and a
 * code (A-58). Rows missing for the last month are made first (old data gets codes too).
 */
export async function inspectionQueue(
  viewer: { id: string; role: Role },
  query: QueueQuery = {},
  now: Date = appNow(),
) {
  const today = manilaToday(now);
  await ensureBatchRows(addDays(today, -QUEUE_LOOKBACK_DAYS), today, now);
  const doneFrom = addDays(today, -DONE_DAYS);
  const [open, done, qiPresent] = await Promise.all([
    listOpenBatchRows(),
    listDoneBatchRows(doneFrom),
    qualityInspectorPresentOn(today),
  ]);
  // Only batches whose end has come are in the queue; upcoming ones are on the Today tab.
  const queuedRows = open.filter((r) => isQueued(queueState(r, now)));
  const rolls = await rollsByBatch([...queuedRows, ...done]);
  const findings = await findingsForCheckIns(
    done.flatMap((r) => (r.checkIn ? [r.checkIn.id] : [])),
  );
  const all = queuedRows
    .slice()
    .sort(compareQueue)
    .map((r) => toItem(r, rolls.get(r.id) ?? "", viewer.id, now));
  const waiting = all.filter((i) => matches(i, query));
  const repairRows = await repairQueue(query, now);
  const finished = done
    .map((r) => toItem(r, rolls.get(r.id) ?? "", viewer.id, now, findings))
    .filter((i) => (!query.day || i.day === query.day) && (!query.q || matches(i, { q: query.q })));
  const days = [...new Set(all.map((i) => i.day))].sort();
  return {
    today,
    waiting,
    done: finished,
    /** Repairs back for inspection and the ones inspected in the last 7 days (Phase 34). */
    repairs: repairRows.waiting,
    repairsDone: repairRows.done,
    /** Repairs waiting before the filters; they are not in the tab title's due count (A-90). */
    repairsTotal: repairRows.total,
    /** Counts before the filters, for the tab badge and the empty state. */
    total: all.length,
    urgent: all.filter((i) => i.priority === "URGENT").length,
    late: all.filter((i) => i.state === "LATE").length,
    /** Days that have a batch in the queue, for the day filter. */
    days: days.map((d) => ({ day: d, label: formatAttendanceDay(d) })),
    filters: query,
    /** May this viewer start and finish inspections today (D-088, A-82)? */
    canInspect: mayEnterCheckIns(viewer.role, qiPresent),
    inspectNote: checkInCoverReason(viewer.role, qiPresent),
    /** May this viewer mark Urgent and void (A-58, A-84)? */
    canPrioritise: can(viewer.role, "production:prioritise"),
  };
}

export type InspectionQueue = Awaited<ReturnType<typeof inspectionQueue>>;

export type RepairItem = {
  id: string;
  code: string;
  /** The batch it came from, B-261120-2. */
  batchCode: string;
  defect: string;
  note: string | null;
  pairs: number;
  stage: Stage;
  stageLabel: string;
  statusLabel: string;
  /** When it came back (ISO), and its Manila day. */
  backAt: string | null;
  day: string | null;
  dayLabel: string | null;
  /** "Waiting 2 hours 5 minutes", while it waits. */
  waiting: string | null;
  /** A repair that was inspected: what happened to its pairs. */
  result: { passedPairs: number; scrappedPairs: number; resentPairs: number; at: string } | null;
};

function toRepairItem(r: RepairRow, now: Date): RepairItem {
  const day = r.backAt ? manilaDayOf(r.backAt) : null;
  return {
    id: r.id,
    code: r.code,
    batchCode: r.finding.checkIn.batch?.code ?? "",
    defect: r.finding.finalDefectType.label,
    note: r.finding.note,
    pairs: r.pairs,
    stage: r.stage,
    stageLabel: STAGE_LABEL[r.stage],
    statusLabel: REPAIR_STATUS_LABEL[r.status],
    backAt: r.backAt?.toISOString() ?? null,
    day,
    dayLabel: day ? formatAttendanceDay(day) : null,
    waiting: r.status === "BACK_FOR_INSPECTION" && r.backAt ? waitingFor(r.backAt, now) : null,
    result:
      r.status === "DONE" && r.inspectedAt
        ? {
            passedPairs: r.passedPairs ?? 0,
            scrappedPairs: r.scrappedPairs ?? 0,
            resentPairs: r.resentPairs ?? 0,
            at: `${formatAttendanceDay(manilaDayOf(r.inspectedAt))} ${clockTime(r.inspectedAt)}`,
          }
        : null,
  };
}

/**
 * Repairs in the queue (Phase 34, A-65, A-90): the ones back for inspection, longest wait first,
 * and the ones inspected in the last 7 days. No due time, so never Late. The day filter uses the
 * day the repair came back; Urgent and Waiting filters are about batches, so a repair shows for
 * "Waiting" and not for Late, Inspecting or Urgent.
 */
async function repairQueue(query: QueueQuery, now: Date) {
  const doneFrom = new Date(now.getTime() - DONE_DAYS * 86_400_000);
  const [back, finished] = await Promise.all([
    listRepairsByStatus(["BACK_FOR_INSPECTION"]),
    listFinishedRepairs(doneFrom),
  ]);
  const items = back
    .slice()
    .sort((a, b) =>
      compareWaiting(
        { urgent: false, since: a.backAt ?? a.sentAt, code: a.code },
        { urgent: false, since: b.backAt ?? b.sentAt, code: b.code },
      ),
    )
    .map((r) => toRepairItem(r, now));
  const applies = !query.priority && (!query.status || query.status === "WAITING");
  const keep = (i: RepairItem) =>
    (!query.day || i.day === query.day) &&
    (!query.q || i.code.toUpperCase().includes(query.q.toUpperCase()));
  return {
    total: items.length,
    waiting: applies ? items.filter(keep) : [],
    done: finished
      .map((r) => toRepairItem(r, now))
      .filter((i) => (!query.q || keep(i)) && !query.priority),
  };
}

async function loadOpen(id: string): Promise<BatchRow> {
  const row = await findBatch(id);
  if (!row) throw Errors.notFound("This batch");
  return row;
}

function assertSeen(row: BatchRow, expected: string) {
  if (row.updatedAt.toISOString() !== new Date(expected).toISOString())
    throw Errors.stale(`${row.code} was changed by someone else. Refresh to see it.`);
}

function closedReason(row: BatchRow): string | null {
  if (row.status === "INSPECTED") return `${row.code} is already inspected.`;
  if (row.status === "VOID") return `${row.code} was voided. It isn't in the queue.`;
  return null;
}

/**
 * Start inspection (A-60, optional): marks the batch as being inspected by this person, so a
 * second inspector sees "Being inspected by …" and takes another one.
 */
export async function startInspection(
  id: string,
  input: StartInspectionInput,
  actor: Actor,
  now: Date = appNow(),
) {
  await assertMayEnter(actor, manilaToday(now));
  const row = await loadOpen(id);
  const closed = closedReason(row);
  if (closed) throw Errors.conflict(closed);
  if (row.status === "INSPECTING") {
    if (row.inspectionStartedById === actor.id) return { id, code: row.code, started: false };
    throw Errors.conflict(
      `${row.inspectionStartedBy?.name ?? "Someone"} is already inspecting ${row.code} (since ${
        row.inspectionStartedAt ? clockTime(row.inspectionStartedAt) : "earlier"
      }). Pick another batch.`,
    );
  }
  if (now.getTime() < finishOpensAt({ at: row.slotAt }).getTime())
    throw Errors.conflict(
      `${row.code} can be inspected from ${clockTime(finishOpensAt({ at: row.slotAt }))}.`,
    );
  assertSeen(row, input.expectedUpdatedAt);
  return runInTransaction(async (tx) => {
    const ok = await updateBatch(
      id,
      row.updatedAt,
      ["OPEN"],
      { status: "INSPECTING", inspectionStartedAt: now, inspectionStartedById: actor.id },
      tx,
    );
    if (!ok) throw Errors.stale(`${row.code} was changed by someone else. Refresh to see it.`);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.batch.start",
      entity: "ProductionBatch",
      entityId: id,
      before: { status: row.status },
      after: { code: row.code, status: "INSPECTING" },
    });
    return { id, code: row.code, started: true };
  });
}

/** The Floor Manager marks a waiting batch Urgent with a reason, or sets it back to Normal (A-58). */
export async function setBatchPriority(
  id: string,
  input: PriorityInput,
  actor: Actor,
  now: Date = appNow(),
) {
  const row = await loadOpen(id);
  const closed = closedReason(row);
  if (closed) throw Errors.conflict(closed);
  if (now.getTime() < row.startAt.getTime())
    throw Errors.conflict(`${row.code} hasn't started yet. Mark it Urgent once it has started.`);
  assertSeen(row, input.expectedUpdatedAt);
  if (row.priority === input.priority && input.priority === "NORMAL")
    return { id, code: row.code, saved: false };
  const reason = input.priority === "URGENT" ? input.reason : null;
  return runInTransaction(async (tx) => {
    const ok = await updateBatch(
      id,
      row.updatedAt,
      ["OPEN", "INSPECTING"],
      input.priority === "URGENT"
        ? {
            priority: "URGENT",
            priorityReason: reason,
            prioritySetAt: now,
            prioritySetById: actor.id,
          }
        : {
            priority: "NORMAL",
            priorityReason: null,
            prioritySetAt: now,
            prioritySetById: actor.id,
          },
      tx,
    );
    if (!ok) throw Errors.stale(`${row.code} was changed by someone else. Refresh to see it.`);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.batch.priority",
      entity: "ProductionBatch",
      entityId: id,
      before: { priority: row.priority, reason: row.priorityReason },
      after: { code: row.code, priority: input.priority, reason },
    });
    return { id, code: row.code, saved: true };
  });
}

/**
 * The Floor Manager voids a batch that won't be inspected (A-59: no pairs made, the line stopped),
 * with a reason. It leaves the queue and shows under Done as Void.
 */
export async function voidBatch(
  id: string,
  input: VoidBatchInput,
  actor: Actor,
  now: Date = appNow(),
) {
  const row = await loadOpen(id);
  const closed = closedReason(row);
  if (closed) throw Errors.conflict(closed);
  if (now.getTime() < row.startAt.getTime())
    throw Errors.conflict(
      `${row.code} hasn't started yet. Change the day's plan instead of voiding it.`,
    );
  assertSeen(row, input.expectedUpdatedAt);
  return runInTransaction(async (tx) => {
    const ok = await updateBatch(
      id,
      row.updatedAt,
      ["OPEN", "INSPECTING"],
      { status: "VOID", voidReason: input.reason, voidedAt: now, voidedById: actor.id },
      tx,
    );
    if (!ok) throw Errors.stale(`${row.code} was changed by someone else. Refresh to see it.`);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "production.batch.void",
      entity: "ProductionBatch",
      entityId: id,
      before: { status: row.status },
      after: { code: row.code, status: "VOID", reason: input.reason },
    });
    return { id, code: row.code, saved: true };
  });
}

/** A queued batch by its day and end, for the demo week (Phase 33). */
export async function queuedBatchAt(day: string, slotAt: Date) {
  const row = await findBatchBySlot(day, slotAt);
  return row ? { id: row.id, code: row.code, updatedAt: row.updatedAt.toISOString() } : null;
}

/**
 * Inspect a repair that is back (Phase 34, A-64, A-88): the QI enters the pairs that passed, the
 * pairs scrapped and the pairs sent back again (with the stage of each), adding up to the job's
 * pairs. Sent back again makes a child job at its stage with the next number; there is no limit.
 * Passed pairs count on today's quota. Who may inspect follows batches (A-82).
 */
export async function inspectRepair(
  id: string,
  input: RepairInspectInput,
  actor: Actor,
  now: Date = appNow(),
) {
  await assertMayEnter(actor, manilaToday(now));
  const job = await findRepair(id);
  if (!job) throw Errors.notFound("This repair");
  const step = nextRepairState(job.status, "inspect");
  if (!step.ok) throw Errors.conflict(`${job.code}: ${step.reason} Refresh to see it.`);
  const parsed = parseRepairResult(job.pairs, input);
  if (!parsed.ok) {
    const details: { path: string[]; message: string }[] = [];
    if (parsed.passedPairs) details.push({ path: ["passedPairs"], message: parsed.passedPairs });
    if (parsed.scrappedPairs)
      details.push({ path: ["scrappedPairs"], message: parsed.scrappedPairs });
    for (const [i, message] of Object.entries(parsed.resend ?? {}))
      details.push({ path: ["resend", i], message });
    if (parsed.form) details.push({ path: ["result"], message: parsed.form });
    throw Errors.validation(details);
  }
  const { passedPairs, scrappedPairs, resend } = parsed.result;
  const resentPairs = resend.reduce((s, r) => s + r.pairs, 0);
  return runInTransaction(async (tx) => {
    const ok = await transitionRepair(
      id,
      ["BACK_FOR_INSPECTION"],
      {
        status: "DONE",
        inspectedAt: now,
        inspectedById: actor.id,
        passedPairs,
        scrappedPairs,
        resentPairs,
      },
      tx,
    );
    if (!ok) throw Errors.stale(`${job.code} was changed by someone else. Refresh to see it.`);
    const batchCode = job.finding.checkIn.batch?.code ?? "";
    const prefix = repairCodeForBatch(batchCode, 0).slice(0, -1);
    let seq = nextRepairSeq(await repairCodesWithPrefix(prefix, tx));
    const children: { code: string; pairs: number; stage: Stage }[] = [];
    for (const line of resend) {
      const code = repairCodeForBatch(batchCode, seq++);
      const child = await insertRepair(
        {
          code,
          findingId: job.finding.id,
          parentId: job.id,
          pairs: line.pairs,
          stage: line.stage,
          sentAt: now,
        },
        tx,
      );
      children.push({ code, pairs: line.pairs, stage: line.stage });
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action: "repair.create",
        entity: "RepairJob",
        entityId: child.id,
        after: { code, from: job.code, batch: batchCode, pairs: line.pairs, stage: line.stage },
      });
    }
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "repair.inspect",
      entity: "RepairJob",
      entityId: id,
      before: { status: job.status },
      after: {
        code: job.code,
        status: "DONE",
        passedPairs,
        scrappedPairs,
        resentPairs,
        sentBackAs: children.map((c) => c.code),
      },
    });
    return { id, code: job.code, passedPairs, scrappedPairs, children };
  });
}
