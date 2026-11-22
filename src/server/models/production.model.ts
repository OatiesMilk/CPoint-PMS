import type { Prisma } from "@/generated/prisma/client";
import { dayValue } from "./attendance.model";
import { type Db, defaultDb } from "./db";

/**
 * Batches (Phase 27; before it production progression, Phase 23): the day plans (Phase 30E-2), the
 * lunch break and the finished batches (check-ins). Every read here is per batch or per day;
 * the only person attached to a row is who finished or corrected it, an audit fact that is never
 * totalled (D-008).
 */

const dayString = (d: Date) => d.toISOString().slice(0, 10);

// ───────────── day plans (Phase 30E-2, D-114) ─────────────

const planInclude = {
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
} satisfies Prisma.DayPlanInclude;

function planRow(r: Prisma.DayPlanGetPayload<{ include: typeof planInclude }>) {
  return { ...r, day: dayString(r.day) };
}

export type DayPlanRow = ReturnType<typeof planRow>;

/** The plans and Non-working marks from `from` to `to`, oldest first. */
export async function listDayPlans(from: string, to: string, db: Db = defaultDb()) {
  const rows = await db.dayPlan.findMany({
    where: { day: { gte: dayValue(from), lte: dayValue(to) } },
    orderBy: { day: "asc" },
    include: planInclude,
  });
  return rows.map(planRow);
}

export async function findDayPlan(day: string, db: Db = defaultDb()): Promise<DayPlanRow | null> {
  const row = await db.dayPlan.findUnique({ where: { day: dayValue(day) }, include: planInclude });
  return row ? planRow(row) : null;
}

