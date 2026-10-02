import { type Db, defaultDb } from "./db";

// Create-if-missing upserts: an existing row is never overwritten, so edits made by an admin
// (labels, thresholds, active flags) survive every restart.

export function ensureShoeType(
  data: { code: string; name: string; sortOrder: number },
  db: Db = defaultDb(),
) {
  return db.shoeType.upsert({ where: { code: data.code }, create: data, update: {} });
}

export function ensureDefectType(
  data: { key: string; label: string; description: string; sortOrder: number },
  db: Db = defaultDb(),
) {
  return db.defectType.upsert({ where: { key: data.key }, create: data, update: {} });
}

export function ensureSupplier(data: { name: string; notes: string }, db: Db = defaultDb()) {
  return db.supplier.upsert({ where: { name: data.name }, create: data, update: {} });
}

export function ensureCvSettings(
  data: { rejectAtOrAbove: number; reworkAtOrAbove: number },
  db: Db = defaultDb(),
) {
  return db.cvSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: {} });
}
