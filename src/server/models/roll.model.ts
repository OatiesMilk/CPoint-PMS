import type { Prisma, RollMoveReason, RollStatus } from "@/generated/prisma/client";
import type { RollReportStatus } from "@/lib/roll-rules";
import { type Db, defaultDb } from "./db";

// ───────────── Reports → Rolls (the Floor Manager) ─────────────

export type RollListFilters = {
  status?: RollStatus;
  /** Reports → Rolls: Not yet scanned, Scanning passed or Returned to supplier (D-116). */
  reportStatus?: RollReportStatus;
  supplierId?: string;
  /** Rolls added on or after this instant (the "days" filter). */
  since?: Date;
  /** Rolls added before this instant (the period picker, Phase 35). */
  until?: Date;
  /** Where the roll is kept now (Phase 35). */
  locationId?: string;
  q?: string;
  /** One leather item's rolls (Inventory → the item, Phase 30A). */
  itemId?: string;
};

/** No person on a roll list: who started or finished a roll is never shown or totalled (D-008). */
const listSelect = {
  id: true,
  code: true,
  formerCode: true,
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
  // Where it is kept (Phase 32, D-128)
  locationId: true,
  pickedUpAt: true,
  location: { select: { id: true, code: true, name: true } },
  supplier: { select: { id: true, name: true } },
  item: { select: { id: true, sku: true, name: true } },
  _count: { select: { scans: true } },
} satisfies Prisma.RollSelect;

export type RollListRow = Prisma.RollGetPayload<{ select: typeof listSelect }>;

/** Scanned and over the defect limit, with no Phase 30C decision: Returned to supplier (D-116). */
const flaggedForReturn: Prisma.RollWhereInput = {
  status: { in: ["FINISHED", "USED"] },
  markedForReturn: true,
  returnDecision: null,
};

const REPORT_STATUS_WHERE: Record<RollReportStatus, Prisma.RollWhereInput> = {
  NOT_SCANNED: { status: "IN_STOCK" },
  PASSED: { status: { in: ["FINISHED", "USED"] }, NOT: flaggedForReturn },
  RETURNED: { OR: [{ status: "RETURNED" }, flaggedForReturn] },
};

