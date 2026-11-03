/**
 * A roll's findings for Reports → Rolls and its claim sheet (Phase 30C, C-36): the found defects by
 * type with their longest length, and the largest boxes, from what each shot stored. Each shot is
 * read with the rule it was decided with (its snapshot), so a later Settings change doesn't
 * rewrite what was found. Pure and client-safe.
 */
import { isFound, outcomeFor, readSnapshot, type DefectOutcome } from "./decision-engine";

export type FindingsScan = {
  id: string;
  sequence: number;
  thresholdsSnapshot: unknown;
  detections: {
    rawClassKey: string;
    confidence: number;
    lengthIn: number | null;
    areaSqIn: number | null;
    defectType: { label: string } | null;
  }[];
};

export type TypeFinding = {
  label: string;
  count: number;
  notAccepted: number;
  /** The longest one's box diagonal; null when none was measured. */
  longestIn: number | null;
};

export type LargeDefect = {
  scanId: string;
  sequence: number;
  label: string;
  lengthIn: number;
  areaSqIn: number;
  outcome: DefectOutcome | null;
};

export function rollFindings(
  scans: readonly FindingsScan[],
  largestCount = 5,
): { byType: TypeFinding[]; largest: LargeDefect[] } {
  const byType = new Map<string, TypeFinding>();
  const all: LargeDefect[] = [];
  for (const scan of scans) {
    const rule = readSnapshot(scan.thresholdsSnapshot);
    for (const d of scan.detections) {
      const outcome0 = rule.outcomes[d.rawClassKey];
      if (!d.defectType || !outcome0 || !isFound(d.confidence, rule)) continue;
      const outcome = outcomeFor(outcome0, rule.lengthLimits?.[d.rawClassKey], d.lengthIn) ?? null;
      const label = d.defectType.label;
      const row = byType.get(label) ?? { label, count: 0, notAccepted: 0, longestIn: null };
      row.count += 1;
      if (outcome === "NOT_ACCEPTED") row.notAccepted += 1;
      if (d.lengthIn !== null) row.longestIn = Math.max(row.longestIn ?? 0, d.lengthIn);
      byType.set(label, row);
      if (d.lengthIn !== null && d.areaSqIn !== null)
        all.push({
          scanId: scan.id,
          sequence: scan.sequence,
          label,
          lengthIn: d.lengthIn,
          areaSqIn: d.areaSqIn,
          outcome,
        });
    }
  }
  return {
    byType: [...byType.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    ),
    largest: all.sort((a, b) => b.areaSqIn - a.areaSqIn).slice(0, largestCount),
  };
}

/** "0.65 sq ft (93.6 sq in)" */
export function formatDefectArea(sqIn: number): string {
  const sqFt = sqIn / 144;
  return `${sqFt.toLocaleString("en-PH", { maximumFractionDigits: 2 })} sq ft (${sqIn.toLocaleString("en-PH", { maximumFractionDigits: 1 })} sq in)`;
}

export const formatPct = (n: number) =>
  `${n.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`;
