import type { Prisma, RollStatus } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

// ───────────── Reports → Rolls (the Floor Manager) ─────────────

export type RollListFilters = {
  status?: RollStatus;
  supplierId?: string;
  /** Rolls added on or after this instant (the "days" filter). */
  since?: Date;
  q?: string;
  /** One leather item's rolls (Inventory → the item, Phase 30A). */
  itemId?: string;
};

/** No person on a roll list: who started or finished a roll is never shown or totalled (D-008). */
const listSelect = {
  id: true,
  code: true,
  tagCode: true,
  status: true,
  areaSqFt: true,
  receivedAt: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  cancelledAt: true,
  usedAt: true,
  defectAreaSqIn: true,
  defectSharePct: true,
  returnLimitPct: true,
  markedForReturn: true,
  returnDecision: true,
  returnedOn: true,
  supplier: { select: { id: true, name: true } },
  item: { select: { id: true, sku: true, name: true } },
  _count: { select: { scans: true } },
} satisfies Prisma.RollSelect;

export type RollListRow = Prisma.RollGetPayload<{ select: typeof listSelect }>;

function listWhere(filters: RollListFilters): Prisma.RollWhereInput {
  const q = filters.q?.trim();
  return {
    status: filters.status,
    supplierId: filters.supplierId,
    itemId: filters.itemId,
    ...(filters.since ? { createdAt: { gte: filters.since } } : {}),
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
    db.roll.findMany({
      where,
      select: listSelect,
      orderBy: [{ createdAt: "desc" }, { code: "desc" }],
      ...page,
    }),
    db.roll.count({ where }),
  ]);
  return { rows, total };
}

/**
 * The defects found on a page of rolls (Inventory → the item, Phase 30A): per roll and class, the
 * detections of each defect type the decision engine counted, never per person.
 */
