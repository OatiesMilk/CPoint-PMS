import { appNow } from "@/lib/clock";
import type { Verdict } from "@/lib/domain";
import { manilaToday } from "@/lib/format";
import {
  countScansByVerdict,
  findScanDetail,
  type ScanDetailRow,
} from "@/server/models/scan.model";

/** Start of today in Manila (UTC+8, no daylight saving) as a UTC instant. */
export function startOfManilaDay(now: Date = appNow()): Date {
  const [y, m, d] = manilaToday(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 8 * 3_600_000);
}

/** A roll's sections: passed, rejected and the total. */
export type RollYield = { passed: number; rejected: number; scanned: number };

export async function rollYield(rollId: string): Promise<RollYield> {
  const groups = await countScansByVerdict(rollId);
  const scans = (v: Verdict) => groups.find((g) => g.finalVerdict === v)?._count._all ?? 0;
  const passed = scans("PASS");
  const rejected = scans("REJECT");
  return { passed, rejected, scanned: passed + rejected };
}

export type ScanDetail = ScanDetailRow;

export function getScanDetail(id: string) {
  return findScanDetail(id);
}
