import { type Db, defaultDb } from "./db";

// What was used, per item and week (Phase 29, D-102). Only Used entries (OUT) count: Added (IN)
// and Corrections (ADJUST) never do. Weeks run Monday to Sunday by the Manila date. Aggregates per
// item and week only; nothing here selects or groups by a person (D-008).

const iso = (d: Date) => d.toISOString();

export type MaterialItemRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  supplier: string | null;
  /** When the item's stock history starts: its first ledger entry (else when it was added). */
  since: Date;
};

/**
 * The active items, by category then name. `since` is the first ledger entry, not `createdAt`:
 * the demo items are created when the app starts, after their back-dated history.
 */
export async function listMaterialItems(db: Db = defaultDb()): Promise<MaterialItemRow[]> {
  const rows = await db.inventoryItem.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      unit: true,
      quantityOnHand: true,
      createdAt: true,
      supplier: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const first = await db.inventoryMovement.groupBy({
    by: ["itemId"],
    where: { itemId: { in: rows.map((r) => r.id) } },
    _min: { createdAt: true },
  });
  const firstAt = new Map(first.map((f) => [f.itemId, f._min.createdAt]));
  return rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    unit: r.unit,
    onHand: Number(r.quantityOnHand),
    supplier: r.supplier?.name ?? null,
    since: firstAt.get(r.id) ?? r.createdAt,
  }));
}

/** Used per item and Manila week (its Monday, YYYY-MM-DD), from `start` on. */
export async function usedByWeek(start: Date, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ itemId: string; week: Date; used: string }[]>`
    SELECT "itemId",
      date_trunc('week', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::date AS week,
      sum(-"quantityDelta")::text AS used
    FROM inventory_movements
    WHERE type = 'OUT' AND "createdAt" >= (${iso(start)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY "itemId", week`;
  return rows.map((r) => ({
    itemId: r.itemId,
    week: r.week.toISOString().slice(0, 10),
    used: Number(r.used),
  }));
}

/** Used per item in [start, end). */
export async function usedBetween(start: Date, end: Date, db: Db = defaultDb()) {
  const rows = await db.inventoryMovement.groupBy({
    by: ["itemId"],
    where: { type: "OUT", createdAt: { gte: start, lt: end } },
    _sum: { quantityDelta: true },
  });
  return new Map(rows.map((r) => [r.itemId, -Number(r._sum.quantityDelta ?? 0)]));
}

/** Pairs finished per Manila week (failed ones included: they count as made). */
export async function pairsByWeek(fromDay: string, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ week: Date; pairs: bigint | null }[]>`
    SELECT date_trunc('week', day)::date AS week, sum(pairs) AS pairs
    FROM production_check_ins WHERE day >= ${fromDay}::date GROUP BY week`;
  return new Map(rows.map((r) => [r.week.toISOString().slice(0, 10), Number(r.pairs ?? 0)]));
}

/** Pairs finished on the Manila days [fromDay, toDay]. */
export async function pairsBetween(fromDay: string, toDay: string, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ pairs: bigint | null }[]>`
    SELECT sum(pairs) AS pairs FROM production_check_ins
    WHERE day >= ${fromDay}::date AND day <= ${toDay}::date`;
  return Number(rows[0]?.pairs ?? 0);
}

/** Rolls the camera checked (finished at Capture) per Manila week. */
export async function rollsCheckedByWeek(start: Date, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ week: Date; rolls: bigint }[]>`
    SELECT date_trunc('week', ("finishedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::date AS week,
      count(*) AS rolls
    FROM batches
    WHERE status = 'FINISHED' AND "finishedAt" >= (${iso(start)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY week`;
  return new Map(rows.map((r) => [r.week.toISOString().slice(0, 10), Number(r.rolls)]));
}
