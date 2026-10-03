import { STAGE_ORDER, type Stage } from "@/lib/domain";
import { manilaYear } from "@/lib/format";
import {
  availableActions,
  planCancel,
  planTransition,
  stageDurations,
  type BatchActions,
  type PlanResult,
  type TransitionAction,
} from "@/lib/stage-machine";
import { Errors } from "@/server/lib/errors";
import {
  findBatchById,
  findBatchDetail,
  inProgressByStage,
  insertBatch,
  listBatches as listBatchRows,
  nextBatchNumber,
  transitionBatch,
  updateBatchFields,
  type BatchDetailRow,
  type BatchListFilters,
  type BatchListRow,
} from "@/server/models/batch.model";
import { runInTransaction } from "@/server/models/db";
import {
  findShoeType,
  findSupplier,
  listActiveShoeTypes,
  listActiveSuppliers,
} from "@/server/models/reference-data.model";
import {
  cancelLiveReworkForBatch,
  countLiveReworkByBatch,
  countLiveReworkForBatch,
} from "@/server/models/outcome.model";
import { closeOpenStageLog, openStageLog } from "@/server/models/stage-log.model";
import type { BatchFormValues } from "@/server/validators/batch.validator";
import { recordAudit } from "./audit.service";

export const PAGE_SIZE = 20;

type Actor = { id: string };

export function formatBatchCode(year: number, n: number): string {
  return `B-${year}-${String(n).padStart(4, "0")}`;
}

const STALE_MESSAGE =
  "This batch was already moved by someone else. Refresh to see where it is now.";

// ───────────── reads ─────────────

export type BatchListItem = BatchListRow & {
  timeInStageMs: number | null;
  /** Sections still at the repair station (D-022 "In repair" tag). */
  openRepairs: number;
};

