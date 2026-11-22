import type { Prisma } from "@/generated/prisma/client";
import { manilaDayStart, addDays } from "@/lib/report-rules";
import type { FindingLine, RepairStatus, Stage } from "@/lib/repair-rules";
import { dayValue } from "./attendance.model";
import { type Db, defaultDb } from "./db";

/**
 * Final-product defects, findings and repair jobs (Phase 34, D-130). Findings and jobs belong to a
 * batch or a defect type; nothing here is per person. The only people attached to a job are who
 * marked it back and who inspected it, log-book facts that are never totalled (D-008).
 */

const dayString = (d: Date) => d.toISOString().slice(0, 10);

// ───────────── final defect types (data, A-62) ─────────────

export function listFinalDefectTypes(db: Db = defaultDb()) {
  return db.finalDefectType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}

export function findFinalDefectType(id: string, db: Db = defaultDb()) {
  return db.finalDefectType.findUnique({ where: { id } });
}

export function ensureFinalDefectType(
  data: { key: string; label: string; description?: string | null; sortOrder: number },
  db: Db = defaultDb(),
) {
  return db.finalDefectType.upsert({ where: { key: data.key }, create: data, update: {} });
}

// ───────────── findings ─────────────

const findingInclude = {
  finalDefectType: { select: { key: true, label: true } },
} satisfies Prisma.InspectionFindingInclude;

export type FindingRow = Prisma.InspectionFindingGetPayload<{ include: typeof findingInclude }>;

export function listFindingsForCheckIn(checkInId: string, db: Db = defaultDb()) {
  return db.inspectionFinding.findMany({
    where: { checkInId },
    include: findingInclude,
    orderBy: { createdAt: "asc" },
  });
}

/** The lines of several check-ins at once, for the Today and Queue cards. */
export function listFindingsForCheckIns(checkInIds: string[], db: Db = defaultDb()) {
  if (checkInIds.length === 0) return Promise.resolve([] as FindingRow[]);
  return db.inspectionFinding.findMany({
    where: { checkInId: { in: checkInIds } },
    include: findingInclude,
    orderBy: { createdAt: "asc" },
  });
}

/** Each repair's status with the check-in it came from, to tell whether a correction may change lines. */
export function listRepairStatusesOfCheckIns(checkInIds: string[], db: Db = defaultDb()) {
  if (checkInIds.length === 0)
    return Promise.resolve([] as { status: RepairStatus; checkInId: string }[]);
  return db.repairJob
    .findMany({
      where: { finding: { checkInId: { in: checkInIds } } },
      select: { status: true, finding: { select: { checkInId: true } } },
    })
    .then((rows) =>
      rows.map((r) => ({ status: r.status as RepairStatus, checkInId: r.finding.checkInId })),
    );
}

export function findFinding(id: string, db: Db = defaultDb()) {
  return db.inspectionFinding.findUnique({
    where: { id },
    include: {
      ...findingInclude,
      checkIn: { select: { id: true, day: true, batch: { select: { code: true } } } },
    },
  });
}

export function insertFinding(checkInId: string, line: FindingLine, db: Db) {
  return db.inspectionFinding.create({
    data: {
      checkInId,
      finalDefectTypeId: line.finalDefectTypeId,
      pairs: line.pairs,
      remedy: line.remedy,
      returnStage: line.returnStage,
      note: line.note,
    },
    include: findingInclude,
  });
}

export function setFindingRemedy(
  id: string,
  data: { remedy: "NOT_FIXABLE"; returnStage: null },
  db: Db,
) {
  return db.inspectionFinding.update({ where: { id }, data });
}

/** Removes a check-in's findings and every repair job from them (a correction, A-93). */
export async function deleteFindingsOfCheckIn(checkInId: string, db: Db) {
  const findings = await db.inspectionFinding.findMany({
    where: { checkInId },
    select: { id: true },
  });
  const ids = findings.map((f) => f.id);
  await db.repairJob.deleteMany({ where: { findingId: { in: ids } } });
  await db.inspectionFinding.deleteMany({ where: { id: { in: ids } } });
}

export function suggestionFacts(since: Date, db: Db = defaultDb()) {
  return db.inspectionFinding.findMany({
    where: { createdAt: { gte: since } },
    select: { finalDefectTypeId: true, remedy: true, returnStage: true, createdAt: true },
  });
}

// ───────────── repair jobs ─────────────

const jobInclude = {
  finding: {
    select: {
      id: true,
      pairs: true,
      note: true,
      finalDefectType: { select: { key: true, label: true } },
      checkIn: { select: { id: true, day: true, batch: { select: { code: true } } } },
    },
  },
  backBy: { select: { name: true } },
  inspectedBy: { select: { name: true } },
  /** The jobs it sent back again, to tell whether its inspection may still be corrected (Phase 35B). */
  children: { select: { id: true, code: true, status: true, stage: true, pairs: true } },
} satisfies Prisma.RepairJobInclude;

export type RepairRow = Prisma.RepairJobGetPayload<{ include: typeof jobInclude }>;

export function findRepair(id: string, db: Db = defaultDb()) {
  return db.repairJob.findUnique({ where: { id }, include: jobInclude });
}

export function listRepairsByStatus(statuses: RepairStatus[], db: Db = defaultDb()) {
  return db.repairJob.findMany({
    where: { status: { in: statuses } },
    include: jobInclude,
    orderBy: { sentAt: "asc" },
  });
}