export type DayPlanData = {
  kind: "PLANNED" | "NON_WORKING";
  rollsPlanned: number | null;
  quota: number | null;
  suggestedQuota: number | null;
  intervalMinutes: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

/** A new plan or mark for a day. */
export function insertDayPlan(
  day: string,
  data: DayPlanData,
  actorId: string,
  at: Date,
  db: Db = defaultDb(),
) {
  return db.dayPlan.create({
    data: {
      ...data,
      day: dayValue(day),
      createdById: actorId,
      updatedById: actorId,
      createdAt: at,
      updatedAt: at,
    },
  });
}

/**
 * Changes a day's plan only if nobody changed it since `seen` (its `updatedAt`); false when
 * someone did, so the caller answers STALE.
 */
export async function updateDayPlan(
  id: string,
  seen: Date,
  data: DayPlanData,
  actorId: string,
  at: Date,
  db: Db = defaultDb(),
): Promise<boolean> {
  const { count } = await db.dayPlan.updateMany({
    where: { id, updatedAt: seen },
    data: { ...data, updatedById: actorId, updatedAt: at },
  });
  return count === 1;
}

/** Undoes a Non-working mark (the day goes back to Not planned), only if unchanged since `seen`. */
export async function deleteDayPlan(id: string, seen: Date, db: Db = defaultDb()) {
  const { count } = await db.dayPlan.deleteMany({ where: { id, updatedAt: seen } });
  return count === 1;
}

// ───────────── lunch break (C-3) ─────────────

export async function listLunchBreaks(db: Db = defaultDb()) {
  const rows = await db.lunchBreak.findMany({
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((r) => ({ ...r, effectiveFrom: dayString(r.effectiveFrom) }));
}

export function countLunchBreaks(db: Db = defaultDb()) {
  return db.lunchBreak.count();
}

export function insertLunchBreak(
  data: {
    startTime: string | null;
    endTime: string | null;
    effectiveFrom: string;
    createdById: string | null;
    createdAt?: Date;
  },
  db: Db = defaultDb(),
) {
  return db.lunchBreak.create({ data: { ...data, effectiveFrom: dayValue(data.effectiveFrom) } });
}

// ───────────── check-ins ─────────────

const checkInInclude = {
  enteredBy: { select: { name: true } },
  correctedBy: { select: { name: true } },
} satisfies Prisma.ProductionCheckInInclude;

export type CheckInRow = Prisma.ProductionCheckInGetPayload<{ include: typeof checkInInclude }>;

export function listCheckIns(from: string, to: string, db: Db = defaultDb()) {
  return db.productionCheckIn.findMany({
    where: { day: { gte: dayValue(from), lte: dayValue(to) } },
    include: checkInInclude,
    orderBy: { slotAt: "asc" },
  });
}

export function findCheckIn(id: string, db: Db = defaultDb()) {
  return db.productionCheckIn.findUnique({ where: { id }, include: checkInInclude });
}

export function findCheckInBySlot(day: string, slotAt: Date, db: Db = defaultDb()) {
  return db.productionCheckIn.findUnique({
    where: { day_slotAt: { day: dayValue(day), slotAt } },
    include: checkInInclude,
  });
}

export function insertCheckIn(
  data: {
    day: string;
    slotAt: Date;
    enteredAt: Date;
    enteredById: string;
    constructorsPresent: number | null;
    constructorsOnRoster: number | null;
    notes: string | null;
    pairs: number;
    failedPairs: number;
    batchId: string | null;
  },
  db: Db,
) {
  const { day, ...rest } = data;
  return db.productionCheckIn.create({
    data: { ...rest, day: dayValue(day) },
    include: checkInInclude,
  });
}

/**
 * A same-day correction, only if nobody changed the batch since the caller loaded it. Returns
 * false when someone else saved first.
 */
export async function correctCheckIn(
  id: string,
  expectedUpdatedAt: Date,
  data: {
    correctedAt: Date;
    correctedById: string;
    correctionReason: string;
    pairs: number;
    failedPairs: number;
  },
  db: Db,
): Promise<boolean> {
  const { count } = await db.productionCheckIn.updateMany({
    where: { id, updatedAt: expectedUpdatedAt },
    data,
  });
  return count === 1;
}

/** The first day anyone entered a check-in, or null: days before it weren't counted yet. */
export async function firstCheckInDay(db: Db = defaultDb()): Promise<string | null> {
  const row = await db.productionCheckIn.findFirst({
    orderBy: { day: "asc" },
    select: { day: true },
  });
  return row ? dayString(row.day) : null;
}

// ───────────── queued batches (Phase 33, D-129) ─────────────

const batchInclude = {
  inspectionStartedBy: { select: { name: true } },
  prioritySetBy: { select: { name: true } },
  voidedBy: { select: { name: true } },
  checkIn: {
    select: {
      id: true,
      updatedAt: true,
      enteredAt: true,
      pairs: true,
      failedPairs: true,
      enteredBy: { select: { name: true } },
      // A correction stays visible on the batch, whichever day it was made (Phase 35B).
      correctedAt: true,
      correctionReason: true,
      correctedBy: { select: { name: true } },
    },
  },
} satisfies Prisma.ProductionBatchInclude;

function batchRow(r: Prisma.ProductionBatchGetPayload<{ include: typeof batchInclude }>) {
  return { ...r, day: dayString(r.day) };
}

export type BatchRow = ReturnType<typeof batchRow>;

/** Every batch row from `from` to `to`, oldest first. */
export async function listBatchRows(from: string, to: string, db: Db = defaultDb()) {
  const rows = await db.productionBatch.findMany({
    where: { day: { gte: dayValue(from), lte: dayValue(to) } },
    include: batchInclude,
    orderBy: [{ day: "asc" }, { number: "asc" }],
  });
  return rows.map(batchRow);
}

/** Batches still open or being inspected, any day (the Inspection queue). */
export async function listOpenBatchRows(db: Db = defaultDb()) {
  const rows = await db.productionBatch.findMany({
    where: { status: { in: ["OPEN", "INSPECTING"] } },
    include: batchInclude,
    orderBy: [{ slotAt: "asc" }, { number: "asc" }],
  });
  return rows.map(batchRow);
}

/**
 * Batches inspected or voided with a batch day from `from` on (the queue's Done list), or only of
 * `until` when it is given (a past day the Floor Manager looked up, Phase 35B).
 */
export async function listDoneBatchRows(from: string, until?: string, db: Db = defaultDb()) {
  const rows = await db.productionBatch.findMany({
    where: {
      status: { in: ["INSPECTED", "VOID"] },
      day: { gte: dayValue(from), ...(until ? { lte: dayValue(until) } : {}) },
    },
    include: batchInclude,
    orderBy: [{ slotAt: "desc" }, { number: "desc" }],
    take: 200,
  });
  return rows.map(batchRow);
}

export async function findBatch(id: string, db: Db = defaultDb()): Promise<BatchRow | null> {
  const row = await db.productionBatch.findUnique({ where: { id }, include: batchInclude });
  return row ? batchRow(row) : null;
}

export async function findBatchBySlot(
  day: string,
  slotAt: Date,
  db: Db = defaultDb(),
): Promise<BatchRow | null> {
  const row = await db.productionBatch.findUnique({
    where: { day_slotAt: { day: dayValue(day), slotAt } },
    include: batchInclude,
  });
  return row ? batchRow(row) : null;
}

/** The first batch whose code is this (any case), for search. */
export async function findBatchByCode(code: string, db: Db = defaultDb()) {
  const row = await db.productionBatch.findFirst({
    where: { code: { equals: code.trim(), mode: "insensitive" } },
    include: batchInclude,
  });
  return row ? batchRow(row) : null;
}

/**
 * Makes and removes a day's rows (Phase 33). Removes only open, normal rows nobody inspected; new
 * rows that already exist (another reader made them first) are skipped. Returns what changed.
 */
export async function applyBatchSync(
  day: string,
  sync: {
    insert: { number: number; code: string; startAt: Date; slotAt: Date; void: boolean }[];
    remove: string[];
  },
  voidReason: string,
  at: Date,
  db: Db,
): Promise<{ inserted: number; removed: number }> {
  const removed = sync.remove.length
    ? (
        await db.productionBatch.deleteMany({
          where: { id: { in: sync.remove }, status: "OPEN", priority: "NORMAL", checkIn: null },
        })
      ).count
    : 0;
  const inserted = sync.insert.length
    ? (
        await db.productionBatch.createMany({
          data: sync.insert.map((b) => ({
            code: b.code,
            day: dayValue(day),
            number: b.number,
            startAt: b.startAt,
            slotAt: b.slotAt,
            status: b.void ? ("VOID" as const) : ("OPEN" as const),
            ...(b.void ? { voidReason, voidedAt: at } : {}),
          })),
          skipDuplicates: true,
        })
      ).count
    : 0;
  return { inserted, removed };
}

/** Finishes from before Phase 33 that have no batch row linked yet. */
export function listUnlinkedCheckIns(from: string, to: string, db: Db = defaultDb()) {
  return db.productionCheckIn.findMany({
    where: { batchId: null, day: { gte: dayValue(from), lte: dayValue(to) } },
    select: { id: true, day: true, slotAt: true },
  });
}

/** Links a finish to its batch and marks the batch Inspected. */
export async function linkCheckIn(checkInId: string, batchId: string, db: Db) {
  await db.productionCheckIn.updateMany({
    where: { id: checkInId, batchId: null },
    data: { batchId },
  });
  await db.productionBatch.update({
    where: { id: batchId },
    data: { status: "INSPECTED" },
  });
}

/** A batch row for a finish whose slot the day's plan no longer gives (older data). */
export function insertBatchForCheckIn(
  data: { day: string; number: number; code: string; startAt: Date; slotAt: Date },
  db: Db,
) {
  const { day, ...rest } = data;
  return db.productionBatch.create({
    data: { ...rest, day: dayValue(day), status: "INSPECTED" },
  });
}

/**
 * Changes a batch only if nobody changed it since `seen` (its `updatedAt`) and it is still in one
 * of `statuses`; false when someone did, so the caller answers STALE.
 */
export async function updateBatch(
  id: string,
  seen: Date | null,
  statuses: ("OPEN" | "INSPECTING" | "INSPECTED" | "VOID")[],
  data: Prisma.ProductionBatchUncheckedUpdateManyInput,
  db: Db,
): Promise<boolean> {
  const { count } = await db.productionBatch.updateMany({
    where: { id, ...(seen ? { updatedAt: seen } : {}), status: { in: statuses } },
    data,
  });
  return count === 1;
}

/** When the queue began (A-61); null when every batch queues (a fresh or reset database). */
export async function getQueueStart(db: Db = defaultDb()): Promise<Date | null> {
  const row = await db.inspectionQueueStart.findUnique({ where: { id: 1 } });
  return row?.startedAt ?? null;
}

/** The demo week makes its batches in the past, so none is "from before the queue" (A-61). */
export async function clearQueueStart(db: Db = defaultDb()) {
  await db.inspectionQueueStart.deleteMany();
}
