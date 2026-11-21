import { type Db, defaultDb } from "./db";

// Operations report queries (D-033). Like report.model.ts these are aggregates per roll,
// item or supplier. No query here selects or groups by a person (D-008).

type Range = { start: Date; end: Date };
const iso = (d: Date) => d.toISOString();
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export type StockRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  used: number;
  received: number;
};

/** Active items with their stock, and what was used and received in the range. */
export async function stockPosition(range: Range, db: Db = defaultDb()): Promise<StockRow[]> {
  const rows = await db.$queryRaw<
    {
      id: string;
      sku: string;
      name: string;
      category: string;
      unit: string;
      onHand: string;
      reorderLevel: string;
      used: string | null;
      received: string | null;
    }[]
  >`
    SELECT i.id, i.sku, i.name, i.category::text AS category, i.unit,
      i."quantityOnHand"::text AS "onHand", i."reorderLevel"::text AS "reorderLevel",
      m.used::text AS used, m.received::text AS received
    FROM inventory_items i
    LEFT JOIN (
      SELECT "itemId",
        sum(-"quantityDelta") FILTER (WHERE type = 'OUT') AS used,
        sum("quantityDelta") FILTER (WHERE type = 'IN') AS received
      FROM inventory_movements
      WHERE "createdAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
        AND "createdAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY "itemId"
    ) m ON m."itemId" = i.id
    WHERE i."isActive"
    ORDER BY i.name`;
  return rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    unit: r.unit,
    onHand: Number(r.onHand),
    reorderLevel: Number(r.reorderLevel),
    used: Number(r.used ?? 0),
    received: Number(r.received ?? 0),
  }));
}

// Since D-117 Supplier quality judges whole rolls: those finished at Capture in the range, passed
// or returned to supplier (keep RETURNED in step with `isReturnedToSupplier` in roll-rules).

export type SupplierRow = {
  id: string | null;
  name: string;
  /** Rolls finished at Capture in the range. */
  rolls: number;
  returned: number;
};

/** Per supplier, the rolls finished in the range and how many were returned (D-117). */
export async function supplierRolls(range: Range, db: Db = defaultDb()): Promise<SupplierRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string | null>[]>`
    SELECT b."supplierId" AS id, coalesce(sp.name, 'No supplier recorded') AS name,
      count(*) AS rolls,
      count(*) FILTER (WHERE b.status = 'RETURNED'
        OR (b."markedForReturn" AND b."returnDecision" IS NULL)) AS returned
    FROM batches b
    LEFT JOIN suppliers sp ON sp.id = b."supplierId"
    WHERE b.status IN ('FINISHED', 'USED', 'RETURNED')
      AND b."finishedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND b."finishedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1, 2
    ORDER BY count(*) DESC, 2`;
  return rows.map((r) => ({
    id: r.id === null ? null : String(r.id),
    name: String(r.name),
    rolls: n(r.rolls as bigint),
    returned: n(r.returned as bigint),
  }));
}

/**
 * Per supplier and defect type, the rolls finished in the range on which the type was found (at
 * or above found-at, active types), most rolls first: the first row of a supplier is its top defect.
 */
export async function supplierDefects(range: Range, foundAtOrAbove: number, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ groupId: string | null; label: string; rolls: bigint }[]>`
    SELECT b."supplierId"::text AS "groupId", t.label, count(DISTINCT b.id) AS rolls
    FROM batches b
    JOIN scans s ON s."batchId" = b.id
    JOIN detections d ON d."scanId" = s.id
    JOIN defect_types t ON t.id = d."defectTypeId" AND t."isActive"
    WHERE b.status IN ('FINISHED', 'USED', 'RETURNED')
      AND b."finishedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND b."finishedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      AND d.confidence >= ${foundAtOrAbove}
    GROUP BY 1, 2
    ORDER BY 3 DESC, 2`;
  return rows.map((r) => ({ groupId: r.groupId, label: r.label, rolls: n(r.rolls) }));
}

export type RollDefectRow = {
  rollId: string;
  rollCode: string;
  tagCode: string | null;
  supplier: string;
  /** Percent of the roll's area with defects (Phase 30C). */
  defectSharePct: number;
  returned: boolean;
};

/** The rolls finished in the range with the highest Defect %, worst first (D-117). */
export async function rollsWithMostDefects(
  range: Range,
  limit: number,
  supplierId?: string,
  db: Db = defaultDb(),
): Promise<RollDefectRow[]> {
  const rows = await db.$queryRaw<Record<string, string | number | boolean | null>[]>`
    SELECT b.id AS "rollId", b.code AS "rollCode", b."rollCode" AS "tagCode",
      coalesce(sp.name, 'No supplier recorded') AS supplier,
      b."defectSharePct"::float8 AS "defectSharePct",
      (b.status = 'RETURNED' OR (b."markedForReturn" AND b."returnDecision" IS NULL)) AS returned
    FROM batches b
    LEFT JOIN suppliers sp ON sp.id = b."supplierId"
    WHERE b.status IN ('FINISHED', 'USED', 'RETURNED')
      AND b."defectSharePct" > 0
      AND (${supplierId ?? null}::uuid IS NULL OR b."supplierId" = ${supplierId ?? null}::uuid)
      AND b."finishedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND b."finishedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    ORDER BY b."defectSharePct" DESC, b.code
    LIMIT ${limit}`;
  return rows.map((r) => ({
    rollId: String(r.rollId),
    rollCode: String(r.rollCode),
    tagCode: r.tagCode == null ? null : String(r.tagCode),
    supplier: String(r.supplier),
    defectSharePct: Number(r.defectSharePct),
    returned: Boolean(r.returned),
  }));
}

/** One roll, its supplier and every rejected section with its defects, for a claim sheet. */
export function findClaimRoll(rollId: string, db: Db = defaultDb()) {
  return db.roll.findUnique({
    where: { id: rollId },
    select: {
      id: true,
      code: true,
      tagCode: true,
      receivedAt: true,
      startedAt: true,
      createdAt: true,
      areaSqFt: true,
      supplier: { select: { name: true, contactPerson: true, phone: true } },
      scans: {
        where: { finalVerdict: "REJECT" },
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          capturedAt: true,
          imagePath: true,
          detections: {
            orderBy: { confidence: "desc" },
            select: {
              confidence: true,
              rawClassKey: true,
              lengthIn: true,
              defectType: { select: { label: true } },
            },
          },
        },
      },
    },
  });
}

/** Sections of one roll by final verdict, for the claim sheet's totals. */
export function countRollVerdicts(rollId: string, db: Db = defaultDb()) {
  return db.scan.groupBy({ by: ["finalVerdict"], where: { rollId }, _count: { _all: true } });
}
