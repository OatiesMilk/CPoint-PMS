import type { Prisma } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

export async function nextScanSequence(rollId: string, db: Db): Promise<number> {
  const { _max } = await db.scan.aggregate({ where: { rollId }, _max: { sequence: true } });
  return (_max.sequence ?? 0) + 1;
}

export function insertScanWithDetections(
  data: Prisma.ScanUncheckedCreateInput,
  detections: Prisma.DetectionCreateManyScanInput[],
  db: Db = defaultDb(),
) {
  return db.scan.create({ data: { ...data, detections: { createMany: { data: detections } } } });
}

/** The scan a camera already sent with this capture id (D-051), with what the result needs. */
export function findScanByCaptureId(captureId: string, db: Db = defaultDb()) {
  return db.scan.findUnique({
    where: { captureId },
    select: {
      id: true,
      sequence: true,
      aiVerdict: true,
      deviceTokenId: true,
      roll: { select: { id: true, code: true } },
    },
  });
}

export function findScanById(id: string, db: Db = defaultDb()) {
  return db.scan.findUnique({
    where: { id },
    include: { roll: { select: { id: true, code: true, status: true } } },
  });
}

// ───────────── reads ─────────────

const detailInclude = {
  roll: {
    select: {
      id: true,
      code: true,
      tagCode: true,
      status: true,
    },
  },
  deviceToken: { select: { name: true } },
  detections: {
    orderBy: { confidence: "desc" },
    include: { defectType: { select: { label: true, isActive: true } } },
  },
} satisfies Prisma.ScanInclude;

export type ScanDetailRow = Prisma.ScanGetPayload<{ include: typeof detailInclude }>;

export function findScanDetail(id: string, db: Db = defaultDb()): Promise<ScanDetailRow | null> {
  return db.scan.findUnique({ where: { id }, include: detailInclude });
}

export function countScansByVerdict(rollId: string, db: Db = defaultDb()) {
  return db.scan.groupBy({ by: ["finalVerdict"], where: { rollId }, _count: { _all: true } });
}

export function findLatestScan(db: Db = defaultDb()) {
  return db.scan.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      source: true,
      modelVersion: true,
      deviceToken: { select: { name: true } },
    },
  });
}
