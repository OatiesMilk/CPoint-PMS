import type { Prisma, ReworkStatus, SalvageStatus } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

// Rework tickets and salvage items are created from scan verdicts (D-007). Phase 4 manages their lifecycle.

/** `at` is when the scan was decided (defaults to now), so replayed scans keep their timeline. */
export function insertReworkTicket(scanId: string, db: Db = defaultDb(), at?: Date) {
  return db.reworkTicket.create({ data: { scanId, ...(at ? { openedAt: at } : {}) } });
}

export function insertSalvageItem(
  data: { scanId: string; originBatchId: string; createdAt?: Date },
  db: Db = defaultDb(),
) {
  return db.salvageItem.create({ data });
}

/** The live (not cancelled) rework ticket and salvage item of a scan, if any. */
export async function findLiveOutcomes(scanId: string, db: Db = defaultDb()) {
  const [rework, salvage] = await Promise.all([
    db.reworkTicket.findFirst({ where: { scanId, status: { not: "CANCELLED" } } }),
    db.salvageItem.findFirst({ where: { scanId, status: { not: "CANCELLED" } } }),
  ]);
  return { rework, salvage };
}

export function cancelReworkTicket(id: string, at: Date, db: Db = defaultDb()) {
  return db.reworkTicket.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: at } });
}

export function cancelSalvageItem(id: string, db: Db = defaultDb()) {
  return db.salvageItem.update({ where: { id }, data: { status: "CANCELLED" } });
}

// ───────────── rework board ─────────────

const topDefect = {
  orderBy: { confidence: "desc" },
  take: 1,
  select: { confidence: true, rawClassKey: true, defectType: { select: { label: true } } },
} satisfies Prisma.Scan$detectionsArgs;

const reworkSelect = {
  id: true,
  status: true,
  notes: true,
  openedAt: true,
  startedAt: true,
  completedAt: true,
  completedBy: { select: { name: true } },
  scan: {
    select: {
      id: true,
      sequence: true,
      imagePath: true,
      batch: { select: { id: true, code: true, status: true } },
      detections: topDefect,
    },
  },
} satisfies Prisma.ReworkTicketSelect;

export type ReworkRow = Prisma.ReworkTicketGetPayload<{ select: typeof reworkSelect }>;

export function listReworkTickets(
  filter: { status: ReworkStatus; batchCode?: string; completedSince?: Date },
  db: Db = defaultDb(),
): Promise<ReworkRow[]> {
  const orderBy: Prisma.ReworkTicketOrderByWithRelationInput =
    filter.status === "OPEN"
      ? { openedAt: "asc" }
      : filter.status === "IN_PROGRESS"
        ? { startedAt: "asc" }
        : { completedAt: "desc" };
  return db.reworkTicket.findMany({
    where: {
      status: filter.status,
      ...(filter.completedSince ? { completedAt: { gte: filter.completedSince } } : {}),
      ...(filter.batchCode
        ? { scan: { batch: { code: { contains: filter.batchCode, mode: "insensitive" } } } }
        : {}),
    },
    select: reworkSelect,
    orderBy,
    take: 100,
  });
}

export function findReworkTicket(id: string, db: Db = defaultDb()) {
  return db.reworkTicket.findUnique({
    where: { id },
    include: {
      scan: {
        select: {
          id: true,
          sequence: true,
          batch: { select: { id: true, code: true, status: true } },
        },
      },
    },
  });
}

/** Moves a ticket only if it is still in `from` (optimistic concurrency). */
export async function transitionReworkTicket(
  id: string,
  from: ReworkStatus,
  data: Prisma.ReworkTicketUncheckedUpdateManyInput,
  db: Db = defaultDb(),
): Promise<boolean> {
  const { count } = await db.reworkTicket.updateMany({ where: { id, status: from }, data });
  return count === 1;
}

export function countReworkByStatus(
  where: Prisma.ReworkTicketWhereInput = {},
  db: Db = defaultDb(),
) {
  return db.reworkTicket.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
    _min: { openedAt: true },
  });
}

export function countLiveReworkForBatch(batchId: string, db: Db = defaultDb()) {
  return db.reworkTicket.count({
    where: { scan: { batchId }, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
}

/** Unfinished repairs per batch, for the "In repair" tag on a page of batches. */
export async function countLiveReworkByBatch(
  batchIds: string[],
  db: Db = defaultDb(),
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (batchIds.length === 0) return counts;
  const rows = await db.reworkTicket.findMany({
    where: { scan: { batchId: { in: batchIds } }, status: { in: ["OPEN", "IN_PROGRESS"] } },
    select: { scan: { select: { batchId: true } } },
  });
  for (const { scan } of rows) counts.set(scan.batchId, (counts.get(scan.batchId) ?? 0) + 1);
  return counts;
}

/** A cancelled batch's unfinished repairs are moot: the roll is gone. */
export function cancelLiveReworkForBatch(batchId: string, at: Date, db: Db = defaultDb()) {
  return db.reworkTicket.updateMany({
    where: { scan: { batchId }, status: { in: ["OPEN", "IN_PROGRESS"] } },
    data: { status: "CANCELLED", cancelledAt: at },
  });
}

// ───────────── salvage ─────────────

const salvageSelect = {
  id: true,
  status: true,
  notes: true,
  createdAt: true,
  assignedAt: true,
  discardedAt: true,
  originBatchId: true,
  originBatch: { select: { id: true, code: true } },
  assignedBatch: { select: { id: true, code: true, status: true } },
  handledBy: { select: { name: true } },
  scan: { select: { id: true, sequence: true, detections: topDefect } },
} satisfies Prisma.SalvageItemSelect;

export type SalvageRow = Prisma.SalvageItemGetPayload<{ select: typeof salvageSelect }>;

export function listSalvageItems(
  filter: { status: SalvageStatus; batchCode?: string },
  db: Db = defaultDb(),
): Promise<SalvageRow[]> {
  return db.salvageItem.findMany({
    where: {
      status: filter.status,
      ...(filter.batchCode
        ? {
            OR: [
              { originBatch: { code: { contains: filter.batchCode, mode: "insensitive" } } },
              { assignedBatch: { code: { contains: filter.batchCode, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: salvageSelect,
    orderBy: filter.status === "AVAILABLE" ? { createdAt: "asc" } : { createdAt: "desc" },
    take: 200,
  });
}

export function countSalvageByStatus(db: Db = defaultDb()) {
  return db.salvageItem.groupBy({
    by: ["status"],
    where: { status: { not: "CANCELLED" } },
    _count: { _all: true },
  });
}

export function findSalvageItem(id: string, db: Db = defaultDb()) {
  return db.salvageItem.findUnique({
    where: { id },
    include: {
      assignedBatch: { select: { status: true } },
      originBatch: { select: { code: true } },
      scan: { select: { sequence: true } },
    },
  });
}

export async function transitionSalvageItem(
  id: string,
  from: SalvageStatus,
  data: Prisma.SalvageItemUncheckedUpdateManyInput,
  db: Db = defaultDb(),
): Promise<boolean> {
  const { count } = await db.salvageItem.updateMany({ where: { id, status: from }, data });
  return count === 1;
}

export function countSalvageAssignedTo(batchId: string, db: Db = defaultDb()) {
  return db.salvageItem.count({ where: { assignedBatchId: batchId, status: "ASSIGNED" } });
}