export async function countDefectsForRolls(
  rollIds: string[],
  foundAtOrAbove: number,
  db: Db = defaultDb(),
) {
  if (rollIds.length === 0) return [];
  return db.$queryRaw<{ rollId: string; label: string; detections: bigint }[]>`
    SELECT s."batchId" AS "rollId", coalesce(t.label, d."rawClassKey") AS label,
      count(*) AS detections
    FROM detections d
    JOIN scans s ON s.id = d."scanId"
    LEFT JOIN defect_types t ON t.id = d."defectTypeId"
    WHERE s."batchId" = ANY(${rollIds}::uuid[])
      AND d.confidence >= ${foundAtOrAbove}
      AND (t.id IS NULL OR t."isActive")
    GROUP BY 1, 2
    ORDER BY 1, 3 DESC, 2`;
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
  tagCode: true,
  cancelledReason: true,
  returnNote: true,
  returnDecidedAt: true,
  usedCheckIn: { select: { id: true, day: true, slotAt: true } },
  scans: {
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      finalVerdict: true,
      capturedAt: true,
      imagePath: true,
      widthIn: true,
      defectAreaSqIn: true,
      flatSharePct: true,
      thresholdsSnapshot: true,
      detections: {
        orderBy: { confidence: "desc" },
        select: {
          rawClassKey: true,
          confidence: true,
          x: true,
          y: true,
          width: true,
          height: true,
          lengthIn: true,
          areaSqIn: true,
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

// ───────────── The photo export for measuring (Phase 30B) ─────────────

/** A roll by its code with its shots' image keys, for `npm run cv:roll-photos`. Reads only. */
export function findRollPhotos(code: string, db: Db = defaultDb()) {
  return db.roll.findUnique({
    where: { code },
    select: {
      code: true,
      areaSqFt: true,
      item: { select: { name: true } },
      supplier: { select: { name: true } },
      scans: {
        orderBy: { sequence: "asc" },
        select: {
          sequence: true,
          capturedAt: true,
          imagePath: true,
          imageMime: true,
          finalVerdict: true,
        },
      },
    },
  });
}

export type RollPhotosRow = NonNullable<Awaited<ReturnType<typeof findRollPhotos>>>;

// ───────────── Capture ─────────────

const openSelect = {
  id: true,
  code: true,
  tagCode: true,
  status: true,
  itemId: true,
  areaSqFt: true,
  startedAt: true,
  startedById: true,
  usedCheckInId: true,
  markedForReturn: true,
  returnDecision: true,
  supplier: { select: { name: true } },
  item: { select: { name: true } },
  _count: { select: { scans: true } },
} satisfies Prisma.RollSelect;

export type OpenRollRow = Prisma.RollGetPayload<{ select: typeof openSelect }>;

/** Rolls in stock and not scanned yet, the oldest first, for Capture's Scan a roll (Phase 30A). */
export function listReadyRolls(db: Db = defaultDb()): Promise<OpenRollRow[]> {
  return db.roll.findMany({
    where: { status: "IN_STOCK", item: { isActive: true } },
    select: openSelect,
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { code: "asc" }],
    take: 200,
  });
}

/** The rolls ticked Fully used in these batches before Phase 30E, for Batches' rows (history). */
export function listRollsUsedIn(checkInIds: string[], db: Db = defaultDb()) {
  if (checkInIds.length === 0) return Promise.resolve([]);
  return db.roll.findMany({
    where: { usedCheckInId: { in: checkInIds } },
    select: { id: true, code: true, usedCheckInId: true },
    orderBy: { code: "asc" },
  });
}

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

type RollMove =
  | { status: "OPEN"; startedAt: Date; startedById: string }
  | { status: "IN_STOCK"; startedAt: null; startedById: null }
  | { status: "FINISHED"; finishedAt: Date; finishedById: string }
  | {
      status: "CANCELLED";
      cancelledAt: Date;
      cancelledById: string;
      cancelledReason: string | null;
    };

/**
 * Moves a roll only if it is still in the status the caller saw (optimistic concurrency, D-019).
 * Returns false when someone else moved it first.
 */
export async function moveRoll(
  id: string,
  from: RollStatus,
  data: RollMove,
  db: Db = defaultDb(),
): Promise<boolean> {
  const { count } = await db.roll.updateMany({ where: { id, status: from }, data });
  return count === 1;
}

/**
 * Atomically reserves the next number for a roll-code prefix ("LR-MLT": 1, 2, 3, …), safe under
 * concurrent adds. Keyed by the prefix, so a code that changes and comes back never repeats.
 */
export async function nextRollCodeNumber(prefix: string, db: Db = defaultDb()): Promise<number> {
  const rows = await db.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO roll_code_sequences ("prefix", "lastValue") VALUES (${prefix}, 1)
    ON CONFLICT ("prefix") DO UPDATE SET "lastValue" = roll_code_sequences."lastValue" + 1
    RETURNING "lastValue"`;
  return rows[0].lastValue;
}

/** Whether a code is taken already (a roll from before could hold an LR- code as its tag only). */
export async function rollCodeTaken(code: string, db: Db = defaultDb()): Promise<boolean> {
  return (await db.roll.count({ where: { code } })) > 0;
}

/** A roll's shots' measures, for its share at Finish roll (Phase 30C). */
export function listRollShotMeasures(rollId: string, db: Db = defaultDb()) {
  return db.scan.findMany({
    where: { rollId },
    select: { defectAreaSqIn: true, flatSharePct: true },
  });
}

/** Saves a finished roll's share and whether it is marked (Phase 30C, D-110). */
export function saveRollMeasure(
  id: string,
  data: {
    defectAreaSqIn: number | null;
    defectSharePct: number | null;
    returnLimitPct: number;
    markedForReturn: boolean;
  },
  db: Db = defaultDb(),
) {
  return db.roll.update({ where: { id }, data });
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

/** How many rolls a leather item has (any status), so its category can't change under them. */
export function countItemRolls(itemId: string, db: Db = defaultDb()): Promise<number> {
  return db.roll.count({ where: { itemId } });
}
