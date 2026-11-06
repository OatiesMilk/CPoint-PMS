/**
 * The scale marker card (D-120): a printed ArUco marker, DICT_4X4_50 id 0, whose black square is
 * 2.00 in a side (`calibration/cpoint-scale-marker-2in.pdf`). It lies flat on the leather in every
 * shot; its four corners give the pixels per inch, so each shot carries its own scale in place of
 * the phone's tap calibration (A-18). Pure and client-safe: Capture and the server use the same
 * maths. Reading the corners off a picture is `marker-detect.ts` (browser only).
 */
import { WIDTH_IN_MAX, WIDTH_IN_MIN, type Box, type Point } from "./measure";

/** The marker's id in DICT_4X4_50 (the first 50 codes of OpenCV's 4x4_1000). */
export const MARKER_ID = 0;
/** The black square's side in inches. */
export const MARKER_SIDE_IN = 2;

/**
 * The printed card around the black square, in square sides from the square's own top-left
 * corner: 0.5 in of white border on the top, left and right, 0.9 in at the bottom (the caption).
 */
const CARD = { left: -0.25, right: 1.25, top: -0.25, bottom: 1.45 };

/** Smallest side a marker may have in the picture, in pixels; smaller reads unreliably. */
export const MARKER_MIN_SIDE_PX = 24;
/** Opposite or adjacent sides more than 15% apart: the phone is tilted, the scale isn't one. */
const TILT_TOLERANCE = 0.15;

/** Four corners in marker order (top-left, top-right, bottom-right, bottom-left as printed). */
export type Quad = [Point, Point, Point, Point];

export type MarkerProblem = "none" | "small" | "tilted" | "range";

export type MarkerScale =
  | {
      ok: true;
      pxPerIn: number;
      /** Inches across the photo's width, the scale saved with the shot (`scans.widthIn`). */
      widthIn: number;
      /** The markers' corners in fractions of the photo's width and height. */
      quads: Quad[];
    }
  | { ok: false; problem: MarkerProblem };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** A marker's pixels per inch, or why it can't give one. Corners are in pixels. */
export function markerPxPerIn(quad: Quad): { pxPerIn: number } | { problem: "small" | "tilted" } {
  const [a, b, c, d] = quad;
  const top = dist(a, b);
  const right = dist(b, c);
  const bottom = dist(c, d);
  const left = dist(d, a);
  const sides = [top, right, bottom, left];
  if (Math.min(...sides) < MARKER_MIN_SIDE_PX) return { problem: "small" };
  const across = (top + bottom) / 2;
  const down = (left + right) / 2;
  const apart = (p: number, q: number) => Math.abs(p - q) / Math.max(p, q);
  if (
    apart(top, bottom) > TILT_TOLERANCE ||
    apart(left, right) > TILT_TOLERANCE ||
    apart(across, down) > TILT_TOLERANCE
  )
    return { problem: "tilted" };
  return { pxPerIn: (across + down) / 2 / MARKER_SIDE_IN };
}

/**
 * The shot's scale from the markers found on it (corners in pixels of a picture this size). Two
 * cards in view are averaged; one that is too small or tilted is left out. With none usable the
 * problem says what to tell the constructor.
 */
export function scaleFromMarkers(
  quadsPx: readonly Quad[],
  width: number,
  height: number,
): MarkerScale {
  if (quadsPx.length === 0 || !(width > 0) || !(height > 0)) return { ok: false, problem: "none" };
  const usable: { quad: Quad; pxPerIn: number }[] = [];
  let problem: MarkerProblem = "none";
  for (const quad of quadsPx) {
    const read = markerPxPerIn(quad);
    if ("pxPerIn" in read) usable.push({ quad, pxPerIn: read.pxPerIn });
    else if (problem !== "tilted") problem = read.problem;
  }
  if (usable.length === 0) return { ok: false, problem };
  const pxPerIn = usable.reduce((s, m) => s + m.pxPerIn, 0) / usable.length;
  const widthIn = width / pxPerIn;
  if (widthIn < WIDTH_IN_MIN || widthIn > WIDTH_IN_MAX) return { ok: false, problem: "range" };
  return {
    ok: true,
    pxPerIn,
    widthIn: Math.round(widthIn * 100) / 100,
    quads: usable.map(({ quad }) => quad.map((p) => ({ x: p.x / width, y: p.y / height })) as Quad),
  };
}

