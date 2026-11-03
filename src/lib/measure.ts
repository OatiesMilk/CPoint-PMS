/**
 * Measuring defects in inches (Phase 30C, D-106, D-110). Pure and client-safe; the same maths as
 * `cv/cpoint_cv/measure.py`, so the app's numbers match the toolkit's.
 *
 * The scale is the inches the phone sees across the photo's width (its calibration, A-18). A box
 * is in fractions of the photo, so with the photo's height ÷ width it converts straight to inches.
 * A defect's length is its box diagonal; a shot's defect area is the union of its boxes, overlaps
 * counted once (C-35). A type with a flat share (D-110: a cut from 3 in counts 1%) adds that share
 * instead of its box area. A roll's share is its shots' area over its entered area (D-103) plus the
 * flat shares; more than the limit is over (strict, C-9).
 */

export const SQ_IN_PER_SQ_FT = 144;

/** Known sheet sizes in inches (short side, long side), as in `calibration.py`. */
export const SHEET_SIZES = {
  a4: { label: "A4", short: 8.27, long: 11.69 },
  letter: { label: "Letter", short: 8.5, long: 11 },
} as const;
export type SheetKey = keyof typeof SHEET_SIZES;

export type Scale = { widthIn: number; aspect: number };
export type Box = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** The photo's height ÷ width, or null when its size isn't known. */
export function scaleOf(
  widthIn: number | null | undefined,
  imageWidth: number | null | undefined,
  imageHeight: number | null | undefined,
): Scale | null {
  if (!widthIn || !imageWidth || !imageHeight) return null;
  if (!(widthIn > 0) || !(imageWidth > 0) || !(imageHeight > 0)) return null;
  return { widthIn, aspect: imageHeight / imageWidth };
}

/** A box's diagonal in inches: its length (D-106). */
export function boxLengthIn(box: Box, scale: Scale): number {
  const w = box.width * scale.widthIn;
  const h = box.height * scale.widthIn * scale.aspect;
  return Math.hypot(w, h);
}

/** A box's area in square inches. */
export function boxAreaSqIn(box: Box, scale: Scale): number {
  return box.width * scale.widthIn * (box.height * scale.widthIn * scale.aspect);
}

/**
 * The area covered by boxes, overlaps counted once, in the boxes' own units squared (exact, by
 * slicing at every left and right edge, as `union_area_rects` in the toolkit).
 */
export function unionArea(boxes: readonly Box[]): number {
  const rects = boxes
    .filter((b) => b.width > 0 && b.height > 0)
    .map((b) => ({ x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }));
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const left = xs[i];
    const right = xs[i + 1];
    const spans = rects
      .filter((r) => r.x0 <= left && r.x1 >= right)
      .map((r) => [r.y0, r.y1] as const)
      .sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let run: [number, number] | null = null;
    for (const [y0, y1] of spans) {
      if (!run || y0 > run[1]) {
        if (run) covered += run[1] - run[0];
        run = [y0, y1];
      } else run[1] = Math.max(run[1], y1);
    }
    if (run) covered += run[1] - run[0];
    total += covered * (right - left);
  }
  return total;
}

/** Boxes in fractions → their union in square inches. */
export function unionAreaSqIn(boxes: readonly Box[], scale: Scale): number {
  const inches = boxes.map((b) => ({
    x: b.x * scale.widthIn,
    y: b.y * scale.widthIn * scale.aspect,
    width: b.width * scale.widthIn,
    height: b.height * scale.widthIn * scale.aspect,
  }));
  return unionArea(inches);
}

/** Whether a length reaches a limit: 3.00 in does, 2.99 in doesn't (C-37). */
export function reaches(lengthIn: number, limitIn: number): boolean {
  return lengthIn >= limitIn - 1e-9;
}

// ───────────── a shot ─────────────

/** How a found defect's type counts toward the roll (D-110). */
export type CountRule = { notAcceptedFromIn: number | null; flatSharePct: number | null };

export type ShotDefect = { box: Box; found: boolean; rule: CountRule | null };

export type ShotMeasure = {
  /** Per defect, in the order given: length and area, or null without a scale. */
  sizes: { lengthIn: number | null; areaSqIn: number | null }[];
  /** The union of the found defects counted by area; null without a scale. */
  defectAreaSqIn: number | null;
  /** The flat shares of the found defects counted that way; null without a scale. */
  flatSharePct: number | null;
};

