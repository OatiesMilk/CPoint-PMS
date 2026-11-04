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
