import type { Prisma, Verdict } from "@/generated/prisma/client";
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

const listSelect = {
  id: true,
  sequence: true,
  aiVerdict: true,
  finalVerdict: true,
  maxConfidence: true,
  source: true,
  capturedAt: true,
  createdAt: true,
  roll: { select: { id: true, code: true } },
  detections: {
    orderBy: { confidence: "desc" },
    take: 1,
    select: {
      rawClassKey: true,
      confidence: true,
      isUnknownClass: true,
      defectType: { select: { label: true } },
    },
  },
} satisfies Prisma.ScanSelect;

export type ScanListRow = Prisma.ScanGetPayload<{ select: typeof listSelect }>;

export type ScanFilters = {
  verdict?: Verdict;
  source?: Prisma.ScanWhereInput["source"];
  rollCode?: string;
  rollId?: string;
  since?: Date;
  defectKey?: string;
};

function scanWhere(f: ScanFilters): Prisma.ScanWhereInput {
  return {
    source: f.source,
    rollId: f.rollId,
    ...(f.verdict ? { finalVerdict: f.verdict } : {}),
    ...(f.rollCode ? { roll: { code: { contains: f.rollCode, mode: "insensitive" } } } : {}),
    ...(f.defectKey ? { detections: { some: { rawClassKey: f.defectKey } } } : {}),
    ...(f.since ? { createdAt: { gte: f.since } } : {}),
  };
}

export async function listScans(
  filters: ScanFilters,
  page: { skip: number; take: number },
  order: "newest" | "oldest" = "newest",
  db: Db = defaultDb(),
): Promise<{ rows: ScanListRow[]; total: number }> {
  const where = scanWhere(filters);
  const [rows, total] = await Promise.all([
    db.scan.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: order === "newest" ? "desc" : "asc" },
      ...page,
    }),
    db.scan.count({ where }),
  ]);
  return { rows, total };
}

export function countScans(filters: ScanFilters, db: Db = defaultDb()) {
  return db.scan.count({ where: scanWhere(filters) });
}

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
