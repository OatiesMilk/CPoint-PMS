import type { Prisma, ScanStatus, Verdict } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

export async function nextScanSequence(batchId: string, db: Db): Promise<number> {
  const { _max } = await db.scan.aggregate({ where: { batchId }, _max: { sequence: true } });
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
      status: true,
      deviceTokenId: true,
      batch: { select: { id: true, code: true } },
    },
  });
}

export function findScanById(id: string, db: Db = defaultDb()) {
  return db.scan.findUnique({
    where: { id },
    include: { batch: { select: { id: true, code: true, status: true } } },
  });
}

export function updateScanDecision(
  id: string,
  data: {
    finalVerdict: Verdict;
    status: ScanStatus;
    isOverride: boolean;
    overrideReason: string | null;
    decidedById: string;
    decidedAt: Date;
  },
  expected: { finalVerdict: Verdict | null },
  db: Db = defaultDb(),
) {
  // Conditional on the verdict the person saw, so two simultaneous decisions can't both apply.
  return db.scan.updateMany({ where: { id, finalVerdict: expected.finalVerdict }, data });
}

// ───────────── reads ─────────────

const listSelect = {
  id: true,
  sequence: true,
  aiVerdict: true,
  finalVerdict: true,
  status: true,
  isOverride: true,
  maxConfidence: true,
  source: true,
  capturedAt: true,
  createdAt: true,
  batch: { select: { id: true, code: true } },
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
  status?: ScanStatus;
  source?: Prisma.ScanWhereInput["source"];
  batchCode?: string;
  batchId?: string;
  overridesOnly?: boolean;
  since?: Date;
  aiVerdictIn?: Verdict[];
  defectKey?: string;
};

function scanWhere(f: ScanFilters): Prisma.ScanWhereInput {
  return {
    status: f.status,
    source: f.source,
    batchId: f.batchId,
    ...(f.verdict === "NEEDS_REVIEW"
      ? { aiVerdict: "NEEDS_REVIEW" }
      : f.verdict
        ? { finalVerdict: f.verdict }
        : {}),
    ...(f.aiVerdictIn ? { aiVerdict: { in: f.aiVerdictIn } } : {}),
    ...(f.batchCode ? { batch: { code: { contains: f.batchCode, mode: "insensitive" } } } : {}),
    ...(f.overridesOnly ? { isOverride: true } : {}),
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
  batch: {
    select: {
      id: true,
      code: true,
      rollCode: true,
      status: true,
      shoeType: { select: { name: true } },
    },
  },
  deviceToken: { select: { name: true } },
  decidedBy: { select: { name: true } },
  detections: {
    orderBy: { confidence: "desc" },
    include: { defectType: { select: { label: true, isActive: true } } },
  },
  reworkTickets: {
    orderBy: { openedAt: "asc" },
    select: { id: true, status: true, openedAt: true },
  },
  salvageItems: {
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, createdAt: true },
  },
} satisfies Prisma.ScanInclude;

export type ScanDetailRow = Prisma.ScanGetPayload<{ include: typeof detailInclude }>;

export function findScanDetail(id: string, db: Db = defaultDb()): Promise<ScanDetailRow | null> {
  return db.scan.findUnique({ where: { id }, include: detailInclude });
}

export function countScansByVerdict(batchId: string, db: Db = defaultDb()) {
  return db.scan.groupBy({ by: ["finalVerdict"], where: { batchId }, _count: { _all: true } });
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
