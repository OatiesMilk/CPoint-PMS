import { type Db, defaultDb } from "./db";

/** A Manila calendar day (YYYY-MM-DD) as the @db.Date value Prisma stores (UTC midnight). */
export function dayValue(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** The saved day with its marks, or null when attendance wasn't taken that day. */
export function findAttendanceDay(day: string, db: Db = defaultDb()) {
  return db.attendanceDay.findUnique({
    where: { day: dayValue(day) },
    include: {
      marks: { select: { userId: true, present: true } },
      takenBy: { select: { name: true } },
    },
  });
}

/**
 * Everyone who could be on a day's roster: users created before the day ends (active or not; the
 * rules drop the inactive ones that weren't marked), plus anyone already marked on the day.
 */
export function listRosterCandidates(dayEnd: Date, markedUserIds: string[], db: Db = defaultDb()) {
  return db.user.findMany({
    where: { OR: [{ createdAt: { lt: dayEnd } }, { id: { in: markedUserIds } }] },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
}

/** First save of a day. A second, racing first save hits the unique day and fails. */
export function createAttendanceDay(day: string, takenById: string, at: Date, db: Db) {
  return db.attendanceDay.create({
    data: { day: dayValue(day), takenById, takenAt: at },
  });
}

/**
 * Re-save of a day, only if nobody saved it since the caller loaded it (`updatedAt` unchanged).
 * Returns the number of rows changed: 0 means someone else saved first.
 */
export async function touchAttendanceDay(
  id: string,
  expectedUpdatedAt: Date,
  takenById: string,
  at: Date,
  db: Db,
): Promise<number> {
  const { count } = await db.attendanceDay.updateMany({
    where: { id, updatedAt: expectedUpdatedAt },
    data: { takenById, takenAt: at },
  });
  return count;
}

/** Replace a day's marks with the ones just saved (one row per person on the roster). */
export async function replaceAttendanceMarks(
  attendanceDayId: string,
  marks: { userId: string; present: boolean }[],
  db: Db,
): Promise<void> {
  await db.attendanceMark.deleteMany({ where: { attendanceDayId } });
  await db.attendanceMark.createMany({
    data: marks.map((m) => ({ attendanceDayId, userId: m.userId, present: m.present })),
  });
}

/** Saved days between two Manila days (inclusive) with their marks, for day-level worker counts. */
export function listAttendanceDays(from: string, to: string, db: Db = defaultDb()) {
  return db.attendanceDay.findMany({
    where: { day: { gte: dayValue(from), lte: dayValue(to) } },
    include: { marks: { select: { userId: true, present: true } } },
  });
}