/** The same, from corners in fractions of the photo (as Capture sends them). */
export function scaleFromFractions(
  quads: readonly Quad[],
  width: number,
  height: number,
): MarkerScale {
  return scaleFromMarkers(
    quads.map((q) => q.map((p) => ({ x: p.x * width, y: p.y * height })) as Quad),
    width,
    height,
  );
}

/** What Capture tells the constructor when the card can't give the scale. */
export const MARKER_MESSAGES: Record<MarkerProblem, string> = {
  none: "Show the marker card to capture.",
  small: "The marker card is too small in the picture. Bring the phone closer.",
  tilted: "Hold the phone flat above the leather so the marker card looks square.",
  range: "The marker card gives a size the app can't use. Check it was printed at 100%.",
};

/**
 * The card once per roll (D-121): every camera at the factory is fixed, so the card read at a
 * roll's first shot gives the scale for its later shots of the same frame size.
 */
export const CARD_FIRST_SHOT =
  "Show the marker card for this roll's first shot. It sets the scale for the rest of the roll.";
export const CARD_NEW_SIZE =
  "This camera's picture is a different size from the roll's first shot. Show the marker card once to set its scale.";

/** The roll's scale, as Capture gets it with the roll: the latest measured shot's. */
export type RollScale = { widthIn: number; width: number; height: number; shot: number };

/** Whether a frame of this size can use the roll's scale without the card. */
export function rollScaleFits(
  scale: RollScale | null,
  width: number,
  height: number,
): scale is RollScale {
  return !!scale && scale.width === width && scale.height === height;
}

/**
 * The printed card's outline from its marker's corners, by the square's own directions. Corners
 * and outline are in the same units (fractions of the photo's width and height work).
 */
export function cardOutline(quad: Quad): Quad {
  const [a, b, , d] = quad;
  const at = (u: number, v: number): Point => ({
    x: a.x + u * (b.x - a.x) + v * (d.x - a.x),
    y: a.y + u * (b.y - a.y) + v * (d.y - a.y),
  });
  return [
    at(CARD.left, CARD.top),
    at(CARD.right, CARD.top),
    at(CARD.right, CARD.bottom),
    at(CARD.left, CARD.bottom),
  ];
}

/** Whether a point is inside a convex quad, either winding. */
export function insideQuad(p: Point, quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Whether a box (fractions of the photo) is on a card: its centre inside a card's outline. The
 * card isn't leather, so a box there is no defect (A-46). Quads are in fractions too; on a photo
 * that isn't square the fractions stretch both shapes alike, so the test still holds.
 */
export function onCard(box: Box, quads: readonly Quad[]): boolean {
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return quads.some((q) => insideQuad(centre, cardOutline(q)));
}

/** The sizes a picture is read at, widest first: a soft or small card often reads at one only. */
export const MARKER_READ_WIDTHS = [960, 640] as const;
/** Frames Capture tries at a press before saying the card isn't seen (QA run 2, F1). */
export const MARKER_PRESS_TRIES = 8;

/** A worse problem wins when several reads fail, so the constructor hears the useful one. */
const PROBLEM_RANK: Record<MarkerProblem, number> = { none: 0, small: 1, range: 2, tilted: 3 };

export function worseProblem(a: MarkerProblem, b: MarkerProblem): MarkerProblem {
  return PROBLEM_RANK[b] > PROBLEM_RANK[a] ? b : a;
}

/**
 * The first frame on which the card gives a scale, trying up to `tries` frames (`wait` lets the
 * camera move on to a new one between tries). The live check finds the card on some frames, not
 * every one, so a press reads a few frames rather than one (QA run 2, F1); the corners always come
 * from the frame that is sent.
 */
export async function firstMarkedFrame<F>(
  grab: () => F | null,
  read: (frame: F) => MarkerScale | null,
  wait: () => Promise<void>,
  tries: number = MARKER_PRESS_TRIES,
): Promise<
  | { ok: true; frame: F; scale: Extract<MarkerScale, { ok: true }> }
  | {
      ok: false;
      problem: MarkerProblem;
    }
> {
  let problem: MarkerProblem = "none";
  for (let i = 0; i < tries; i++) {
    if (i > 0) await wait();
    const frame = grab();
    if (frame === null) continue;
    const scale = read(frame);
    if (scale?.ok) return { ok: true, frame, scale };
    if (scale) problem = worseProblem(problem, scale.problem);
  }
  return { ok: false, problem };
}
