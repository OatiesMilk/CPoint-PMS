import type { Stage } from "@/lib/repair-rules";
import { dayValue } from "./attendance.model";
import { type Db, defaultDb } from "./db";

/**
 * Who works at which stage on a day, and the counts of pairs at each stage (Phase 34, D-130).
 * Counts are one shared snapshot per stage and day, appended on every save; an assignment is the
 * Floor Manager's plan, never a score (D-008).
 */

const dayString = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The Floor Manager's saved assignments for a day, without anyone who has Capture access: a
 * constructor with Capture access is stationed at Preparation, whatever was saved (Addendum 1,
 * A-95), so their rows (from before they were given access) are ignored.
 */
export async function listStoredAssignments(day: string, db: Db = defaultDb()) {
  const rows = await db.stageAssignment.findMany({
    where: { day: dayValue(day), user: { canCapture: false } },
    select: { stage: true, userId: true, user: { select: { name: true } } },
    orderBy: [{ stage: "asc" }, { user: { name: "asc" } }],
  });
  return rows.map((r) => ({ stage: r.stage as Stage, userId: r.userId, name: r.user.name }));
}

/**
 * Active Shoe Constructors the System Admin has allowed to capture (Addendum 1, A-95): they are at
 * Preparation every working day. Read from `User.canCapture`, nothing is stored, so a change
 * applies at once.
 */
export function listCaptureConstructors(db: Db = defaultDb()) {
  return db.user.findMany({
    where: { role: "SHOE_CONSTRUCTOR", isActive: true, canCapture: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Who is at which stage on a day: the saved assignments plus the Capture-access constructors at
 * Preparation. This is what the board, My stage, the counts and the repairs' Back check read.
 */
export async function listAssignments(day: string, db: Db = defaultDb()) {
  const [stored, capture] = await Promise.all([
    listStoredAssignments(day, db),
    listCaptureConstructors(db),
  ]);
  return withCaptureAtPreparation(stored, capture);
}

/** The saved assignments with the Capture-access constructors added at Preparation. */
export function withCaptureAtPreparation(
  stored: { stage: Stage; userId: string; name: string }[],
  capture: { id: string; name: string }[],
) {
  const derived = capture.map((c) => ({
    stage: "PREPARATION" as Stage,
    userId: c.id,
    name: c.name,
  }));
  return [...stored, ...derived].sort(
    (a, b) => a.stage.localeCompare(b.stage) || a.name.localeCompare(b.name),
  );
}

/** The latest earlier day that has assignments (the prefill source, A-74). */
export async function latestAssignedDayBefore(day: string, db: Db = defaultDb()) {
  const row = await db.stageAssignment.findFirst({
    where: { day: { lt: dayValue(day) } },
    orderBy: { day: "desc" },
    select: { day: true },
  });
  return row ? dayString(row.day) : null;
}

/** Replaces a day's assignments in one go (the caller runs it in a transaction). */
export async function replaceAssignments(
  day: string,
  rows: { stage: Stage; userId: string }[],
  assignedById: string,
  db: Db,
) {
  await db.stageAssignment.deleteMany({ where: { day: dayValue(day) } });
  if (rows.length)
    await db.stageAssignment.createMany({
      data: rows.map((r) => ({
        day: dayValue(day),
        stage: r.stage,
        userId: r.userId,
        assignedById,
      })),
    });
}

/** Active Shoe Constructors, for the Plan dialog and the assignment checks. */
export function listActiveConstructors(db: Db = defaultDb()) {
  return db.user.findMany({
    where: { role: "SHOE_CONSTRUCTOR", isActive: true },
    select: { id: true, name: true, canCapture: true },
    orderBy: { name: "asc" },
  });
}

export function insertCount(
  data: {
    day: string;
    stage: Stage;
    pairs: number;
    enteredById: string;
    enteredAt: Date;
    batchId: string | null;
  },
  db: Db,
) {
  const { day, ...rest } = data;
  return db.stageCount.create({ data: { ...rest, day: dayValue(day) } });
}

export async function listCounts(from: string, to: string, db: Db = defaultDb()) {
  const rows = await db.stageCount.findMany({
    where: { day: { gte: dayValue(from), lte: dayValue(to) } },
    select: { day: true, stage: true, pairs: true, enteredAt: true },
    orderBy: { enteredAt: "asc" },
  });
  return rows.map((r) => ({
    day: dayString(r.day),
    stage: r.stage as Stage,
    pairs: r.pairs,
    enteredAt: r.enteredAt,
  }));
}
