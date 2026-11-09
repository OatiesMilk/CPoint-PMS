import { type Db, defaultDb } from "./db";

/** The demo clock's offset in milliseconds (D-125); 0 when it was never set. */
export async function getDemoClockOffset(db: Db = defaultDb()): Promise<number> {
  const row = await db.demoClock.findUnique({ where: { id: 1 } });
  return row ? Number(row.offsetMs) : 0;
}

/** Saves the demo clock's offset (one row). */
export async function saveDemoClockOffset(offsetMs: number, db: Db = defaultDb()): Promise<void> {
  const value = BigInt(Math.trunc(offsetMs));
  await db.demoClock.upsert({
    where: { id: 1 },
    create: { id: 1, offsetMs: value },
    update: { offsetMs: value },
  });
}
