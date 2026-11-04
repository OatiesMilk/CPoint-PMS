import { type Db, defaultDb } from "./db";

// Report queries (D-025). Aggregates per Manila day, roll or defect type only: no query here
// selects or groups by a person (D-008). Timestamps are stored as UTC `timestamp(3)`, so a
// Manila day is `(col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila'`. Range bounds arrive as
// UTC instants and are compared as UTC timestamps.

type Range = { start: Date; end: Date };
const iso = (d: Date) => d.toISOString();
const n = (v: bigint | number | null) => Number(v ?? 0);

// Since D-117 the reports judge whole rolls: a roll counts on the Manila day it was finished at
// Capture, and is Returned to supplier when its defects went over the limit (D-116) or it was sent
// back in Phase 30C; otherwise Scanning passed. A roll being scanned or removed doesn't count.
// Keep RETURNED in step with `isReturnedToSupplier` in src/lib/roll-rules.ts.

export type DailyRollRow = {
  day: string;
  /** Rolls finished at Capture that day. */
  rolls: number;
  passed: number;
  returned: number;
};

/** Rolls finished at Capture per Manila day, passed or returned to supplier (D-117). */
export async function dailyRollStats(range: Range, db: Db = defaultDb()): Promise<DailyRollRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string>[]>`
    SELECT to_char((b."finishedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
      count(*) AS rolls,
      count(*) FILTER (WHERE b.status = 'RETURNED'
        OR (b."markedForReturn" AND b."returnDecision" IS NULL)) AS returned
    FROM batches b
    WHERE b.status IN ('FINISHED', 'USED', 'RETURNED')
      AND b."finishedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND b."finishedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
  return rows.map((r) => {
    const rolls = n(r.rolls as bigint);
    const returned = n(r.returned as bigint);
    return { day: String(r.day), rolls, passed: rolls - returned, returned };
  });
}

/**
 * Rolls started and finished per Manila day (Phase 26: the roll's own start and finish times). A
 * roll from Inventory counts once scanning starts, and stays finished when it is fully used (30A).
 */
export async function dailyProduction(range: Range, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ day: string; started: bigint; completed: bigint }[]>`
    WITH started AS (
      SELECT b."startedAt" AS at FROM batches b
      WHERE b.status <> 'CANCELLED' AND b."startedAt" IS NOT NULL
    ), completed AS (
      SELECT b."finishedAt" AS at FROM batches b WHERE b.status IN ('FINISHED', 'USED')
    ), events AS (
      SELECT at, 1 AS s, 0 AS c FROM started UNION ALL SELECT at, 0, 1 FROM completed
    )
    SELECT to_char((at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
      sum(s) AS started, sum(c) AS completed
    FROM events
    WHERE at >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND at <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
  return rows.map((r) => ({ day: r.day, started: n(r.started), completed: n(r.completed) }));
}

export type DefectRow = {
  key: string;
  label: string;
  /** Rolls finished in the range on which this type was found. */
  rolls: number;
  /** Of those, the rolls returned to supplier. */
  returned: number;
};

/**
 * Per defect type, the rolls finished in the range on which it was found (a detection at or above
 * "A defect counts as found at", of an active type), and how many of them were returned to
 * supplier (D-117). One count per roll, however many shots showed it.
 */
export async function defectBreakdown(
  range: Range,
  foundAtOrAbove: number,
  db: Db = defaultDb(),
): Promise<DefectRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string>[]>`
    WITH found AS (
      SELECT DISTINCT b.id AS roll, t.key, t.label,
        (b.status = 'RETURNED' OR (b."markedForReturn" AND b."returnDecision" IS NULL)) AS returned
      FROM batches b
      JOIN scans s ON s."batchId" = b.id
      JOIN detections d ON d."scanId" = s.id
      JOIN defect_types t ON t.id = d."defectTypeId" AND t."isActive"
      WHERE b.status IN ('FINISHED', 'USED', 'RETURNED')
        AND b."finishedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
        AND b."finishedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
        AND d.confidence >= ${foundAtOrAbove}
    )
    SELECT key, label, count(*) AS rolls, count(*) FILTER (WHERE returned) AS returned
    FROM found
    GROUP BY 1, 2
    ORDER BY count(*) DESC, 2`;
  return rows.map((r) => ({
    key: String(r.key),
    label: String(r.label),
    rolls: n(r.rolls as bigint),
    returned: n(r.returned as bigint),
  }));
}
