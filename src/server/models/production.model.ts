import type { Prisma } from "@/generated/prisma/client";
import { dayValue } from "./attendance.model";
import { type Db, defaultDb } from "./db";

/**
 * Batches (Phase 27; before it production progression, Phase 23): the schedule, the lunch break,
 * the daily quota and the finished batches (check-ins). Every read here is per batch or per day;
 * the only person attached to a row is who finished or corrected it, an audit fact that is never
 * totalled (D-008).
 */

const dayString = (d: Date) => d.toISOString().slice(0, 10);

// ───────────── schedule ─────────────

export async function listSchedules(db: Db = defaultDb()) {
  const rows = await db.productionSchedule.findMany({
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((r) => ({ ...r, effectiveFrom: dayString(r.effectiveFrom) }));
}

export function countSchedules(db: Db = defaultDb()) {
  return db.productionSchedule.count();
}

export function insertSchedule(
  data: {
    shiftStart: string;
    shiftEnd: string;
    intervalMinutes: number | null;
    workingDays: number[];
    effectiveFrom: string;
    createdById: string | null;
    createdAt?: Date;
  },
  db: Db = defaultDb(),
) {
  return db.productionSchedule.create({
    data: { ...data, effectiveFrom: dayValue(data.effectiveFrom) },
  });
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

// ───────────── quotas ─────────────

export async function listQuotas(db: Db = defaultDb()) {
  const rows = await db.dailyQuota.findMany({
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((r) => ({ ...r, effectiveFrom: dayString(r.effectiveFrom) }));
}

export function insertQuota(
  data: {
    pairs: number;
    suggestedPairs: number | null;
    effectiveFrom: string;
    createdById: string;
    createdAt?: Date;
  },
  db: Db = defaultDb(),
) {
  return db.dailyQuota.create({ data: { ...data, effectiveFrom: dayValue(data.effectiveFrom) } });
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
