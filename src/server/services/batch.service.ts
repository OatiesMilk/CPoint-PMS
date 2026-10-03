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
import { AppError, Errors } from "@/server/lib/errors";
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
import { findInventoryItem, listRollMovementsForBatch } from "@/server/models/inventory.model";
import type { BatchFormValues } from "@/server/validators/batch.validator";
import { recordAudit } from "./audit.service";
import { postMovement, rollItemOptions } from "./inventory.service";

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
  /** The inventory roll recorded as used for this batch (D-023), if any. */
  rollFromInventory: { itemId: string; label: string; returned: boolean } | null;
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
  const [openRepairs, rollMovements] = await Promise.all([
    batch.status === "CANCELLED" ? 0 : countLiveReworkForBatch(id),
    listRollMovementsForBatch(id),
  ]);
  const taken = rollMovements.find((m) => m.type === "OUT");
  return {
    batch,
    actions: availableActions(batch),
    openRepairs,
    rollFromInventory: taken
      ? {
          itemId: taken.item.id,
          label: `${taken.item.sku} · ${taken.item.name}`,
          returned: rollMovements.some((m) => m.type === "IN"),
        }
      : null,
    durations: stageDurations(batch.stageLogs, now),
    now: now.getTime(),
  };
}

export async function getBatchFormOptions() {
  const [shoeTypes, suppliers, rollItems] = await Promise.all([
    listActiveShoeTypes(),
    listActiveSuppliers(),
    rollItemOptions(),
  ]);
  return { shoeTypes, suppliers, rollItems };
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

const ROLL_FIELD = "rollItemId";

async function findRollItem(rollItemId: string) {
  const row = await findInventoryItem(rollItemId);
  if (!row || row.category !== "LEATHER_ROLL" || !row.isActive) {
    throw Errors.validation([
      { path: [ROLL_FIELD], message: "Choose a leather roll from the list." },
    ]);
  }
  return { ...row, quantityOnHand: Number(row.quantityOnHand) };
}

export async function createBatch(values: BatchFormValues, actor: Actor, now: Date = new Date()) {
  await assertReferences(values);
  const rollItem = values.rollItemId ? await findRollItem(values.rollItemId) : null;
  return runInTransaction(async (tx) => {
    const year = manilaYear(now);
    const code = formatBatchCode(year, await nextBatchNumber(year, tx));
    const batch = await insertBatch(
      { ...toColumns(values), code, createdById: actor.id, createdAt: now },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "batch.create",
      entity: "Batch",
      entityId: batch.id,
      after: batch,
    });
    if (rollItem) {
      // Same transaction (D-023): with no roll left, the batch and its code roll back too.
      await postMovement(
        tx,
        rollItem,
        { type: "OUT", delta: -1, reason: `Used for batch ${code}`, batchId: batch.id },
        actor,
        now,
      ).catch((error: unknown) => {
        // "Only 0 rolls in stock…" belongs next to the roll field, not in a page-level alert.
        if (error instanceof AppError && error.status === 409) {
          throw Errors.validation([{ path: [ROLL_FIELD], message: error.message }]);
        }
        throw error;
      });
    }
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
  inTx?: (
    tx: Parameters<Parameters<typeof runInTransaction>[0]>[0],
    before: { status: BatchDetailRow["status"]; code: string },
  ) => Promise<void>,
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
    if (inTx) await inTx(tx, batch);
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
    async (tx, before) => {
      if (before.status === "PLANNED") await returnRolls(tx, id, before.code, actor, now);
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

/**
 * A planned batch never cut its roll, so cancelling it puts the roll back on the shelf (D-023).
 * Once production starts the roll is cut, and nothing is returned.
 */
async function returnRolls(
  tx: Parameters<Parameters<typeof runInTransaction>[0]>[0],
  batchId: string,
  code: string,
  actor: Actor,
  now: Date,
) {
  const movements = await listRollMovementsForBatch(batchId, tx);
  const byItem = new Map<string, { item: (typeof movements)[number]["item"]; net: number }>();
  for (const m of movements) {
    const entry = byItem.get(m.item.id) ?? { item: m.item, net: 0 };
    entry.net += Number(m.quantityDelta);
    byItem.set(m.item.id, entry);
  }
  for (const { item, net } of byItem.values()) {
    if (net >= 0) continue;
    const fresh = await findInventoryItem(item.id, tx);
    if (!fresh?.isActive) continue; // a deactivated item can't take stock; the history still shows the use
    await postMovement(
      tx,
      { ...item, quantityOnHand: Number(fresh.quantityOnHand) },
      {
        type: "IN",
        delta: -net,
        reason: `Returned: batch ${code} cancelled before production`,
        batchId,
      },
      actor,
      now,
    );
  }
}
