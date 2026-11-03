import type { DefectOutcome } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

/**
 * The data `npm run demo:reset` clears (D-056). Accounts, device tokens and reference rows are
 * kept by the rules in `ResetKeep`; everything people and tests did is removed. Only this file and
 * the service that calls it know the order: children before parents, so no foreign key blocks.
 */
export type ResetKeep = {
  emails: string[];
  tokenHashes: string[];
  supplierNames: string[];
  defectTypeKeys: string[];
};

const notIn = <T>(values: T[]) => ({ notIn: values });

export async function countResetTargets(keep: ResetKeep, db: Db = defaultDb()) {
  const [
    users,
    tokens,
    rolls,
    scans,
    inventoryItems,
    movements,
    stockUpdates,
    auditLogs,
    suppliers,
    defectTypes,
    attendanceDays,
    checkIns,
    quotas,
    schedules,
    lunchBreaks,
  ] = await Promise.all([
    db.user.count({ where: { email: notIn(keep.emails) } }),
    db.apiToken.count({ where: { tokenHash: notIn(keep.tokenHashes) } }),
    db.roll.count(),
    db.scan.count(),
    db.inventoryItem.count(),
    db.inventoryMovement.count(),
    db.stockUpdate.count(),
    db.auditLog.count(),
    db.supplier.count({ where: { name: notIn(keep.supplierNames) } }),
    db.defectType.count({ where: { key: notIn(keep.defectTypeKeys) } }),
    db.attendanceDay.count(),
    db.productionCheckIn.count(),
    db.dailyQuota.count(),
    // Schedules people saved (every schedule goes; the default comes back, D-105).
    db.productionSchedule.count({ where: { createdById: { not: null } } }),
    // Lunch breaks the System Admin saved; the default comes back from the start (Phase 27).
    db.lunchBreak.count({ where: { createdById: { not: null } } }),
  ]);
  return {
    users,
    tokens,
    rolls,
    scans,
    inventoryItems,
    movements,
    stockUpdates,
    auditLogs,
    suppliers,
    defectTypes,
    attendanceDays,
    checkIns,
    quotas,
    schedules,
    lunchBreaks,
  };
}

export type ResetCounts = Awaited<ReturnType<typeof countResetTargets>>;

/** Removes the production, stock and audit history, then what isn't kept. */
export async function deleteResetTargets(keep: ResetKeep, db: Db) {
  // Production: scans, then rolls and their code numbers (LR-MLT-001 starts again, Phase 30A).
  await db.inventoryMovement.deleteMany();
  await db.detection.deleteMany();
  await db.scan.deleteMany();
  await db.roll.deleteMany();
  await db.rollSequence.deleteMany();
  await db.rollCodeSequence.deleteMany();
  // Stock: the Update stock saves, then the items (the demo week adds them back, leather with
  // its rolls), and the reminder days back to Wednesday and Friday (Phase 29).
  await db.stockUpdate.deleteMany();
  await db.inventoryItem.deleteMany();
  await db.inventorySettings.deleteMany();
  await db.inventorySettings.create({ data: { id: 1 } });
  // Attendance (D-077): the marks, then the days, before any account goes.
  await db.attendanceMark.deleteMany();
  await db.attendanceDay.deleteMany();
  // Batches (Phases 23, 27): finished batches, quotas, every schedule and every lunch break; the
  // service puts the default schedule (Monday to Friday, D-105) and the default lunch back, so an
  // older default with Saturday doesn't leave the demo week a missed Saturday.
  await db.productionCheckIn.deleteMany();
  await db.dailyQuota.deleteMany();
  await db.productionSchedule.deleteMany();
  await db.lunchBreak.deleteMany();
  // History, then accounts and tokens nobody needs (their sessions go with them).
  await db.auditLog.deleteMany();
  await db.apiToken.deleteMany({ where: { tokenHash: notIn(keep.tokenHashes) } });
  await db.apiToken.updateMany({ data: { lastUsedAt: null } });
  await db.user.deleteMany({ where: { email: notIn(keep.emails) } });
  // Reference rows tests added.
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
    outcome: DefectOutcome;
    notAcceptedFromIn?: number | null;
    flatSharePct?: number | null;
  },
  db: Db,
) {
  const { key, ...rest } = data;
  return db.defectType.upsert({
    where: { key },
    create: data,
    update: {
      isActive: rest.isActive,
      outcome: rest.outcome,
      notAcceptedFromIn: rest.notAcceptedFromIn ?? null,
      flatSharePct: rest.flatSharePct ?? null,
    },
  });
}

/** Puts the demo accounts' names back (D-090); an account that isn't there is skipped. */
export async function setDemoAccountNames(people: { email: string; name: string }[], db: Db) {
  for (const { email, name } of people)
    await db.user.updateMany({ where: { email }, data: { name } });
}
