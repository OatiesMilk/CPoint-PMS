import { type Db, defaultDb } from "./db";

export function getCvSettings(db: Db = defaultDb()) {
  return db.cvSettings.findUnique({ where: { id: 1 } });
}

export function updateActiveBatch(
  activeBatchId: string | null,
  updatedById: string,
  db: Db = defaultDb(),
) {
  return db.cvSettings.update({ where: { id: 1 }, data: { activeBatchId, updatedById } });
}
