import type { Prisma, RollStatus } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

// ───────────── Reports → Rolls (the Floor Manager) ─────────────

export type RollListFilters = {
  status?: RollStatus;
  supplierId?: string;
  /** Rolls started on or after this instant (the "days" filter). */
  since?: Date;
  q?: string;
};

/** No person on a roll list: who started or finished a roll is never shown or totalled (D-008). */
const listSelect = {
  id: true,
  code: true,
  tagCode: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  cancelledAt: true,
  supplier: { select: { id: true, name: true } },
  _count: { select: { scans: true } },
} satisfies Prisma.RollSelect;

export type RollListRow = Prisma.RollGetPayload<{ select: typeof listSelect }>;

function listWhere(filters: RollListFilters): Prisma.RollWhereInput {
  const q = filters.q?.trim();
  return {
    status: filters.status,
    supplierId: filters.supplierId,
    ...(filters.since ? { startedAt: { gte: filters.since } } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { tagCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listRolls(
  filters: RollListFilters,
  page: { skip: number; take: number },
  db: Db = defaultDb(),
): Promise<{ rows: RollListRow[]; total: number }> {
  const where = listWhere(filters);
  const [rows, total] = await Promise.all([
    db.roll.findMany({ where, select: listSelect, orderBy: { startedAt: "desc" }, ...page }),
    db.roll.count({ where }),
  ]);
  return { rows, total };
}

/** Sections per verdict for a page of rolls, for the list's Passed and Rejected columns. */
export async function countVerdictsForRolls(rollIds: string[], db: Db = defaultDb()) {
  if (rollIds.length === 0) return [];
  return db.scan.groupBy({
    by: ["rollId", "finalVerdict"],
    where: { rollId: { in: rollIds } },
    _count: { _all: true },
  });
}

const detailSelect = {
  ...listSelect,
  receivedAt: true,
  cancelledReason: true,
  scans: {
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      finalVerdict: true,
      capturedAt: true,
      imagePath: true,
      detections: {
        orderBy: { confidence: "desc" },
        select: {
          rawClassKey: true,
          confidence: true,
          isUnknownClass: true,
          defectType: { select: { label: true, outcome: true } },
        },
      },
    },
  },
} satisfies Prisma.RollSelect;

export type RollDetailRow = Prisma.RollGetPayload<{ select: typeof detailSelect }>;

export function findRollDetail(id: string, db: Db = defaultDb()): Promise<RollDetailRow | null> {
  return db.roll.findUnique({ where: { id }, select: detailSelect });
}

// ───────────── Capture ─────────────

const openSelect = {
  id: true,
  code: true,
  tagCode: true,
  status: true,
  startedAt: true,
  createdById: true,
  supplier: { select: { name: true } },
  _count: { select: { scans: true } },
} satisfies Prisma.RollSelect;

export type OpenRollRow = Prisma.RollGetPayload<{ select: typeof openSelect }>;

/** Every open roll, the newest first, for the Capture page's Roll dropdown. */
export function listOpenRolls(db: Db = defaultDb()): Promise<OpenRollRow[]> {
  return db.roll.findMany({
    where: { status: "OPEN" },
    select: openSelect,
    orderBy: { startedAt: "desc" },
    take: 100,
  });
}

/** One roll with its shot count, for the capture and the moves. */
export function findRollState(id: string, db: Db = defaultDb()): Promise<OpenRollRow | null> {
  return db.roll.findUnique({ where: { id }, select: openSelect });
}

export function insertRoll(data: Prisma.RollUncheckedCreateInput, db: Db = defaultDb()) {
  return db.roll.create({ data, select: openSelect });
}

/**
 * Closes a roll only if it is still open (optimistic concurrency, D-019). Returns false when
 * someone else finished or cancelled it first.
 */
export async function closeRoll(
  id: string,
  data:
    | { status: "FINISHED"; finishedAt: Date; finishedById: string }
    | {
        status: "CANCELLED";
        cancelledAt: Date;
        cancelledById: string;
        cancelledReason: string | null;
      },
  db: Db = defaultDb(),
): Promise<boolean> {
  const { count } = await db.roll.updateMany({ where: { id, status: "OPEN" }, data });
  return count === 1;
}

/** Atomically reserves the next yearly roll number (1, 2, 3, …), safe under concurrent starts. */
export async function nextRollNumber(year: number, db: Db = defaultDb()): Promise<number> {
  const rows = await db.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO batch_sequences ("year", "lastValue") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastValue" = batch_sequences."lastValue" + 1
    RETURNING "lastValue"`;
  return rows[0].lastValue;
}

/** Rolls open now (being captured), for the reports and the Camera page. */
export function countOpenRolls(db: Db = defaultDb()) {
  return db.roll.count({ where: { status: "OPEN" } });
}

/**
 * Locks an open roll's row so concurrent shots get distinct numbers, and says whether it is still
 * open. Call inside a transaction.
 */
export async function lockOpenRoll(id: string, db: Db): Promise<boolean> {
  const rows = await db.$queryRaw<{ status: string }[]>`
    SELECT status::text AS status FROM batches WHERE id = ${id}::uuid FOR UPDATE`;
  return rows[0]?.status === "OPEN";
}

export function countRolls(db: Db = defaultDb()) {
  return db.roll.count();
}
