import type { Verdict } from "./domain";

/**
 * The CV decision rule, pure and client-safe. Each detection of an active defect type gives an
 * outcome, and the worst outcome decides the section:
 *   - a type with an action (D-053): that action once the detection counts as found
 *     (confidence ≥ foundAtOrAbove), otherwise PASS. A YOLO confidence says how sure the model is
 *     that a defect is there, not how bad it is, so the type decides how bad;
 *   - a type without one (D-011): confidence ≥ rejectAtOrAbove → REJECT, ≥ reworkAtOrAbove →
 *     REWORK, otherwise PASS;
 *   - any class key the system doesn't know → NEEDS_REVIEW (an untrained class can't be trusted).
 * Thresholds, actions and defect types are data (CvSettings, DefectType), never constants here.
 */

export type DefectAction = "REWORK" | "REJECT";
export type Thresholds = {
  rejectAtOrAbove: number;
  reworkAtOrAbove: number;
  /** Missing on scans decided before D-053; types had no actions then. */
  foundAtOrAbove?: number;
};
export type DetectionInput = { classKey: string; confidence: number };
export type DefectTypeInfo = { id: string; isActive: boolean; action?: DefectAction | null };
export type Outcome = "PASS" | DefectAction;

export type Decision = {
  verdict: Verdict;
  /** Highest confidence among active, known defect types; null when none counted. */
  maxConfidence: number | null;
  unknownKeys: string[];
  /** Known but deactivated defect types, ignored by the rule. */
  ignoredKeys: string[];
};

/** The default for foundAtOrAbove (the bootstrap and the migration use the same, D-053). */
export const DEFAULT_FOUND_AT_OR_ABOVE = 0.5;

const RANK: Record<Outcome, number> = { PASS: 0, REWORK: 1, REJECT: 2 };

/** What one detection of an active, known type means on its own. */
export function detectionOutcome(
  confidence: number,
  action: DefectAction | null | undefined,
  thresholds: Thresholds,
): Outcome {
  if (action) {
    const found = thresholds.foundAtOrAbove ?? DEFAULT_FOUND_AT_OR_ABOVE;
    return confidence >= found ? action : "PASS";
  }
  if (confidence >= thresholds.rejectAtOrAbove) return "REJECT";
  if (confidence >= thresholds.reworkAtOrAbove) return "REWORK";
  return "PASS";
}

export function decide(
  detections: DetectionInput[],
  defectTypesByKey: ReadonlyMap<string, DefectTypeInfo>,
  thresholds: Thresholds,
): Decision {
  const unknown = new Set<string>();
  const ignored = new Set<string>();
  let max: number | null = null;
  let worst: Outcome = "PASS";

  for (const d of detections) {
    const type = defectTypesByKey.get(d.classKey);
    if (!type) unknown.add(d.classKey);
    else if (!type.isActive) ignored.add(d.classKey);
    else {
      if (max === null || d.confidence > max) max = d.confidence;
      const outcome = detectionOutcome(d.confidence, type.action, thresholds);
      if (RANK[outcome] > RANK[worst]) worst = outcome;
    }
  }

  const verdict: Verdict = unknown.size > 0 ? "NEEDS_REVIEW" : worst;
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
  if (t.foundAtOrAbove !== undefined && !inRange(t.foundAtOrAbove)) {
    return "The found-at value must be between 0 and 1 (e.g. 0.50).";
  }
  return null;
}

/** What a scan stores in `thresholdsSnapshot`: the rule in force when it was decided. */
export type DecisionSnapshot = Thresholds & { actions?: Record<string, DefectAction> };

/** Reads a stored snapshot; actions are missing on scans decided before D-053. */
export function readSnapshot(json: unknown): DecisionSnapshot {
  const s = (json ?? {}) as Partial<DecisionSnapshot>;
  return {
    rejectAtOrAbove: Number(s.rejectAtOrAbove ?? 0.9),
    reworkAtOrAbove: Number(s.reworkAtOrAbove ?? 0.6),
    ...(typeof s.foundAtOrAbove === "number" ? { foundAtOrAbove: s.foundAtOrAbove } : {}),
    actions: s.actions ?? {},
  };
}

/** Class keys grouped by action, for "Rules used" lines. */
export function actionGroups(actions: Record<string, DefectAction> = {}) {
  const keys = (a: DefectAction) =>
    Object.entries(actions)
      .filter(([, v]) => v === a)
      .map(([k]) => k)
      .sort();
  return { reject: keys("REJECT"), rework: keys("REWORK") };
}
