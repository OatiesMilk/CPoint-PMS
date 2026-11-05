/**
 * Reads the scale marker card off a picture (D-120), with js-aruco2 (pure JS, MIT): ArUco 4x4
 * markers as OpenCV defines them; DICT_4X4_50 is the first 50 codes of its 4x4_1000, so id 0 is
 * the same card. Only id 0 counts. The maths on the corners is in `scale-marker.ts`.
 */
// js-aruco2 exports through `this` (old CommonJS), which bundlers can't see statically, so the
// module object is read at run time instead of a named import.
import aruco, { type ArucoImage } from "js-aruco2";
import "js-aruco2/src/dictionaries/aruco_4x4_1000.js";

const AR = aruco.AR;
import { MARKER_ID, type Quad } from "./scale-marker";

let detector: InstanceType<typeof AR.Detector> | null = null;

/**
 * js-aruco2 gives each corner at the centre of the square's corner pixel, so its sides come out
 * one pixel short (199 for a 200 px square). Each corner moves half a pixel diagonally outwards.
 */
function toEdges(corners: { x: number; y: number }[]): Quad {
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4;
  return corners.map((c) => {
    const d = Math.hypot(c.x - cx, c.y - cy) || 1;
    return { x: c.x + ((c.x - cx) / d) * Math.SQRT1_2, y: c.y + ((c.y - cy) / d) * Math.SQRT1_2 };
  }) as Quad;
}

/** The id-0 markers' corners on this picture, in its pixels (top-left first, as printed). */
export function findMarkerQuads(image: ArucoImage): Quad[] {
  detector ??= new AR.Detector({ dictionaryName: "ARUCO_4X4_1000" });
  return detector
    .detect(image)
    .filter((m) => m.id === MARKER_ID && m.corners.length === 4)
    .map((m) => toEdges(m.corners));
}
