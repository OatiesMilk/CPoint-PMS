import type { SalvageStatus } from "@/lib/domain";
import { planSalvageMove } from "@/lib/outcome-rules";
import { Errors } from "@/server/lib/errors";
import { findBatchById, listOpenBatches } from "@/server/models/batch.model";
import { runInTransaction } from "@/server/models/db";
import {
  countSalvageByStatus,
  findSalvageItem,
  listSalvageItems,
  transitionSalvageItem,
  type SalvageRow,
} from "@/server/models/outcome.model";
import { recordAudit } from "./audit.service";

const STALE = "Someone else already changed this salvage record. Refresh the list.";

export type SalvageListStatus = Extract<SalvageStatus, "AVAILABLE" | "ASSIGNED" | "DISCARDED">;

export async function salvageList(status: SalvageListStatus, batchCode?: string) {
  const [rows, groups] = await Promise.all([
    listSalvageItems({ status, batchCode }),
    countSalvageByStatus(),
  ]);
  const count = (s: SalvageStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
  return {
    rows: rows.map((r: SalvageRow) => ({
      ...r,
      defect: r.scan.detections[0]
        ? {
            label: r.scan.detections[0].defectType?.label ?? r.scan.detections[0].rawClassKey,
            confidence: r.scan.detections[0].confidence,
          }
        : null,
    })),
    counts: {
      AVAILABLE: count("AVAILABLE"),
      ASSIGNED: count("ASSIGNED"),
      DISCARDED: count("DISCARDED"),
    },
  };
}

export function assignableBatches() {
  return listOpenBatches();
}

async function load(id: string, expectedStatus: SalvageStatus) {
  const item = await findSalvageItem(id);
  if (!item) throw Errors.notFound("This salvage record");
  if (item.status !== expectedStatus) throw Errors.stale(STALE);
  return item;
}

const label = (item: NonNullable<Awaited<ReturnType<typeof findSalvageItem>>>) =>
  `${item.originBatch.code} · section #${item.scan.sequence}`;

export async function assignSalvage(
  id: string,
  input: { batchId: string; expectedStatus: SalvageStatus; note?: string },
  actor: { id: string },
  now: Date = new Date(),
) {
  const item = await load(id, input.expectedStatus);
  const target = await findBatchById(input.batchId);
  const plan = planSalvageMove(item, "assign", { target: target ?? undefined });
  if (!plan.ok) throw Errors.conflict(plan.reason);
  await runInTransaction(async (tx) => {
    const ok = await transitionSalvageItem(
      id,
      item.status,
      {
        status: plan.to,
        assignedBatchId: input.batchId,
        assignedAt: now,
        handledById: actor.id,
        notes: input.note ?? item.notes,
      },
      tx,
    );
    if (!ok) throw Errors.stale(STALE);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "salvage.assign",
      entity: "SalvageItem",
      entityId: id,
      before: { status: item.status },
      after: {
        status: plan.to,
        section: label(item),
        assignedTo: target!.code,
        note: input.note ?? null,
      },
    });
  });
  return { id, status: plan.to, assignedTo: target!.code, label: label(item) };
}

export async function unassignSalvage(
  id: string,
  input: { expectedStatus: SalvageStatus },
  actor: { id: string },
) {
  const item = await load(id, input.expectedStatus);
  const plan = planSalvageMove(item, "unassign", {
    assignedBatchStatus: item.assignedBatch?.status,
  });
  if (!plan.ok) throw Errors.conflict(plan.reason);
  await runInTransaction(async (tx) => {
    const ok = await transitionSalvageItem(
      id,
      item.status,
      { status: plan.to, assignedBatchId: null, assignedAt: null },
      tx,
    );
    if (!ok) throw Errors.stale(STALE);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "salvage.unassign",
      entity: "SalvageItem",
      entityId: id,
      before: { status: item.status, assignedBatchId: item.assignedBatchId },
      after: { status: plan.to },
    });
  });
  return { id, status: plan.to, label: label(item) };
}

export async function discardSalvage(
  id: string,
  input: { reason: string; expectedStatus: SalvageStatus },
  actor: { id: string },
  now: Date = new Date(),
) {
  if (!input.reason?.trim())
    throw Errors.validation([{ path: ["reason"], message: "Say why this section is discarded." }]);
  const item = await load(id, input.expectedStatus);
  const plan = planSalvageMove(item, "discard");
  if (!plan.ok) throw Errors.conflict(plan.reason);
  await runInTransaction(async (tx) => {
    const ok = await transitionSalvageItem(
      id,
      item.status,
      { status: plan.to, discardedAt: now, handledById: actor.id, notes: input.reason },
      tx,
    );
    if (!ok) throw Errors.stale(STALE);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "salvage.discard",
      entity: "SalvageItem",
      entityId: id,
      before: { status: item.status },
      after: { status: plan.to, section: label(item), reason: input.reason },
    });
  });
  return { id, status: plan.to, label: label(item) };
}