function listWhere(filters: RollListFilters): Prisma.RollWhereInput {
  const q = filters.q?.trim();
  return {
    ...(filters.reportStatus ? { AND: [REPORT_STATUS_WHERE[filters.reportStatus]] } : {}),
    status: filters.status,
    supplierId: filters.supplierId,
    itemId: filters.itemId,
    locationId: filters.locationId,
    ...(filters.since || filters.until
      ? { createdAt: { gte: filters.since, lt: filters.until } }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { formerCode: { contains: q, mode: "insensitive" } },
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
 * The start and finish of every scanned roll the filters match (D-121): for the average scanning
 * time above Reports → Rolls, over all pages, not just the one shown.
 */
export function listRollTimes(filters: RollListFilters, db: Db = defaultDb()) {
  return db.roll.findMany({
    where: { AND: [listWhere(filters), { startedAt: { not: null }, finishedAt: { not: null } }] },
    select: { startedAt: true, finishedAt: true },
  });
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
  /** For the Floor Manager's stale check when editing the details (Phase 35B). */
  updatedAt: true,
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
  // For the Floor Manager's corrections (Phase 35B).
  receivedAt: true,
  returnNote: true,
  updatedAt: true,
  startedAt: true,
  startedById: true,
  usedCheckInId: true,
  markedForReturn: true,
  returnDecision: true,
  locationId: true,
  pickedUpAt: true,
  location: { select: { id: true, code: true, name: true } },
  supplier: { select: { name: true } },
  item: { select: { name: true } },
  _count: { select: { scans: true } },
  // The roll's scale (D-121): its latest measured shot, set by the marker card at the first shot.
  scans: {
    where: { widthIn: { not: null } },
    orderBy: { sequence: "desc" },
    take: 1,
    select: { sequence: true, widthIn: true, imageWidth: true, imageHeight: true },
  },
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

/**
 * The Floor Manager's corrections (Phase 35B): only if nobody changed the roll since the caller
 * loaded it. Returns false when someone else saved first.
 */
export async function updateRollDetails(
  id: string,
  expectedUpdatedAt: Date,
  data: {
    tagCode?: string | null;
    receivedAt?: Date;
    areaSqFt?: number;
    returnNote?: string | null;
  },
  db: Db,
): Promise<boolean> {
  const { count } = await db.roll.updateMany({
    where: { id, updatedAt: expectedUpdatedAt },
    data,
  });
  return count === 1;
}

/** Picking or removing a roll also clears its location (Phase 32). */
type LocationFields = { locationId?: string | null; locatedAt?: Date | null };

type RollMove = LocationFields &
  (
    | { status: "OPEN"; startedAt: Date; startedById: string }
    | { status: "IN_STOCK"; startedAt: null; startedById: null }
    | { status: "FINISHED"; finishedAt: Date; finishedById: string }
    | {
        status: "CANCELLED";
        cancelledAt: Date;
        cancelledById: string;
        cancelledReason: string | null;
      }
  );

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
 * Every roll code that starts with a prefix ("LR-BLC-"), for the next free number and the taken
 * check in Add rolls (Phase 42): read inside the save's transaction.
 */
export async function listRollCodesWithPrefix(
  prefix: string,
  db: Db = defaultDb(),
): Promise<string[]> {
  const rows = await db.roll.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  });
  return rows.map((r) => r.code);
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

/** Rolls open now (being captured), for the reports and Capture. */
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

/**
 * Each roll finished between two instants (Phase 30E-2): when its scan was finished at Capture and
 * what the D-116 rule needs to tell a returned roll from a passed one. Every roll finished,
 * whatever happened to it after, except a cancelled (removed) one. For planned against scanned per
 * day (Capture, the planning calendar).
 */
export async function listRollFinishes(start: Date, end: Date, db: Db = defaultDb()) {
  const rows = await db.roll.findMany({
    where: { finishedAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    select: { finishedAt: true, status: true, markedForReturn: true, returnDecision: true },
  });
  return rows.map((r) => ({ ...r, finishedAt: r.finishedAt as Date }));
}

/**
 * The rolls whose scan finished between two instants with their leather item's name, for what went
 * into each batch (Phase 33, A-83). A removed roll is left out.
 */
export async function listRollsFinishedWithItem(start: Date, end: Date, db: Db = defaultDb()) {
  const rows = await db.roll.findMany({
    where: { finishedAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    select: { finishedAt: true, item: { select: { name: true } } },
    orderBy: { finishedAt: "asc" },
  });
  return rows.map((r) => ({ finishedAt: r.finishedAt as Date, item: r.item?.name ?? null }));
}

// ───────────── Where a roll is kept (Phase 32, D-128) ─────────────

/**
 * Sets a roll's location only if it still has the status and location the caller saw (D-019).
 * Returns false when someone else moved it first.
 */
export async function setRollLocation(
  id: string,
  seen: { status: RollStatus; locationId: string | null },
  data: { locationId: string | null; locatedAt: Date | null; pickedUpAt?: Date },
  db: Db = defaultDb(),
): Promise<boolean> {
  const { count } = await db.roll.updateMany({
    where: { id, status: seen.status, locationId: seen.locationId },
    data,
  });
  return count === 1;
}

export function insertRollMove(
  data: {
    rollId: string;
    fromLocationId: string | null;
    toLocationId: string | null;
    reason: RollMoveReason;
    note?: string | null;
    byId: string;
    at: Date;
  },
  db: Db = defaultDb(),
) {
  return db.rollMove.create({ data: { ...data, note: data.note ?? null }, select: { id: true } });
}

/** A roll's location history, newest first. No person: who moved it is for the audit only (A-78). */
export function listRollMoves(rollId: string, db: Db = defaultDb()) {
  return db.rollMove.findMany({
    where: { rollId },
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      reason: true,
      note: true,
      at: true,
      fromLocation: { select: { code: true, name: true } },
      toLocation: { select: { code: true, name: true } },
    },
  });
}

export type RollMoveRow = Awaited<ReturnType<typeof listRollMoves>>[number];

/** Where each roll was last taken from at Capture, to prefill Put back (Phase 32). */
export async function lastTakenFrom(
  rollIds: string[],
  db: Db = defaultDb(),
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (rollIds.length === 0) return out;
  const moves = await db.rollMove.findMany({
    where: { rollId: { in: rollIds }, reason: "TAKEN_FOR_USE" },
    orderBy: [{ at: "desc" }, { id: "desc" }],
    select: { rollId: true, fromLocationId: true },
  });
  for (const m of moves) if (!out.has(m.rollId)) out.set(m.rollId, m.fromLocationId);
  return out;
}

/** Rolls by id with what a move, a label or Find roll needs. */
export function findRollsByIds(ids: string[], db: Db = defaultDb()): Promise<RollListRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return db.roll.findMany({ where: { id: { in: ids } }, select: listSelect });
}

/** The rolls kept in one location now, by code. */
export function listRollsInLocation(locationId: string, db: Db = defaultDb()) {
  return db.roll.findMany({
    where: { locationId },
    select: listSelect,
    orderBy: { code: "asc" },
    take: 200,
  });
}

/**
 * Find roll: the roll whose code is exactly this first, then codes and supplier tags containing
 * it (case-insensitive), at most 10. Removed rolls are found too, so their story can be read.
 */
export async function findRollsByCodeOrTag(q: string, db: Db = defaultDb()) {
  // An old label or claim sheet still names the roll's code from before Phase 33 (D-129).
  const exact =
    (await db.roll.findUnique({ where: { code: q }, select: listSelect })) ??
    (await db.roll.findUnique({ where: { formerCode: q }, select: listSelect }));
  const more = await db.roll.findMany({
    where: {
      ...(exact ? { NOT: { id: exact.id } } : {}),
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { formerCode: { contains: q, mode: "insensitive" } },
        { tagCode: { contains: q, mode: "insensitive" } },
      ],
    },
    select: listSelect,
    orderBy: [{ createdAt: "desc" }, { code: "asc" }],
    take: exact ? 9 : 10,
  });
  return exact ? [exact, ...more] : more;
}

/** A leather item's rolls still in stock, by code, for their labels (Phase 32). */
export async function listInStockRollIds(itemId: string, db: Db = defaultDb()): Promise<string[]> {
  const rows = await db.roll.findMany({
    where: { itemId, status: "IN_STOCK" },
    select: { id: true },
    orderBy: { code: "asc" },
    take: 200,
  });
  return rows.map((r) => r.id);
}
