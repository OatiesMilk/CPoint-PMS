import type { BatchStatus, Prisma, Stage } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

export type BatchListFilters = {
  status?: BatchStatus;
  stage?: Stage;
  shoeTypeId?: string;
  q?: string;
};

const listInclude = {
  shoeType: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  stageLogs: { where: { endedAt: null }, select: { stage: true, startedAt: true }, take: 1 },
} satisfies Prisma.BatchInclude;

export type BatchListRow = Prisma.BatchGetPayload<{ include: typeof listInclude }>;

function listWhere(filters: BatchListFilters): Prisma.BatchWhereInput {
  const q = filters.q?.trim();
  return {
    status: filters.status,
    shoeTypeId: filters.shoeTypeId,
    // A stage filter only makes sense for batches that are actually on the line.
    ...(filters.stage
      ? { currentStage: filters.stage, status: filters.status ?? "IN_PROGRESS" }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { rollCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listBatches(
  filters: BatchListFilters,
  page: { skip: number; take: number },
  db: Db = defaultDb(),
): Promise<{ rows: BatchListRow[]; total: number }> {
  const where = listWhere(filters);
  const [rows, total] = await Promise.all([
    db.batch.findMany({ where, include: listInclude, orderBy: { createdAt: "desc" }, ...page }),
    db.batch.count({ where }),
  ]);
  return { rows, total };
}

export function countAllBatches(db: Db = defaultDb()) {
  return db.batch.count();
}

const detailInclude = {
  shoeType: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  stageLogs: {
    orderBy: { startedAt: "asc" },
    include: { startedBy: { select: { name: true } }, endedBy: { select: { name: true } } },
  },
} satisfies Prisma.BatchInclude;

export type BatchDetailRow = Prisma.BatchGetPayload<{ include: typeof detailInclude }>;

export function findBatchDetail(id: string, db: Db = defaultDb()): Promise<BatchDetailRow | null> {
  return db.batch.findUnique({ where: { id }, include: detailInclude });
}

export function findBatchById(id: string, db: Db = defaultDb()) {
  return db.batch.findUnique({ where: { id } });
}

export function insertBatch(data: Prisma.BatchUncheckedCreateInput, db: Db = defaultDb()) {
  return db.batch.create({ data });
}

export function updateBatchFields(
  id: string,
  data: Prisma.BatchUncheckedUpdateInput,
  db: Db = defaultDb(),
) {
  return db.batch.update({ where: { id }, data });
}

/**
 * Moves a batch only if it is still in the state the caller saw (optimistic concurrency).
 * Returns false when someone else changed it first.
 */
export async function transitionBatch(
  id: string,
  from: { status: BatchStatus; currentStage: Stage },
  to: { status: BatchStatus; currentStage: Stage; cancelledReason?: string },
  db: Db = defaultDb(),
): Promise<boolean> {
  const { count } = await db.batch.updateMany({
    where: { id, status: from.status, currentStage: from.currentStage },
    data: to,
  });
  return count === 1;
}

/** Atomically reserves the next yearly batch number (1, 2, 3, …), safe under concurrent creates. */
export async function nextBatchNumber(year: number, db: Db = defaultDb()): Promise<number> {
  const rows = await db.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO batch_sequences ("year", "lastValue") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastValue" = batch_sequences."lastValue" + 1
    RETURNING "lastValue"`;
  return rows[0].lastValue;
}

export async function inProgressByStage(db: Db = defaultDb()) {
  const [counts, openLogs, planned] = await Promise.all([
    db.batch.groupBy({
      by: ["currentStage"],
      where: { status: "IN_PROGRESS" },
      _count: { _all: true },
    }),
    db.batchStageLog.groupBy({
      by: ["stage"],
      where: { endedAt: null, batch: { status: "IN_PROGRESS" } },
      _min: { startedAt: true },
    }),
    db.batch.count({ where: { status: "PLANNED" } }),
  ]);
  return { counts, openLogs, planned };
}

const prepSelect = {
  id: true,
  code: true,
  rollCode: true,
  status: true,
  currentStage: true,
  shoeType: { select: { name: true } },
  stageLogs: { where: { endedAt: null }, select: { startedAt: true }, take: 1 },
} satisfies Prisma.BatchSelect;

export type PreparationBatch = Prisma.BatchGetPayload<{ select: typeof prepSelect }>;

/** Batches the camera can feed: in progress at Preparation, longest-waiting first. */
export async function listBatchesAtPreparation(db: Db = defaultDb()): Promise<PreparationBatch[]> {
  const rows = await db.batch.findMany({
    where: { status: "IN_PROGRESS", currentStage: "PREPARATION" },
    select: prepSelect,
  });
  const started = (b: PreparationBatch) => b.stageLogs[0]?.startedAt.getTime() ?? 0;
  return rows.sort((a, b) => started(a) - started(b));
}

export function findPreparationBatchById(
  id: string,
  db: Db = defaultDb(),
): Promise<PreparationBatch | null> {
  return db.batch.findUnique({ where: { id }, select: prepSelect });
}

/** Row lock so concurrent scans for one batch get distinct sequence numbers. Call inside a transaction. */
export async function lockBatchRow(id: string, db: Db): Promise<void> {
  await db.$queryRaw`SELECT id FROM batches WHERE id = ${id}::uuid FOR UPDATE`;
}

/** Batches that can still take work (e.g. receive salvage): planned or in progress. */
export function listOpenBatches(db: Db = defaultDb()) {
  return db.batch.findMany({
    where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
    select: { id: true, code: true, rollCode: true, status: true, currentStage: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function countBatches(db: Db = defaultDb()) {
  return db.batch.count();
}
