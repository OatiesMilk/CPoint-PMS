import type { Stage, Verdict } from "@/generated/prisma/enums";
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
  rework: number;
  reject: number;
  pending: number;
  overridden: number;
  aiDecided: number;
  agreed: number;
  personResolved: number;
};

export async function dailyScanStats(range: Range, db: Db = defaultDb()): Promise<DailyScanRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string>[]>`
    SELECT to_char((s."capturedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
      count(*) AS scanned,
      count(*) FILTER (WHERE s."finalVerdict" = 'PASS') AS pass,
      count(*) FILTER (WHERE s."finalVerdict" = 'REWORK') AS rework,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS reject,
      count(*) FILTER (WHERE s.status = 'PENDING_REVIEW') AS pending,
      count(*) FILTER (WHERE s."isOverride") AS overridden,
      count(*) FILTER (WHERE s."aiVerdict" <> 'NEEDS_REVIEW' AND s."finalVerdict" IS NOT NULL) AS "aiDecided",
      count(*) FILTER (WHERE s."aiVerdict" <> 'NEEDS_REVIEW' AND s."finalVerdict" = s."aiVerdict") AS agreed,
      count(*) FILTER (WHERE s."aiVerdict" = 'NEEDS_REVIEW' AND s."finalVerdict" IS NOT NULL) AS "personResolved"
    FROM scans s
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
  return rows.map((r) => ({
    day: String(r.day),
    scanned: n(r.scanned as bigint),
    pass: n(r.pass as bigint),
    rework: n(r.rework as bigint),
    reject: n(r.reject as bigint),
    pending: n(r.pending as bigint),
    overridden: n(r.overridden as bigint),
    aiDecided: n(r.aiDecided as bigint),
    agreed: n(r.agreed as bigint),
    personResolved: n(r.personResolved as bigint),
  }));
}

/** Repairs marked done per Manila day. */
export async function dailyRepairsDone(range: Range, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ day: string; done: bigint }[]>`
    SELECT to_char((r."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
      count(*) AS done
    FROM rework_tickets r
    WHERE r.status = 'DONE'
      AND r."completedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND r."completedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
  return rows.map((r) => ({ day: r.day, done: n(r.done) }));
}

/** Batches started (first Preparation log) and completed (last log closed) per Manila day. */
export async function dailyProduction(range: Range, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ day: string; started: bigint; completed: bigint }[]>`
    WITH started AS (
      SELECT min(l."startedAt") AS at FROM batch_stage_logs l GROUP BY l."batchId"
    ), completed AS (
      SELECT max(l."endedAt") AS at
      FROM batch_stage_logs l JOIN batches b ON b.id = l."batchId"
      WHERE b.status = 'COMPLETED' GROUP BY l."batchId"
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
  rework: number;
  reject: number;
  pending: number;
};

/**
 * Scans per defect type, by the scan's top detection (the one that drove the decision), split by
 * final verdict. Unknown class keys are grouped under their raw key.
 */
export async function defectBreakdown(range: Range, db: Db = defaultDb()): Promise<DefectRow[]> {
  const rows = await db.$queryRaw<Record<string, bigint | string | boolean>[]>`
    WITH top AS (
      SELECT DISTINCT ON (d."scanId") d."scanId", d."rawClassKey", d."defectTypeId"
      FROM detections d JOIN scans s ON s.id = d."scanId"
      WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
        AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
      ORDER BY d."scanId", d.confidence DESC
    )
    SELECT coalesce(t.key, top."rawClassKey") AS key,
      coalesce(t.label, top."rawClassKey") AS label,
      (t.id IS NOT NULL) AS known,
      count(*) AS scans,
      count(*) FILTER (WHERE s."finalVerdict" = 'PASS') AS pass,
      count(*) FILTER (WHERE s."finalVerdict" = 'REWORK') AS rework,
      count(*) FILTER (WHERE s."finalVerdict" = 'REJECT') AS reject,
      count(*) FILTER (WHERE s."finalVerdict" IS NULL) AS pending
    FROM top JOIN scans s ON s.id = top."scanId"
    LEFT JOIN defect_types t ON t.id = top."defectTypeId"
    GROUP BY 1, 2, 3
    ORDER BY count(*) DESC, 2`;
  return rows.map((r) => ({
    key: String(r.key),
    label: String(r.label),
    known: Boolean(r.known),
    scans: n(r.scans as bigint),
    pass: n(r.pass as bigint),
    rework: n(r.rework as bigint),
    reject: n(r.reject as bigint),
    pending: n(r.pending as bigint),
  }));
}

/** AI verdict × final verdict counts (final null = still pending review). */
export async function verdictMatrix(range: Range, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ ai: Verdict; final: Verdict | null; count: bigint }[]>`
    SELECT s."aiVerdict" AS ai, s."finalVerdict" AS final, count(*) AS count
    FROM scans s
    WHERE s."capturedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND s."capturedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1, 2`;
  return rows.map((r) => ({ ai: r.ai, final: r.final, count: n(r.count) }));
}

/** Completed stage visits ending in the range: count, median and average duration (ms). */
export async function stageDurations(range: Range, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<
    { stage: Stage; visits: bigint; medianMs: number | null; avgMs: number | null }[]
  >`
    SELECT l.stage, count(*) AS visits,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM l."endedAt" - l."startedAt")) * 1000 AS "medianMs",
      avg(extract(epoch FROM l."endedAt" - l."startedAt")) * 1000 AS "avgMs"
    FROM batch_stage_logs l
    WHERE l."endedAt" IS NOT NULL
      AND l."endedAt" >= (${iso(range.start)}::timestamptz AT TIME ZONE 'UTC')
      AND l."endedAt" <  (${iso(range.end)}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
  return rows.map((r) => ({
    stage: r.stage,
    visits: n(r.visits),
    medianMs: r.medianMs === null ? null : Number(r.medianMs),
    avgMs: r.avgMs === null ? null : Number(r.avgMs),
  }));
}

/** Batches in progress per stage right now, and the longest wait (ms). */
export async function openStageWaits(now: Date, db: Db = defaultDb()) {
  const rows = await db.$queryRaw<{ stage: Stage; batches: bigint; longestMs: number }[]>`
    SELECT l.stage, count(*) AS batches,
      max(extract(epoch FROM (${iso(now)}::timestamptz AT TIME ZONE 'UTC') - l."startedAt")) * 1000 AS "longestMs"
    FROM batch_stage_logs l JOIN batches b ON b.id = l."batchId"
    WHERE l."endedAt" IS NULL AND b.status = 'IN_PROGRESS'
    GROUP BY 1`;
  return rows.map((r) => ({
    stage: r.stage,
    batches: n(r.batches),
    longestMs: Number(r.longestMs),
  }));
}