/**
 * One shot: each defect's size, and what its found defects add to the roll. A found defect of an
 * active type counts (C-35); one whose type has a flat share adds that share only when it reaches
 * the type's length limit (a cut under 3 in adds nothing, D-110), the rest add their box area.
 */
export function measureShot(defects: readonly ShotDefect[], scale: Scale | null): ShotMeasure {
  if (!scale)
    return {
      sizes: defects.map(() => ({ lengthIn: null, areaSqIn: null })),
      defectAreaSqIn: null,
      flatSharePct: null,
    };
  const sizes = defects.map((d) => ({
    lengthIn: boxLengthIn(d.box, scale),
    areaSqIn: boxAreaSqIn(d.box, scale),
  }));
  const byArea: Box[] = [];
  let flat = 0;
  defects.forEach((d, i) => {
    if (!d.found || !d.rule) return;
    if (d.rule.flatSharePct != null) {
      const limit = d.rule.notAcceptedFromIn;
      if (limit == null || reaches(sizes[i].lengthIn, limit)) flat += d.rule.flatSharePct;
    } else byArea.push(d.box);
  });
  return { sizes, defectAreaSqIn: unionAreaSqIn(byArea, scale), flatSharePct: flat };
}

// ───────────── a roll ─────────────

export type RollShot = { defectAreaSqIn: number | null; flatSharePct: number | null };

export type RollShare =
  | { measured: true; defectAreaSqIn: number; sharePct: number; over: boolean }
  | { measured: false; reason: "no-area" | "no-shots" | "unscaled"; unscaledShots: number };

/**
 * A roll's defect share: its shots' areas over its entered area (D-103), plus the flat shares
 * (D-110). Not measured when it has no area, no shots, or any shot without a scale (A-28).
 */
export function rollShare(
  areaSqFt: number | null,
  shots: readonly RollShot[],
  limitPct: number,
): RollShare {
  const unscaledShots = shots.filter((s) => s.defectAreaSqIn == null).length;
  if (!areaSqFt || areaSqFt <= 0) return { measured: false, reason: "no-area", unscaledShots };
  if (shots.length === 0) return { measured: false, reason: "no-shots", unscaledShots };
  if (unscaledShots > 0) return { measured: false, reason: "unscaled", unscaledShots };
  const defectAreaSqIn = shots.reduce((sum, s) => sum + (s.defectAreaSqIn ?? 0), 0);
  const flat = shots.reduce((sum, s) => sum + (s.flatSharePct ?? 0), 0);
  const sharePct = (defectAreaSqIn / (areaSqFt * SQ_IN_PER_SQ_FT)) * 100 + flat;
  return { measured: true, defectAreaSqIn, sharePct, over: isOver(sharePct, limitPct) };
}

/** More than the limit, strictly: exactly 10.00% isn't over (C-9). Compared at 0.01%. */
export function isOver(sharePct: number, limitPct: number): boolean {
  return Math.round(sharePct * 100) > Math.round(limitPct * 100);
}

// ───────────── calibration (A-18) ─────────────

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Pixels per inch from a sheet's four corners tapped on a photo, in any order. The
 * opposite sides are averaged, then the long and short sides, as `cpoint_cv calibrate` does.
 * Returns null when the four points don't look like the sheet (sides off by more than 15%).
 */
export function pxPerInFromCorners(
  corners: readonly Point[],
  sheet: { short: number; long: number },
): number | null {
  if (corners.length !== 4) return null;
  // Taps can come in any order: put them in order around their centre first.
  const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
  const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
  const [a, b, c, d] = [...corners].sort(
    (p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx),
  );
  const side1 = (dist(a, b) + dist(c, d)) / 2;
  const side2 = (dist(b, c) + dist(d, a)) / 2;
  const longPx = Math.max(side1, side2);
  const shortPx = Math.min(side1, side2);
  if (!(shortPx > 0)) return null;
  const aspect = longPx / shortPx;
  const sheetAspect = sheet.long / sheet.short;
  if (Math.abs(aspect - sheetAspect) / sheetAspect > 0.15) return null;
  return (longPx / sheet.long + shortPx / sheet.short) / 2;
}

/** The inches a photo of this width covers at this many pixels per inch. */
export function widthInFrom(pxPerIn: number, imageWidth: number): number {
  return imageWidth / pxPerIn;
}

/** The calibration's own bounds: a phone on the stand sees between 4 and 120 in across. */
export const WIDTH_IN_MIN = 4;
export const WIDTH_IN_MAX = 120;

export const formatInches = (n: number) => `${n.toFixed(2)} in`;
export const formatPct = (n: number) => `${n.toFixed(1)}%`;
