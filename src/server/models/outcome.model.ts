import { type Db, defaultDb } from "./db";

// Rework tickets and salvage items are created from scan verdicts (D-007). Phase 4 manages their lifecycle.

export function insertReworkTicket(scanId: string, db: Db = defaultDb()) {
  return db.reworkTicket.create({ data: { scanId } });
}

export function insertSalvageItem(
  data: { scanId: string; originBatchId: string },
  db: Db = defaultDb(),
) {
  return db.salvageItem.create({ data });
}

/** The live (not cancelled) rework ticket and salvage item of a scan, if any. */
export async function findLiveOutcomes(scanId: string, db: Db = defaultDb()) {
  const [rework, salvage] = await Promise.all([
    db.reworkTicket.findFirst({ where: { scanId, status: { not: "CANCELLED" } } }),
    db.salvageItem.findFirst({ where: { scanId, status: { not: "CANCELLED" } } }),
  ]);
  return { rework, salvage };
}

export function cancelReworkTicket(id: string, at: Date, db: Db = defaultDb()) {
  return db.reworkTicket.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: at } });
}

export function cancelSalvageItem(id: string, db: Db = defaultDb()) {
  return db.salvageItem.update({ where: { id }, data: { status: "CANCELLED" } });
}
