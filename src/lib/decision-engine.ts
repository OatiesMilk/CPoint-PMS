import type { Verdict } from "./domain";

/**
 * The CV decision rule (D-011), pure and client-safe. One rule for every defect type:
 *   highest confidence among active defect types ≥ rejectAtOrAbove → REJECT
 *                                                ≥ reworkAtOrAbove → REWORK
 *                                                otherwise / none → PASS
 *   any class key the system doesn't know → NEEDS_REVIEW (an untrained class can't be trusted)
 * Thresholds and defect types are data (CvSettings, DefectType), never constants here.
 */

export type Thresholds = { rejectAtOrAbove: number; reworkAtOrAbove: number };
export type DetectionInput = { classKey: string; confidence: number };
export type DefectTypeInfo = { id: string; isActive: boolean };

export type Decision = {
  verdict: Verdict;
  /** Highest confidence among active, known defect types; null when none counted. */
  maxConfidence: number | null;
  unknownKeys: string[];
  /** Known but deactivated defect types, ignored by the rule. */
  ignoredKeys: string[];
};

export function decide(
  detections: DetectionInput[],
  defectTypesByKey: ReadonlyMap<string, DefectTypeInfo>,
  thresholds: Thresholds,
): Decision {
  const unknown = new Set<string>();
  const ignored = new Set<string>();
  let max: number | null = null;

  for (const d of detections) {
    const type = defectTypesByKey.get(d.classKey);
    if (!type) unknown.add(d.classKey);
    else if (!type.isActive) ignored.add(d.classKey);
    else if (max === null || d.confidence > max) max = d.confidence;
  }

  const verdict: Verdict =
    unknown.size > 0
      ? "NEEDS_REVIEW"
      : max !== null && max >= thresholds.rejectAtOrAbove
        ? "REJECT"
        : max !== null && max >= thresholds.reworkAtOrAbove
          ? "REWORK"
          : "PASS";

  return { verdict, maxConfidence: max, unknownKeys: [...unknown], ignoredKeys: [...ignored] };
}

/** Returns an error message, or null when the thresholds make sense. */
export function validateThresholds(t: Thresholds): string | null {
  const inRange = (v: number) => Number.isFinite(v) && v > 0 && v <= 1;
  if (!inRange(t.reworkAtOrAbove) || !inRange(t.rejectAtOrAbove)) {
    return "Thresholds must be between 0 and 1 (e.g. 0.60 and 0.90).";
  }
  if (t.reworkAtOrAbove >= t.rejectAtOrAbove) {
    return "The Rework threshold must be lower than the Reject threshold.";
  }
  return null;
}
