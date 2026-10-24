import { type Db, defaultDb } from "./db";

export function getCvSettings(db: Db = defaultDb()) {
  return db.cvSettings.findUnique({ where: { id: 1 } });
}
