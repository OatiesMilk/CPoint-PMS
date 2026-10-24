import type { Verdict } from "@/lib/domain";
import { PAGE_SIZE } from "@/lib/pagination";
import { manilaToday } from "@/lib/format";
import {
  countScans,
  countScansByVerdict,
  findScanDetail,
  listScans as listScanRows,
  type ScanDetailRow,
  type ScanFilters,
  type ScanListRow,
} from "@/server/models/scan.model";
import type { ScanListQuery } from "@/server/validators/scan.validator";

export const SCAN_PAGE_SIZE = PAGE_SIZE;

export type ScanListItem = {
  id: string;
  sequence: number;
  batchId: string;
  batchCode: string;
  aiVerdict: Verdict;
  finalVerdict: Verdict;
  maxConfidence: number | null;
  source: string;
  createdAt: string;
  topDefect: { label: string; confidence: number; unknown: boolean } | null;
};

/** Plain JSON-safe rows (the polling widget and API use them as-is). */
function toItem(row: ScanListRow): ScanListItem {
  const top = row.detections[0];
  return {
    id: row.id,
    sequence: row.sequence,
    batchId: row.batch.id,
    batchCode: row.batch.code,
    aiVerdict: row.aiVerdict,
    finalVerdict: row.finalVerdict,
    maxConfidence: row.maxConfidence,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    topDefect: top
      ? {
          label: top.defectType?.label ?? top.rawClassKey,
          confidence: top.confidence,
          unknown: top.isUnknownClass,
        }
      : null,
  };
}

function filtersFrom(q: ScanListQuery): ScanFilters {
  return {
    verdict: q.verdict,
    source: q.source,
    batchCode: q.batch,
    defectKey: q.defect,
  };
}

export async function listScans(q: ScanListQuery) {
  const page = q.page ?? 1;
  const { rows, total } = await listScanRows(filtersFrom(q), {
    skip: (page - 1) * SCAN_PAGE_SIZE,
    take: SCAN_PAGE_SIZE,
  });
  return {
    rows: rows.map(toItem),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SCAN_PAGE_SIZE)),
  };
}

export async function latestScans(limit = 8): Promise<ScanListItem[]> {
  const { rows } = await listScanRows({}, { skip: 0, take: limit });
  return rows.map(toItem);
}

/** Start of today in Manila (UTC+8, no daylight saving) as a UTC instant. */
export function startOfManilaDay(now: Date = new Date()): Date {
  const [y, m, d] = manilaToday(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 8 * 3_600_000);
}

/** Today's sections for the QI's home: how many were scanned and how many were rejected. */
export async function inspectorSummary(now: Date = new Date()) {
  const since = startOfManilaDay(now);
  const [scannedToday, rejectedToday] = await Promise.all([
    countScans({ since }),
    countScans({ verdict: "REJECT", since }),
  ]);
  return { scannedToday, rejectedToday };
}

/** A roll's sections: passed, rejected (reported for salvage, A-11) and the total. */
export type BatchYield = { passed: number; rejected: number; scanned: number };

export async function batchYield(batchId: string): Promise<BatchYield> {
  const groups = await countScansByVerdict(batchId);
  const scans = (v: Verdict) => groups.find((g) => g.finalVerdict === v)?._count._all ?? 0;
  const passed = scans("PASS");
  const rejected = scans("REJECT");
  return { passed, rejected, scanned: passed + rejected };
}

export type ScanDetail = ScanDetailRow;

export function getScanDetail(id: string) {
  return findScanDetail(id);
}
