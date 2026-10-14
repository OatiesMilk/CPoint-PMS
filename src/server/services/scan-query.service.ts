import type { Verdict } from "@/lib/domain";
import { PAGE_SIZE, pageCountFor, pageWindow } from "@/lib/pagination";
import { computeBatchYield, type BatchYield } from "@/lib/outcome-rules";
import { countReworkByStatus, countSalvageAssignedTo } from "@/server/models/outcome.model";
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
  finalVerdict: Verdict | null;
  status: string;
  isOverride: boolean;
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
    status: row.status,
    isOverride: row.isOverride,
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
    status: q.status,
    source: q.source,
    batchCode: q.batch,
    overridesOnly: q.override === "1",
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

/**
 * Oldest pending first (fair to the waiting sections); `batchCode` narrows both lists. Each list
 * pages on its own (D-047): `pendingPage` for the flagged scans, `autoPage` for today's calls.
 */
export async function reviewQueue(
  now: Date = new Date(),
  batchCode?: string,
  pendingPage = 1,
  autoPage = 1,
) {
  const [pending, todayAuto] = await Promise.all([
    listScanRows({ status: "PENDING_REVIEW", batchCode }, pageWindow(pendingPage), "oldest"),
    listScanRows(
      { aiVerdictIn: ["REWORK", "REJECT"], since: startOfManilaDay(now), batchCode },
      pageWindow(autoPage),
    ),
  ]);
  return {
    pending: {
      rows: pending.rows.map(toItem),
      total: pending.total,
      page: pendingPage,
      pageCount: pageCountFor(pending.total),
    },
    todayAuto: {
      rows: todayAuto.rows.map(toItem),
      total: todayAuto.total,
      page: autoPage,
      pageCount: pageCountFor(todayAuto.total),
    },
  };
}

export async function inspectorSummary(now: Date = new Date()) {
  const [pending, todayAuto, todayOverrides] = await Promise.all([
    countScans({ status: "PENDING_REVIEW" }),
    countScans({ aiVerdictIn: ["REWORK", "REJECT"], since: startOfManilaDay(now) }),
    countScans({ overridesOnly: true, since: startOfManilaDay(now) }),
  ]);
  return { pending, todayAuto, todayOverrides };
}

/** Usable = passed + repaired (D-007, D-021). Cancelled repairs never count. */
export async function batchYield(batchId: string): Promise<BatchYield> {
  const [groups, rework, salvageReceived] = await Promise.all([
    countScansByVerdict(batchId),
    countReworkByStatus({ scan: { batchId } }),
    countSalvageAssignedTo(batchId),
  ]);
  const scans = (v: Verdict | null) => groups.find((g) => g.finalVerdict === v)?._count._all ?? 0;
  const tickets = (s: string) => rework.find((g) => g.status === s)?._count._all ?? 0;
  return computeBatchYield({
    scans: {
      pass: scans("PASS"),
      rework: scans("REWORK"),
      reject: scans("REJECT"),
      pending: scans(null),
    },
    rework: { open: tickets("OPEN"), inProgress: tickets("IN_PROGRESS"), done: tickets("DONE") },
    salvageReceived,
  });
}

export type ScanDetail = ScanDetailRow;

export function getScanDetail(id: string) {
  return findScanDetail(id);
}
