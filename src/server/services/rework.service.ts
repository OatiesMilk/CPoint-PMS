import type { ReworkStatus } from "@/lib/domain";
import { planReworkMove, type ReworkMove } from "@/lib/outcome-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  countReworkByStatus,
  findReworkTicket,
  listReworkTickets,
  transitionReworkTicket,
  type ReworkRow,
} from "@/server/models/outcome.model";
import { recordAudit } from "./audit.service";

const DONE_WINDOW_MS = 7 * 24 * 3_600_000;
const STALE = "Someone else already moved this repair. Refresh the board.";

export type ReworkCard = {
  id: string;
  status: ReworkStatus;
  scanId: string;
  sequence: number;
  hasImage: boolean;
  batchId: string;
  batchCode: string;
  defect: { label: string; confidence: number } | null;
  openedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
};

function toCard(row: ReworkRow): ReworkCard {
  const top = row.scan.detections[0];
  return {
    id: row.id,
    status: row.status,
    scanId: row.scan.id,
    sequence: row.scan.sequence,
    hasImage: !!row.scan.imagePath,
    batchId: row.scan.batch.id,
    batchCode: row.scan.batch.code,
    defect: top
      ? { label: top.defectType?.label ?? top.rawClassKey, confidence: top.confidence }
      : null,
    openedAt: row.openedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedBy: row.completedBy?.name ?? null,
    notes: row.notes,
  };
}

export async function reworkBoard(batchCode?: string, now: Date = new Date()) {
  const [waiting, inProgress, done] = await Promise.all([
    listReworkTickets({ status: "OPEN", batchCode }),
    listReworkTickets({ status: "IN_PROGRESS", batchCode }),
    listReworkTickets({
      status: "DONE",
      batchCode,
      completedSince: new Date(now.getTime() - DONE_WINDOW_MS),
    }),
  ]);
  return {
    waiting: waiting.map(toCard),
    inProgress: inProgress.map(toCard),
    done: done.map(toCard),
    /** The instant the board was read, so wait times on the page match the data. */
    now: now.getTime(),
  };
}

/** Counts for the Floor Manager home: what's at the repair station and the longest wait. */
export async function reworkSummary(now: Date = new Date()) {
  const groups = await countReworkByStatus({ status: { in: ["OPEN", "IN_PROGRESS"] } });
  const open = groups.find((g) => g.status === "OPEN");
  const inProgress = groups.find((g) => g.status === "IN_PROGRESS");
  return {
    waiting: open?._count._all ?? 0,
    inProgress: inProgress?._count._all ?? 0,
    oldestWaitMs: open?._min.openedAt ? now.getTime() - open._min.openedAt.getTime() : null,
  };
}

const AUDIT: Record<ReworkMove, string> = {
  start: "rework.start",
  done: "rework.done",
  reopen: "rework.reopen",
  unstart: "rework.unstart",
};

export async function moveReworkTicket(
  id: string,
  input: { move: ReworkMove; expectedStatus: ReworkStatus; note?: string },
  actor: { id: string },
  now: Date = new Date(),
) {
  const ticket = await findReworkTicket(id);
  if (!ticket) throw Errors.notFound("This repair");
  if (ticket.status !== input.expectedStatus) throw Errors.stale(STALE);
  const plan = planReworkMove(ticket, ticket.scan.batch.status, input.move);
  if (!plan.ok) throw Errors.conflict(plan.reason);

  const data =
    input.move === "start"
      ? { status: plan.to, startedAt: now }
      : input.move === "done"
        ? {
            status: plan.to,
            completedAt: now,
            completedById: actor.id,
            notes: input.note ?? ticket.notes,
          }
        : input.move === "reopen"
          ? { status: plan.to, completedAt: null, completedById: null }
          : { status: plan.to, startedAt: null };

  await runInTransaction(async (tx) => {
    if (!(await transitionReworkTicket(id, ticket.status, data, tx))) throw Errors.stale(STALE);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT[input.move],
      entity: "ReworkTicket",
      entityId: id,
      before: { status: ticket.status },
      after: {
        status: plan.to,
        batch: ticket.scan.batch.code,
        section: ticket.scan.sequence,
        note: input.note ?? null,
      },
    });
  });
  return { id, status: plan.to, batchCode: ticket.scan.batch.code, sequence: ticket.scan.sequence };
}
