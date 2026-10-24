/**
 * Turns what the model saw into the app's `detections` shape. Pure, no model imports.
 *
 * A line-for-line port of the station's `cv/cpoint_cv/mapper.py`, so a capture from the website
 * and one from the camera station report the same detections for the same model output (Phase 18).
 * `tests/fixtures/cv-mapper-parity.json`, written by the station's tests, proves the two agree.
 * Nothing here decides Pass or Reject: the app does that in `ingestScan` (D-011, D-093).
 */

/** The app accepts at most this many detections per scan (MAX_DETECTIONS in scan.validator.ts). */
export const CONTRACT_MAX_DETECTIONS = 50;
const DECIMALS = 4;

/** What the model reports before mapping: its own class index and a centre box (fractions). */
export type RawDetection = {
  classIndex: number;
  confidence: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
};

export type Box = { x: number; y: number; width: number; height: number };
export type MappedDetection = { classKey: string; confidence: number; box: Box };

export type MapperConfig = {
  confidenceFloor: number;
  rename: Record<string, string>;
  maxDetections: number;
  /** Two boxes of the same class overlapping this much are one defect reported twice. 0 keeps all. */
  overlapIou: number;
};

export const DEFAULT_MAPPER_CONFIG: MapperConfig = {
  confidenceFloor: 0.25,
  rename: {},
  maxDetections: CONTRACT_MAX_DETECTIONS,
  overlapIou: 0.7,
};

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Python's round(v, 4) for the values a model gives (exact ties don't occur in practice). */
const round = (v: number) => Number(v.toFixed(DECIMALS));

/** Intersection over union of two top-left boxes, 0 to 1. */
export function iou(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / (a.width * a.height + b.width * b.height - inter);
}

/**
 * The model's own name for the class, then the team's rename, if any. An index the names don't
 * cover becomes `class_<n>`: the app doesn't know that key, so the scan goes to the QI.
 */
export function classKeyFor(
  index: number,
  names: Record<number, string>,
  rename: Record<string, string>,
): string {
  const key = names[index] ?? `class_${index}`;
  return rename[key] ?? key;
}

/** Centre box → top-left box clipped to the image. Null when nothing of it is inside. */
export function toBox(cx: number, cy: number, w: number, h: number): Box | null {
  const x0 = clamp(cx - w / 2);
  const x1 = clamp(cx + w / 2);
  const y0 = clamp(cy - h / 2);
  const y1 = clamp(cy + h / 2);
  const x = round(x0);
  const y = round(y0);
  // Rounding each side on its own could push the far edge past 1, so trim to what's left.
  const width = Math.min(round(x1 - x0), round(1 - x));
  const height = Math.min(round(y1 - y0), round(1 - y));
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/**
 * Floor, map, sort by confidence (highest first), drop same-class copies of one box and keep the
 * strongest `maxDetections`.
 */
export function mapDetections(
  raw: readonly RawDetection[],
  names: Record<number, string>,
  config: MapperConfig = DEFAULT_MAPPER_CONFIG,
): MappedDetection[] {
  let mapped: MappedDetection[] = [];
  for (const d of raw) {
    if (d.confidence < config.confidenceFloor) continue;
    const box = toBox(d.cx, d.cy, d.w, d.h);
    if (!box) continue;
    mapped.push({
      classKey: classKeyFor(d.classIndex, names, config.rename),
      confidence: round(clamp(d.confidence)),
      box,
    });
  }
  // Array.prototype.sort is stable, like Python's sort, so ties keep the model's order.
  mapped.sort((a, b) => b.confidence - a.confidence);
  if (config.overlapIou > 0) {
    const kept: MappedDetection[] = [];
    for (const det of mapped) {
      const copy = kept.some(
        (k) => k.classKey === det.classKey && iou(k.box, det.box) >= config.overlapIou,
      );
      if (!copy) kept.push(det);
    }
    mapped = kept;
  }
  return mapped.slice(0, config.maxDetections);
}
