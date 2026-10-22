import { type Db, defaultDb } from "./db";

// Operations report queries (D-033). Like report.model.ts these are aggregates per batch,
// item, supplier or request. No query here selects or groups by a person (D-008).

type Range = { start: Date; end: Date };
const iso = (d: Date) => d.toISOString();
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const num = (v: number | string | null | undefined) => (v == null ? null : Number(v));

export type RepairRow = {
  id: string;
  status: "OPEN" | "IN_PROGRESS";
  batchId: string;
  batchCode: string;
  sequence: number;
  defect: string | null;
  openedAt: Date;
  startedAt: Date | null;
};

/** Sections at the repair station now (waiting or being repaired), oldest first. */
export async function repairQueue(db: Db = defaultDb()): Promise<RepairRow[]> {
  return db.$queryRaw<RepairRow[]>`
    SELECT r.id, r.status::text AS status, b.id AS "batchId", b.code AS "batchCode", s.sequence,
      (SELECT coalesce(t.label, d."rawClassKey")
         FROM detections d LEFT JOIN defect_types t ON t.id = d."defectTypeId"
         WHERE d."scanId" = s.id ORDER BY d.confidence DESC LIMIT 1) AS defect,
      r."openedAt", r."startedAt"
    FROM rework_tickets r
    JOIN scans s ON s.id = r."scanId"
    JOIN batches b ON b.id = s."batchId"
    WHERE r.status IN ('OPEN', 'IN_PROGRESS')
    ORDER BY r."openedAt"
    LIMIT 200`;
}

/** Repairs finished in the range: how many, and the median time from opened to done (ms). */
export async function repairTurnaround(range: Range, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ done: bigint; medianMs: number | null }[]>`
    SELECT count(*) AS done,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM r."completedAt" - r."openedAt")) * 1000 AS "medianMs"
    FROM rework_tickets r
    WHERE r.status = 'DONE'
      AND r."completedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND r."completedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')`;
  return { done: n(rows[0]?.done), medianMs: num(rows[0]?.medianMs) };
}

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
  requested: boolean;
};

/** Active items with their stock, what was used and received in the range, and open requests. */
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
      requested: boolean;
    }[]
  >`
    SELECT i.id, i.sku, i.name, i.category::text AS category, i.unit,
      i."quantityOnHand"::text AS "onHand", i."reorderLevel"::text AS "reorderLevel",
      m.used::text AS used, m.received::text AS received,
      EXISTS (
        SELECT 1 FROM purchase_request_lines pl JOIN purchase_requests pr ON pr.id = pl."requestId"
        WHERE pl."inventoryItemId" = i.id
          AND pr.status IN ('PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED')
          AND pl.decision <> 'REJECTED'
      ) AS requested
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
    requested: r.requested,
  }));
}

/**
 * Purchasing flow: what is waiting now, and how fast requests were decided and received in the
 * range. Counts and times only; the requester is never selected.
 */
export async function procurementFlow(
  range: Range,
  now: Date,
  /** The last needed-by date (YYYY-MM-DD) that counts as High urgency today (D-037). */
  highThrough: string,
  /** Today in Manila (YYYY-MM-DD): an order expected before it is late (D-041). */
  today: string,
  db: Db = defaultDb(),
) {
  const [waiting, byStatus, timings] = await Promise.all([
    db.$queryRaw<
      {
        pending: bigint;
        high: bigint;
        oldestPendingMs: number | null;
        awaiting: bigint;
        late: bigint;
      }[]
    >`
      SELECT
        count(*) FILTER (WHERE status = 'PENDING') AS pending,
        count(*) FILTER (WHERE status = 'PENDING' AND "neededBy" <= ${highThrough}::date) AS high,
        max(extract(epoch FROM (${iso(now)}::timestamptz AT TIME ZONE 'UTC') - "createdAt")) FILTER (WHERE status = 'PENDING') * 1000 AS "oldestPendingMs",
        count(*) FILTER (WHERE status IN ('APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED')) AS awaiting,
        count(*) FILTER (WHERE status IN ('ORDERED', 'PARTIALLY_RECEIVED')
          AND "expectedDeliveryOn" < ${today}::date) AS late
      FROM purchase_requests`,
    db.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT status::text AS status, count(*) AS count FROM purchase_requests
      WHERE "createdAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
        AND "createdAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1`,
    db.$queryRaw<{ decideMs: number | null; receiveMs: number | null }[]>`
      SELECT
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "decidedAt" - "createdAt")) * 1000
           FROM purchase_requests
           WHERE "decidedAt" IS NOT NULL
             AND "decidedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
             AND "decidedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')) AS "decideMs",
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "receivedAt" - "decidedAt")) * 1000
           FROM purchase_requests
           WHERE "receivedAt" IS NOT NULL AND "decidedAt" IS NOT NULL
             AND "receivedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
             AND "receivedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')) AS "receiveMs"`,
  ]);
  const w = waiting[0];
  return {
    pending: n(w?.pending),
    highPending: n(w?.high),
    oldestPendingMs: num(w?.oldestPendingMs),
    awaitingDelivery: n(w?.awaiting),
    lateAwaitingDelivery: n(w?.late),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, n(r.count)])) as Record<
      string,
      number
    >,
    medianDecideMs: num(timings[0]?.decideMs),
    medianReceiveMs: num(timings[0]?.receiveMs),
  };
}

