import type { DefectAction, DefectHandling } from "@/generated/prisma/client";
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
    attendanceDays,
    checkIns,
    quotas,
    schedules,
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
    db.attendanceDay.count(),
    db.productionCheckIn.count(),
    db.dailyQuota.count(),
    // The bootstrap default (no author) is kept; schedules people saved go.
    db.productionSchedule.count({ where: { createdById: { not: null } } }),
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
    attendanceDays,
    checkIns,
    quotas,
    schedules,
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
  // Attendance (D-077): the marks, then the days, before any account goes.
  await db.attendanceMark.deleteMany();
  await db.attendanceDay.deleteMany();
  // Production progression (Phase 23): check-ins (their counts cascade), quotas and the schedules
  // people saved; the bootstrap default stays.
  await db.productionCheckIn.deleteMany();
  await db.dailyQuota.deleteMany();
  await db.productionSchedule.deleteMany({ where: { createdById: { not: null } } });
  // History, then accounts and tokens nobody needs (their sessions go with them).
  await db.auditLog.deleteMany();
  await db.apiToken.deleteMany({ where: { tokenHash: notIn(keep.tokenHashes) } });
  await db.apiToken.updateMany({ data: { lastUsedAt: null } });
  await db.user.deleteMany({ where: { email: notIn(keep.emails) } });
  // Reference rows tests added.
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
    handling: DefectHandling;
  },
  db: Db,
) {
  const { key, ...rest } = data;
  return db.defectType.upsert({
    where: { key },
    create: data,
    update: { isActive: rest.isActive, action: rest.action, handling: rest.handling },
  });
}

export function setLeatherRollRequester(email: string, value: boolean, db: Db) {
  return db.user.updateMany({ where: { email }, data: { canRequestLeatherRolls: value } });
}