export async function listBatches(
  filters: BatchListFilters,
  page = 1,
  now: Date = new Date(),
): Promise<{ rows: BatchListItem[]; total: number; page: number; pageCount: number }> {
  const { rows, total } = await listBatchRows(filters, {
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const repairs = await countLiveReworkByBatch(rows.map((r) => r.id));
  return {
    rows: rows.map((row) => {
      const open = row.status === "IN_PROGRESS" ? row.stageLogs[0] : undefined;
      return {
        ...row,
        timeInStageMs: open ? now.getTime() - open.startedAt.getTime() : null,
        openRepairs: repairs.get(row.id) ?? 0,
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type BatchDetail = {
  batch: BatchDetailRow;
  actions: BatchActions;
  /** Sections still at the repair station; a completed batch with any is tagged "In repair". */
  openRepairs: number;
  durations: Record<Stage, number>;
  /** The "now" the durations were computed at, so the page can show matching open-log times. */
  now: number;
};

export async function getBatchDetail(
  id: string,
  now: Date = new Date(),
): Promise<BatchDetail | null> {
  const batch = await findBatchDetail(id);
  if (!batch) return null;
  const openRepairs = batch.status === "CANCELLED" ? 0 : await countLiveReworkForBatch(id);
  return {
    batch,
    actions: availableActions(batch),
    openRepairs,
    durations: stageDurations(batch.stageLogs, now),
    now: now.getTime(),
  };
}

export async function getBatchFormOptions() {
  const [shoeTypes, suppliers] = await Promise.all([listActiveShoeTypes(), listActiveSuppliers()]);
  return { shoeTypes, suppliers };
}

export type StageSummary = {
  planned: number;
  stages: { stage: Stage; count: number; oldestWaitMs: number | null }[];
};

/** In-progress batches per stage with the longest wait, for spotting the bottleneck. */
export async function batchesByStageSummary(now: Date = new Date()): Promise<StageSummary> {
  const { counts, openLogs, planned } = await inProgressByStage();
  return {
    planned,
    stages: STAGE_ORDER.map((stage) => ({
      stage,
      count: counts.find((c) => c.currentStage === stage)?._count._all ?? 0,
      oldestWaitMs: (() => {
        const oldest = openLogs.find((l) => l.stage === stage)?._min.startedAt;
        return oldest ? now.getTime() - oldest.getTime() : null;
      })(),
    })),
  };
}

// ───────────── writes ─────────────

async function assertReferences(values: Pick<BatchFormValues, "shoeTypeId" | "supplierId">) {
  const shoeType = await findShoeType(values.shoeTypeId);
  if (!shoeType?.isActive) {
    throw Errors.validation([
      { path: ["shoeTypeId"], message: "Choose a shoe type from the list." },
    ]);
  }
  if (values.supplierId) {
    const supplier = await findSupplier(values.supplierId);
    if (!supplier?.isActive) {
      throw Errors.validation([
        { path: ["supplierId"], message: "Choose a supplier from the list." },
      ]);
    }
  }
}

function toColumns(values: BatchFormValues) {
  return {
    rollCode: values.rollCode,
    shoeTypeId: values.shoeTypeId,
    supplierId: values.supplierId ?? null,
    receivedAt: new Date(`${values.receivedAt}T00:00:00.000Z`),
    targetQuotaPairs: values.targetQuotaPairs ?? null,
    notes: values.notes ?? null,
  };
}

export async function createBatch(values: BatchFormValues, actor: Actor, now: Date = new Date()) {
  await assertReferences(values);
  return runInTransaction(async (tx) => {
    const year = manilaYear(now);
    const code = formatBatchCode(year, await nextBatchNumber(year, tx));
    const batch = await insertBatch({ ...toColumns(values), code, createdById: actor.id }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "batch.create",
      entity: "Batch",
      entityId: batch.id,
      after: batch,
    });
    return batch;
  });
}

export async function updateBatch(id: string, values: BatchFormValues, actor: Actor) {
  const batch = await findBatchById(id);
  if (!batch) throw Errors.notFound("This batch");
  const actions = availableActions(batch);
  if (!actions.edit.allowed) throw Errors.conflict(actions.edit.reason);
  if (values.shoeTypeId !== batch.shoeTypeId && !actions.changeShoeType.allowed) {
    throw Errors.validation([{ path: ["shoeTypeId"], message: actions.changeShoeType.reason }]);
  }
  await assertReferences(values);
  return runInTransaction(async (tx) => {
    const updated = await updateBatchFields(id, toColumns(values), tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "batch.update",
      entity: "Batch",
      entityId: id,
      before: batch,
      after: updated,
    });
    return updated;
  });
}

const AUDIT_ACTION: Record<TransitionAction, string> = {
  start: "batch.start",
  advance: "batch.advance",
  complete: "batch.complete",
  move_back: "batch.move_back",
};

async function applyPlan(
  id: string,
  expectedStage: Stage | undefined,
  plan: (batch: { status: BatchDetailRow["status"]; currentStage: Stage }) => PlanResult,
  audit: { action: string; reason?: string },
  actor: Actor,
  now: Date,
  extra: { cancelledReason?: string } = {},
  inTx?: (tx: Parameters<Parameters<typeof runInTransaction>[0]>[0]) => Promise<void>,
) {
  const batch = await findBatchById(id);
  if (!batch) throw Errors.notFound("This batch");
  if (expectedStage && batch.currentStage !== expectedStage) throw Errors.stale(STALE_MESSAGE);

  const result = plan(batch);
  if (!result.ok) throw Errors.conflict(result.reason);
  const { next, opensStage, closesOpenLog, isRollback } = result.plan;

  return runInTransaction(async (tx) => {
    const moved = await transitionBatch(id, batch, { ...next, ...extra }, tx);
    if (!moved) throw Errors.stale(STALE_MESSAGE);
    if (closesOpenLog) await closeOpenStageLog(id, actor.id, now, tx);
    if (inTx) await inTx(tx);
    if (opensStage) {
      await openStageLog(
        {
          batchId: id,
          stage: opensStage,
          startedById: actor.id,
          startedAt: now,
          isRollback,
          reason: isRollback ? audit.reason : undefined,
        },
        tx,
      );
    }
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: audit.action,
      entity: "Batch",
      entityId: id,
      before: { status: batch.status, currentStage: batch.currentStage },
      after: { ...next, ...(audit.reason ? { reason: audit.reason } : {}) },
    });
    return { code: batch.code, ...next };
  });
}

export async function transitionBatchStage(
  id: string,
  input: { action: TransitionAction; expectedStage: Stage; reason?: string },
  actor: Actor,
  now: Date = new Date(),
) {
  if (input.action === "move_back" && !input.reason) {
    throw Errors.validation([{ path: ["reason"], message: "Say why the batch is moving back." }]);
  }
  return applyPlan(
    id,
    input.expectedStage,
    (b) => planTransition(b, input.action),
    { action: AUDIT_ACTION[input.action], reason: input.reason },
    actor,
    now,
  );
}

export async function cancelBatch(
  id: string,
  input: { reason: string; expectedStage?: Stage },
  actor: Actor,
  now: Date = new Date(),
) {
  return applyPlan(
    id,
    input.expectedStage,
    planCancel,
    { action: "batch.cancel", reason: input.reason },
    actor,
    now,
    { cancelledReason: input.reason },
    async (tx) => {
      // The roll is gone, so its unfinished repairs are moot (D-021). Salvage stays: the leather exists.
      const { count } = await cancelLiveReworkForBatch(id, now, tx);
      if (count > 0) {
        await recordAudit(tx, {
          actor: { type: "USER", userId: actor.id },
          action: "rework.cancel",
          entity: "Batch",
          entityId: id,
          after: { cancelledRepairs: count, reason: "Batch cancelled" },
        });
      }
    },
  );
}

export { transitionLabel as describeTransition } from "@/lib/stage-machine";