export type SupplierRow = {
  id: string | null;
  name: string;
  batches: number;
  /** Distinct roll codes: one batch is cut from one roll (Phase 20). */
  rolls: number;
  scanned: number;
  pass: number;
  rework: number;
  reject: number;
};

/** Scanned sections by the supplier of the batch's leather, split by final verdict. */
export async function supplierQuality(range: Range, db: Db = defaultDb()): Promise<SupplierRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string | null>[]>`
    SELECT b."supplierId" AS id, coalesce(sp.name, 'No supplier recorded') AS name,
      count(DISTINCT b.id) AS batches, count(DISTINCT b."rollCode") AS rolls, count(*) AS scanned,
      count(*) FILTER (WHERE s."finalVerdict" = 'PASS') AS pass,
      count(*) FILTER (WHERE s."finalVerdict" = 'REWORK') AS rework,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS reject
    FROM scans s
    JOIN batches b ON b.id = s."batchId"
    LEFT JOIN suppliers sp ON sp.id = b."supplierId"
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1, 2
    ORDER BY count(*) DESC, 2`;
  return rows.map((r) => ({
    id: r.id === null ? null : String(r.id),
    name: String(r.name),
    batches: n(r.batches as bigint),
    rolls: n(r.rolls as bigint),
    scanned: n(r.scanned as bigint),
    pass: n(r.pass as bigint),
    rework: n(r.rework as bigint),
    reject: n(r.reject as bigint),
  }));
}

/**
 * Each scan's strongest detection, for scans with a final verdict in `verdicts`, as
 * (supplier or batch, defect label) counts. One count per section, never per detection, so "Hole 4"
 * means four sections whose main defect was a hole.
 */
async function mainDefects(
  range: Range,
  verdicts: string[],
  groupBy: "supplier" | "batch",
  batchIds: string[] | null,
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
      AND s."finalVerdict"::text = ANY(${verdicts})
      AND (${batchIds}::uuid[] IS NULL OR b.id = ANY(${batchIds}::uuid[]))
    GROUP BY 1, 2
    ORDER BY 3 DESC, 2`;
  return rows.map((r) => ({ groupId: r.groupId, label: r.label, sections: n(r.sections) }));
}

/** The main defect of each supplier's Fixable and rejected sections, most common first. */
export function supplierDefects(range: Range, db: Db = defaultDb()) {
  return mainDefects(range, ["REWORK", "REJECT"], "supplier", null, db);
}

export type RollRejectRow = {
  batchId: string;
  batchCode: string;
  rollCode: string;
  supplier: string;
  sections: number;
  rejected: number;
  defects: { label: string; sections: number }[];
};

/** The rolls (one per batch) with the most rejected sections in the range, worst first. */
export async function rollsWithMostRejects(
  range: Range,
  limit: number,
  db: Db = defaultDb(),
): Promise<RollRejectRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string>[]>`
    SELECT b.id AS "batchId", b.code AS "batchCode", b."rollCode" AS "rollCode",
      coalesce(sp.name, 'No supplier recorded') AS supplier,
      count(*) AS sections,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS rejected
    FROM scans s
    JOIN batches b ON b.id = s."batchId"
    LEFT JOIN suppliers sp ON sp.id = b."supplierId"
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY b.id, b.code, b."rollCode", sp.name
    HAVING count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') > 0
    ORDER BY 6 DESC, 5 DESC, b.code
    LIMIT ${limit}`;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.batchId));
  const defects = await mainDefects(range, ["REJECT"], "batch", ids, db);
  return rows.map((r) => ({
    batchId: String(r.batchId),
    batchCode: String(r.batchCode),
    rollCode: String(r.rollCode),
    supplier: String(r.supplier),
    sections: n(r.sections as bigint),
    rejected: n(r.rejected as bigint),
    defects: defects
      .filter((d) => d.groupId === String(r.batchId))
      .map((d) => ({ label: d.label, sections: d.sections })),
  }));
}

/** One roll's batch, its supplier and every rejected section with its defects, for a claim sheet. */
export function findClaimBatch(batchId: string, db: Db = defaultDb()) {
  return db.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      code: true,
      rollCode: true,
      receivedAt: true,
      shoeType: { select: { name: true } },
      supplier: { select: { name: true, contactPerson: true, phone: true } },
      scans: {
        where: { finalVerdict: "REJECT" },
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          capturedAt: true,
          imagePath: true,
          isOverride: true,
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

/** Sections of one batch by final verdict, for the claim sheet's totals. */
export function countBatchVerdicts(batchId: string, db: Db = defaultDb()) {
  return db.scan.groupBy({ by: ["finalVerdict"], where: { batchId }, _count: { _all: true } });
}
