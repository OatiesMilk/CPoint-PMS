import type { Verdict } from "./domain";
import { reaches } from "./measure";

/**
 * The CV decision rule, pure and client-safe (Phase 25, D-093). A section is Pass or Reject:
 *   - a detection of an active, known type at or above "counts as found at" gives its type's
 *     outcome, Usable or Not accepted; below it, it counts for nothing (a YOLO confidence says how
 *     sure the model is that a defect is there, not how bad it is, so the type decides that);
 *   - any Not accepted → Reject, otherwise Pass;
 *   - inactive types, and class keys with no defect type, are ignored (D-108: the ingest drops
 *     the latter before anything is stored, so there are no unknown classes).
 * The found-at value, the outcomes and the defect types are data (CvSettings, DefectType).
 * Nobody changes the verdict afterwards (C-21).
 */

export type DefectOutcome = "USABLE" | "NOT_ACCEPTED";
export type RuleSettings = { foundAtOrAbove: number };
/** lengthIn is the box diagonal in inches, null when the shot has no scale (Phase 30C). */
export type DetectionInput = { classKey: string; confidence: number; lengthIn?: number | null };
export type DefectTypeInfo = {
  id: string;
  isActive: boolean;
  outcome: DefectOutcome;
  /** Not accepted from this length, Usable below (C-37); null: `outcome` applies. */
  notAcceptedFromIn?: number | null;
};

/**
 * A type's outcome for one detection. With a length limit (Phase 30C, C-37): Not accepted at or
 * above it, Usable below; unmeasured (no scale) counts as Not accepted, the safe side.
 */
export function outcomeFor(
  outcome: DefectOutcome | null | undefined,
  notAcceptedFromIn: number | null | undefined,
  lengthIn: number | null | undefined,
): DefectOutcome | null | undefined {
  if (notAcceptedFromIn == null) return outcome;
  if (lengthIn == null) return "NOT_ACCEPTED";
  return reaches(lengthIn, notAcceptedFromIn) ? "NOT_ACCEPTED" : "USABLE";
}

export type Decision = {
  verdict: Verdict;
  /** Highest confidence among active, known defect types; null when none counted. */
  maxConfidence: number | null;
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
 * found-at, or for a type with no outcome.
 */
export function detectionOutcome(
  confidence: number,
  outcome: DefectOutcome | null | undefined,
  rule: RuleSettings,
): DefectOutcome | null {
  if (!outcome) return null;
  return isFound(confidence, rule) ? outcome : null;
}

export function decide(
  detections: DetectionInput[],
  defectTypesByKey: ReadonlyMap<string, DefectTypeInfo>,
  rule: RuleSettings,
): Decision {
  const ignored = new Set<string>();
  let max: number | null = null;
  let rejected = false;

  for (const d of detections) {
    const type = defectTypesByKey.get(d.classKey);
    if (!type) continue;
    if (!type.isActive) ignored.add(d.classKey);
    else {
      if (max === null || d.confidence > max) max = d.confidence;
      const outcome = outcomeFor(type.outcome, type.notAcceptedFromIn, d.lengthIn);
      if (detectionOutcome(d.confidence, outcome, rule) === "NOT_ACCEPTED") rejected = true;
    }
  }

  const verdict: Verdict = rejected ? "REJECT" : "PASS";
  return { verdict, maxConfidence: max, ignoredKeys: [...ignored] };
}

/** What a scan stores in `thresholdsSnapshot`: the rule in force when it was decided. */
export type DecisionSnapshot = {
  foundAtOrAbove: number;
  outcomes: Record<string, DefectOutcome>;
  /** Phase 30C: each type's "Not accepted from" length in inches, and its flat share. */
  lengthLimits?: Record<string, number>;
  flatShares?: Record<string, number>;
  /** The inches across the photo (the marker card's, D-120, or the old calibration); null without. */
  widthIn?: number | null;
  /** The marker cards' corners on the shot, in fractions (D-120); boxes on them were dropped. */
  markerCorners?: { x: number; y: number }[][] | null;
  /** D-121: a shot without the card took its roll's scale from this earlier shot. */
  scaleFromShot?: number | null;
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
    lengthLimits?: Record<string, number>;
    flatShares?: Record<string, number>;
    widthIn?: unknown;
    markerCorners?: unknown;
    scaleFromShot?: unknown;
  };
  return {
    foundAtOrAbove:
      typeof s.foundAtOrAbove === "number" ? s.foundAtOrAbove : DEFAULT_FOUND_AT_OR_ABOVE,
    outcomes: s.outcomes ?? {},
    lengthLimits: s.lengthLimits ?? {},
    flatShares: s.flatShares ?? {},
    widthIn: typeof s.widthIn === "number" ? s.widthIn : null,
    markerCorners: Array.isArray(s.markerCorners)
      ? (s.markerCorners as { x: number; y: number }[][])
      : null,
    scaleFromShot: typeof s.scaleFromShot === "number" ? s.scaleFromShot : null,
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
