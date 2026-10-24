import type { Verdict } from "./domain";

/**
 * The CV decision rule, pure and client-safe (Phase 25, D-093). A section is Pass or Reject:
 *   - a detection of an active, known type at or above "counts as found at" gives its type's
 *     outcome, Usable or Not accepted; below it, it counts for nothing (a YOLO confidence says how
 *     sure the model is that a defect is there, not how bad it is, so the type decides that);
 *   - any Not accepted → Reject, otherwise Pass;
 *   - any class key the system doesn't know → Reject (A-12), listed in Settings → Unknown classes;
 *   - inactive types are ignored.
 * The found-at value, the outcomes and the defect types are data (CvSettings, DefectType).
 * Nobody changes the verdict afterwards (C-21).
 */

export type DefectOutcome = "USABLE" | "NOT_ACCEPTED";
export type RuleSettings = { foundAtOrAbove: number };
export type DetectionInput = { classKey: string; confidence: number };
export type DefectTypeInfo = { id: string; isActive: boolean; outcome: DefectOutcome };

export type Decision = {
  verdict: Verdict;
  /** Highest confidence among active, known defect types; null when none counted. */
  maxConfidence: number | null;
  unknownKeys: string[];
  /** Known but deactivated defect types, ignored by the rule. */
  ignoredKeys: string[];
};

/** The default for foundAtOrAbove (the bootstrap and the migrations use the same, D-053). */
export const DEFAULT_FOUND_AT_OR_ABOVE = 0.5;

export const OUTCOME_LABELS: Record<DefectOutcome, string> = {
  USABLE: "Usable",
  NOT_ACCEPTED: "Not accepted",
};

/** Whether a detection counts as found (D-053). */
export function isFound(confidence: number, rule: RuleSettings): boolean {
  return confidence >= rule.foundAtOrAbove;
}

/**
 * What one detection does to its section: its type's outcome once found, nothing (null) below
 * found-at. An unknown class is Not accepted (A-12).
 */
export function detectionOutcome(
  confidence: number,
  outcome: DefectOutcome | null | undefined,
  rule: RuleSettings,
): DefectOutcome | null {
  if (!outcome) return "NOT_ACCEPTED";
  return isFound(confidence, rule) ? outcome : null;
}

export function decide(
  detections: DetectionInput[],
  defectTypesByKey: ReadonlyMap<string, DefectTypeInfo>,
  rule: RuleSettings,
): Decision {
  const unknown = new Set<string>();
  const ignored = new Set<string>();
  let max: number | null = null;
  let rejected = false;

  for (const d of detections) {
    const type = defectTypesByKey.get(d.classKey);
    if (!type) unknown.add(d.classKey);
    else if (!type.isActive) ignored.add(d.classKey);
    else {
      if (max === null || d.confidence > max) max = d.confidence;
      if (detectionOutcome(d.confidence, type.outcome, rule) === "NOT_ACCEPTED") rejected = true;
    }
  }

  const verdict: Verdict = rejected || unknown.size > 0 ? "REJECT" : "PASS";
  return { verdict, maxConfidence: max, unknownKeys: [...unknown], ignoredKeys: [...ignored] };
}

/** What a scan stores in `thresholdsSnapshot`: the rule in force when it was decided. */
export type DecisionSnapshot = {
  foundAtOrAbove: number;
  outcomes: Record<string, DefectOutcome>;
  /**
   * Set on scans decided before Phase 25, which used Fixable and the two confidence thresholds
   * (D-011, D-053). Their verdicts were converted (Fixable → Pass, Needs review → Reject).
   */
  earlierRule: boolean;
};

/** Reads a stored snapshot, old shapes included (`rejectAtOrAbove`, `actions`). */
export function readSnapshot(json: unknown): DecisionSnapshot {
  const s = (json ?? {}) as {
    foundAtOrAbove?: unknown;
    outcomes?: Record<string, DefectOutcome>;
    rejectAtOrAbove?: unknown;
  };
  return {
    foundAtOrAbove:
      typeof s.foundAtOrAbove === "number" ? s.foundAtOrAbove : DEFAULT_FOUND_AT_OR_ABOVE,
    outcomes: s.outcomes ?? {},
    earlierRule: s.outcomes === undefined || s.rejectAtOrAbove !== undefined,
  };
}

/** Class keys grouped by outcome, for "Rules used" lines. */
export function outcomeGroups(outcomes: Record<string, DefectOutcome> = {}) {
  const keys = (o: DefectOutcome) =>
    Object.entries(outcomes)
      .filter(([, v]) => v === o)
      .map(([k]) => k)
      .sort();
  return { notAccepted: keys("NOT_ACCEPTED"), usable: keys("USABLE") };
}
