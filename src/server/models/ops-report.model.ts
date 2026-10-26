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

export type SupplierRow = {
  id: string | null;
  name: string;
  rolls: number;
  scanned: number;
  pass: number;
  reject: number;
};

/** Scanned sections by the supplier of the roll's leather, split by final verdict. */
export async function supplierQuality(range: Range, db: Db = defaultDb()): Promise<SupplierRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string | null>[]>`
    SELECT b."supplierId" AS id, coalesce(sp.name, 'No supplier recorded') AS name,
      count(DISTINCT b.id) AS rolls, count(*) AS scanned,
      count(*) FILTER (WHERE s."finalVerdict" = 'PASS') AS pass,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS reject
    FROM scans s
    JOIN batches b ON b.id = s."batchId"
    LEFT JOIN suppliers sp ON sp.id = b."supplierId"
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      AND b.status <> 'CANCELLED' -- a cancelled roll never went on to cutting (Phase 26)
    GROUP BY 1, 2
    ORDER BY count(*) DESC, 2`;
  return rows.map((r) => ({
    id: r.id === null ? null : String(r.id),
    name: String(r.name),
    rolls: n(r.rolls as bigint),
    scanned: n(r.scanned as bigint),
    pass: n(r.pass as bigint),
    reject: n(r.reject as bigint),
  }));
}

/**
 * Each scan's strongest detection, for scans with a final verdict in `verdicts`, as
 * (supplier or roll, defect label) counts. One count per section, never per detection, so "Hole 4"
 * means four sections whose main defect was a hole.
 */
async function mainDefects(
  range: Range,
  verdicts: string[],
  groupBy: "supplier" | "roll",
  rollIds: string[] | null,
  db: Db,
) {
  const rows = await db.$queryRaw<{ groupId: string | null; label: string; sections: bigint }[]>`
    SELECT CASE WHEN ${groupBy} = 'supplier' THEN b."supplierId"::text ELSE b.id::text END AS "groupId",
      coalesce(dt.label, d."rawClassKey") AS label, count(*) AS sections
    FROM scans s
    JOIN batches b ON b.id = s."batchId"
    JOIN LATERAL (
      SELECT x."defectTypeId", x."rawClassKey" FROM detections x
      WHERE x."scanId" = s.id ORDER BY x.confidence DESC LIMIT 1
    ) d ON true
    LEFT JOIN defect_types dt ON dt.id = d."defectTypeId"
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      AND b.status <> 'CANCELLED' -- a cancelled roll never went on to cutting (Phase 26)
      AND s."finalVerdict"::text = ANY(${verdicts})
      AND (${rollIds}::uuid[] IS NULL OR b.id = ANY(${rollIds}::uuid[]))
    GROUP BY 1, 2
    ORDER BY 3 DESC, 2`;
  return rows.map((r) => ({ groupId: r.groupId, label: r.label, sections: n(r.sections) }));
}

/** The main defect of each supplier's rejected sections (for salvage), most common first. */
export function supplierDefects(range: Range, db: Db = defaultDb()) {
  return mainDefects(range, ["REJECT"], "supplier", null, db);
}

export type RollRejectRow = {
  rollId: string;
  rollCode: string;
  tagCode: string | null;
  supplier: string;
  sections: number;
  rejected: number;
  defects: { label: string; sections: number }[];
};

/** The rolls (one per roll) with the most rejected sections in the range, worst first. */
export async function rollsWithMostRejects(
  range: Range,
  limit: number,
  db: Db = defaultDb(),
): Promise<RollRejectRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string>[]>`
    SELECT b.id AS "rollId", b.code AS "rollCode", b."rollCode" AS "tagCode",
      coalesce(sp.name, 'No supplier recorded') AS supplier,
      count(*) AS sections,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS rejected
    FROM scans s
    JOIN batches b ON b.id = s."batchId"
    LEFT JOIN suppliers sp ON sp.id = b."supplierId"
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      AND b.status <> 'CANCELLED' -- a cancelled roll never went on to cutting (Phase 26)
    GROUP BY b.id, b.code, b."rollCode", sp.name
    HAVING count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') > 0
    ORDER BY 6 DESC, 5 DESC, b.code
    LIMIT ${limit}`;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.rollId));
  const defects = await mainDefects(range, ["REJECT"], "roll", ids, db);
  return rows.map((r) => ({
    rollId: String(r.rollId),
    rollCode: String(r.rollCode),
    tagCode: r.tagCode == null ? null : String(r.tagCode),
    supplier: String(r.supplier),
    sections: n(r.sections as bigint),
    rejected: n(r.rejected as bigint),
    defects: defects
      .filter((d) => d.groupId === String(r.rollId))
      .map((d) => ({ label: d.label, sections: d.sections })),
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