/** Repairs inspected (or cancelled) since `from`, for the queue's Inspected and void list. */
export function listFinishedRepairs(from: Date, until?: Date, db: Db = defaultDb()) {
  return db.repairJob.findMany({
    where: { status: "DONE", inspectedAt: { gte: from, ...(until ? { lt: until } : {}) } },
    include: jobInclude,
    orderBy: { inspectedAt: "desc" },
  });
}

export function listRepairsOfCheckIn(checkInId: string, db: Db = defaultDb()) {
  return db.repairJob.findMany({
    where: { finding: { checkInId } },
    select: { id: true, code: true, status: true, stage: true, pairs: true },
    orderBy: { code: "asc" },
  });
}

export async function repairCodesWithPrefix(prefix: string, db: Db = defaultDb()) {
  const rows = await db.repairJob.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  return rows.map((r) => r.code);
}

export function insertRepair(
  data: {
    code: string;
    findingId: string;
    parentId?: string | null;
    pairs: number;
    stage: Stage;
    sentAt: Date;
  },
  db: Db,
) {
  return db.repairJob.create({ data: { ...data, parentId: data.parentId ?? null } });
}

/**
 * Moves a job on only if it is still in one of `from` (so two people tapping at once leave the
 * second a stale answer). Returns false when it had already moved.
 */
export async function transitionRepair(
  id: string,
  from: RepairStatus[],
  data: Prisma.RepairJobUncheckedUpdateManyInput,
  db: Db,
): Promise<boolean> {
  const { count } = await db.repairJob.updateMany({
    where: { id, status: { in: from } },
    data,
  });
  return count === 1;
}

/**
 * Rewrites an inspected job's result only if nobody changed it since the caller loaded it (the Floor
 * Manager's correction, Phase 35B). Returns false when someone else saved first.
 */
export async function correctRepairResult(
  id: string,
  expectedUpdatedAt: Date,
  data: { passedPairs: number; scrappedPairs: number; resentPairs: number },
  db: Db,
): Promise<boolean> {
  const { count } = await db.repairJob.updateMany({
    where: { id, status: "DONE", updatedAt: expectedUpdatedAt },
    data,
  });
  return count === 1;
}

/** Changes a sent-back job's stage and pairs while it is still At stage; false when it moved on. */
export async function reshapeRepair(
  id: string,
  data: { stage: Stage; pairs: number },
  db: Db,
): Promise<boolean> {
  const { count } = await db.repairJob.updateMany({ where: { id, status: "AT_STAGE" }, data });
  return count === 1;
}

/** Removes sent-back jobs that are still At stage; false when one had moved on. */
export async function deleteAtStageRepairs(ids: string[], db: Db): Promise<boolean> {
  if (ids.length === 0) return true;
  const { count } = await db.repairJob.deleteMany({
    where: { id: { in: ids }, status: "AT_STAGE" },
  });
  return count === ids.length;
}

/** Jobs per stage that are at the stage now, with their defect, for the board and My stage. */
export function listRepairsAtStages(db: Db = defaultDb()) {
  return listRepairsByStatus(["AT_STAGE"], db);
}

/** Pairs that passed after repair, by the day they were inspected. */
export async function repairInspectionsBetween(from: string, to: string, db: Db = defaultDb()) {
  const rows = await db.repairJob.findMany({
    where: {
      status: "DONE",
      inspectedAt: { gte: manilaDayStart(from), lt: manilaDayStart(addDays(to, 1)) },
    },
    select: { inspectedAt: true, passedPairs: true, status: true },
  });
  return rows.map((r) => ({
    status: r.status as RepairStatus,
    inspectedAt: r.inspectedAt as Date,
    passedPairs: r.passedPairs,
  }));
}

// ───────────── report aggregates ─────────────

export function findingsBetween(from: string, to: string, db: Db = defaultDb()) {
  return db.inspectionFinding.findMany({
    where: { checkIn: { day: { gte: dayValue(from), lte: dayValue(to) } } },
    select: {
      pairs: true,
      remedy: true,
      returnStage: true,
      finalDefectType: { select: { id: true, key: true, label: true, sortOrder: true } },
      checkIn: { select: { day: true } },
    },
  });
}

export function repairsBetween(from: string, to: string, db: Db = defaultDb()) {
  return db.repairJob.findMany({
    where: { sentAt: { gte: manilaDayStart(from), lt: manilaDayStart(addDays(to, 1)) } },
    select: {
      status: true,
      pairs: true,
      stage: true,
      sentAt: true,
      inspectedAt: true,
      passedPairs: true,
      scrappedPairs: true,
      resentPairs: true,
      finding: { select: { remedy: true, finalDefectType: { select: { key: true } } } },
    },
  });
}

/** Failed pairs of check-ins in a range that have no findings (from before Phase 34, A-89). */
export async function unexplainedFailedPairs(from: string, to: string, db: Db = defaultDb()) {
  const rows = await db.productionCheckIn.findMany({
    where: {
      day: { gte: dayValue(from), lte: dayValue(to) },
      failedPairs: { gt: 0 },
      findings: { none: {} },
    },
    select: { failedPairs: true },
  });
  return rows.reduce((s, r) => s + r.failedPairs, 0);
}

export { dayString };
