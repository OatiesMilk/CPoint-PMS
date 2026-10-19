import type { DefectAction } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

/**
 * The data `npm run demo:reset` clears (D-056). Accounts, device tokens and reference rows are
 * kept by the rules in `ResetKeep`; everything people and tests did is removed. Only this file and
 * the service that calls it know the order: children before parents, so no foreign key blocks.
 */
export type ResetKeep = {
  emails: string[];
  tokenHashes: string[];
  shoeTypeCodes: string[];
  supplierNames: string[];
  defectTypeKeys: string[];
};

const notIn = <T>(values: T[]) => ({ notIn: values });

export async function countResetTargets(keep: ResetKeep, db: Db = defaultDb()) {
  const [
    users,
    tokens,
    batches,
    scans,
    requests,
    inventoryItems,
    movements,
    auditLogs,
    shoeTypes,
    suppliers,
    defectTypes,
  ] = await Promise.all([
    db.user.count({ where: { email: notIn(keep.emails) } }),
    db.apiToken.count({ where: { tokenHash: notIn(keep.tokenHashes) } }),
    db.batch.count(),
    db.scan.count(),
    db.purchaseRequest.count(),
    db.inventoryItem.count(),
    db.inventoryMovement.count(),
    db.auditLog.count(),
    db.shoeType.count({ where: { code: notIn(keep.shoeTypeCodes) } }),
    db.supplier.count({ where: { name: notIn(keep.supplierNames) } }),
    db.defectType.count({ where: { key: notIn(keep.defectTypeKeys) } }),
  ]);
  return {
    users,
    tokens,
    batches,
    scans,
    requests,
    inventoryItems,
    movements,
    auditLogs,
    shoeTypes,
    suppliers,
    defectTypes,
  };
}

export type ResetCounts = Awaited<ReturnType<typeof countResetTargets>>;

/** Removes the production, procurement, stock and audit history, then what isn't kept. */
export async function deleteResetTargets(keep: ResetKeep, db: Db) {
  // Procurement: lines and files before deliveries, deliveries before requests.
  await db.purchaseDeliveryLine.deleteMany();
  await db.purchaseAttachment.deleteMany();
  await db.purchaseRequestEvent.deleteMany();
  await db.purchaseRequestRemark.deleteMany();
  await db.purchaseDelivery.deleteMany();
  await db.purchaseRequestLine.deleteMany();
  await db.purchaseRequest.deleteMany();
  await db.purchaseRequestSequence.deleteMany();
  // Stock: the ledger, then the items (the demo week adds them back with opening stock).
  await db.inventoryMovement.deleteMany();
  await db.inventoryItem.deleteMany();
  // Production: the camera's batch, then scans and what came of them, then batches.
  await db.cvSettings.updateMany({ data: { activeBatchId: null } });
  await db.detection.deleteMany();
  await db.reworkTicket.deleteMany();
  await db.salvageItem.deleteMany();
  await db.scan.deleteMany();
  await db.batchStageLog.deleteMany();
  await db.batch.deleteMany();
  await db.batchSequence.deleteMany();
  // History, then accounts and tokens nobody needs (their sessions go with them).
  await db.auditLog.deleteMany();
  await db.apiToken.deleteMany({ where: { tokenHash: notIn(keep.tokenHashes) } });
  await db.apiToken.updateMany({ data: { lastUsedAt: null } });
  await db.user.deleteMany({ where: { email: notIn(keep.emails) } });
  // Reference rows tests added. Components of a removed shoe type go with it.
  const goneShoeTypes = await db.shoeType.findMany({
    where: { code: notIn(keep.shoeTypeCodes) },
    select: { id: true },
  });
  await db.componentType.deleteMany({
    where: { shoeTypeId: { in: goneShoeTypes.map((s) => s.id) } },
  });
  await db.shoeType.deleteMany({ where: { code: notIn(keep.shoeTypeCodes) } });
  await db.supplier.deleteMany({ where: { name: notIn(keep.supplierNames) } });
  await db.defectType.deleteMany({ where: { key: notIn(keep.defectTypeKeys) } });
}

/** A defect type as the reset leaves it: created if missing, otherwise set to these values. */
export function upsertDefectTypeState(
  data: {
    key: string;
    label: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
    action: DefectAction | null;
  },
  db: Db,
) {
  const { key, ...rest } = data;
  return db.defectType.upsert({
    where: { key },
    create: data,
    update: { isActive: rest.isActive, action: rest.action },
  });
}

export function setLeatherRollRequester(email: string, value: boolean, db: Db) {
  return db.user.updateMany({ where: { email }, data: { canRequestLeatherRolls: value } });
}
