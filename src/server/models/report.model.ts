import { type Db, defaultDb } from "./db";

// Report queries (D-025). Aggregates per Manila day, stage or defect type only: no query here
// selects or groups by a person (D-008). Timestamps are stored as UTC `timestamp(3)`, so a
// Manila day is `(col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila'`. Range bounds arrive as
// UTC instants and are compared as UTC timestamps.

type Range = { start: Date; end: Date };
const iso = (d: Date) => d.toISOString();
const n = (v: bigint | number | null) => Number(v ?? 0);

export type DailyScanRow = {
  day: string;
  scanned: number;
  pass: number;
  /** Rejected sections, which reports call "for salvage" (A-11). */
  reject: number;
};

export async function dailyScanStats(range: Range, db: Db = defaultDb()): Promise<DailyScanRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string>[]>`
    SELECT to_char((s."capturedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
      count(*) AS scanned,
      count(*) FILTER (WHERE s."finalVerdict" = 'PASS') AS pass,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS reject
    FROM scans s
    JOIN batches b ON b.id = s."batchId"
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      AND b.status <> 'CANCELLED' -- a cancelled roll never went on to cutting (Phase 26)
    GROUP BY 1`;
  return rows.map((r) => ({
    day: String(r.day),
    scanned: n(r.scanned as bigint),
    pass: n(r.pass as bigint),
    reject: n(r.reject as bigint),
  }));
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
  known: boolean;
  scans: number;
  pass: number;
  /** Sections rejected (for salvage) whose main defect was this type. */
  reject: number;
};

/**
 * Scans per defect type, by the scan's top detection (the one that drove the decision), split by
 * final verdict. Unknown class keys are grouped under their raw key. A key that was unknown when
 * scanned but is a defect type now (e.g. `crease`, added for yolo-v1, D-052) joins that type, so
 * each key is one row.
 */
export async function defectBreakdown(range: Range, db: Db = defaultDb()): Promise<DefectRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string | boolean>[]>`
    WITH top AS (
      SELECT DISTINCT ON (d."scanId") d."scanId", d."rawClassKey", d."defectTypeId"
      FROM detections d JOIN scans s ON s.id = d."scanId"
      JOIN batches b ON b.id = s."batchId"
      WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
        AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
        AND b.status <> 'CANCELLED' 
      ORDER BY d."scanId", d.confidence DESC
    )
    SELECT coalesce(t.key, top."rawClassKey") AS key,
      coalesce(t.label, top."rawClassKey") AS label,
      (t.id IS NOT NULL) AS known,
      count(*) AS scans,
      count(*) FILTER (WHERE s."finalVerdict" = 'PASS') AS pass,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS reject
    FROM top JOIN scans s ON s.id = top."scanId"
    LEFT JOIN defect_types t ON t.id = top."defectTypeId"
      OR (top."defectTypeId" IS NULL AND t.key = top."rawClassKey")
    GROUP BY 1, 2, 3
    ORDER BY count(*) DESC, 2`;
  return rows.map((r) => ({
    key: String(r.key),
    label: String(r.label),
    known: Boolean(r.known),
    scans: n(r.scans as bigint),
    pass: n(r.pass as bigint),
    reject: n(r.reject as bigint),
  }));
}
