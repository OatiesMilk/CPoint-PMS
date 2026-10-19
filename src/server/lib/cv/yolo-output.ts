/**
 * The model's input and output geometry. Pure math, no model or image imports.
 *
 * A photo is scaled so its longer side is `size` (yolo-v1: 1536), then padded with grey (114) only
 * up to the next multiple of the model's stride (32), as Ultralytics' LetterBox does for the
 * station's `.pt` model ("rect" inference). A 1920 x 1080 webcam frame becomes 1536 x 864 with no
 * padding at all. This matters: the model gives different results on a full square of grey
 * (Phase 18 parity check). The boxes the model returns are mapped back to fractions of the
 * original photo.
 */
import type { RawDetection } from "./mapper";

export type Letterbox = {
  /** The model's input size, padding included. */
  inputWidth: number;
  inputHeight: number;
  /** The photo's size after scaling, before padding. */
  width: number;
  height: number;
  /** Grey added on the left and top (the right and bottom take the rest). */
  left: number;
  top: number;
  scale: number;
  /** The original photo's size. */
  sourceWidth: number;
  sourceHeight: number;
};

export const PAD_GREY = 114;
export const DEFAULT_STRIDE = 32;

/** How a `sourceWidth x sourceHeight` photo goes into the model at `size`. */
export function letterbox(
  sourceWidth: number,
  sourceHeight: number,
  size: number,
  stride: number = DEFAULT_STRIDE,
): Letterbox {
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error("The image has no pixels.");
  const scale = Math.min(size / sourceWidth, size / sourceHeight);
  const width = Math.min(size, Math.round(sourceWidth * scale));
  const height = Math.min(size, Math.round(sourceHeight * scale));
  // Only the padding that reaches the next multiple of the stride, split between the two sides.
  const padX = (size - width) % stride;
  const padY = (size - height) % stride;
  // Ultralytics rounds the two halves of the padding as round(d - 0.1) and round(d + 0.1).
  // (`|| 0` turns the -0 that rounding -0.1 gives into 0.)
  const left = Math.round(padX / 2 - 0.1) || 0;
  const top = Math.round(padY / 2 - 0.1) || 0;
  const right = Math.round(padX / 2 + 0.1);
  const bottom = Math.round(padY / 2 + 0.1);
  return {
    inputWidth: width + left + right,
    inputHeight: height + top + bottom,
    width,
    height,
    left,
    top,
    scale,
    sourceWidth,
    sourceHeight,
  };
}

/**
 * The model's planar float input (`1 x 3 x inputHeight x inputWidth`, 0 to 1) from the photo's
 * interleaved RGB bytes: scaled with OpenCV's bilinear rule (`cv2.INTER_LINEAR`, which the
 * station's Ultralytics uses: no smoothing when shrinking) and padded with grey. Doing it here
 * instead of with an image library keeps website captures in step with the station.
 */
export function toModelInput(rgb: Uint8Array, box: Letterbox): Float32Array {
  const { sourceWidth: sw, sourceHeight: sh, width: dw, height: dh } = box;
  if (rgb.length !== sw * sh * 3)
    throw new Error(`Expected ${sw * sh * 3} RGB bytes for ${sw} x ${sh}, got ${rgb.length}.`);
  const area = box.inputWidth * box.inputHeight;
  const out = new Float32Array(area * 3).fill(PAD_GREY / 255);

  // For each output column and row: the two source pixels and the weight of the second.
  const axis = (from: number, to: number) => {
    const lo = new Int32Array(to);
    const hi = new Int32Array(to);
    const w = new Float32Array(to);
    const ratio = from / to;
    for (let d = 0; d < to; d++) {
      const f = (d + 0.5) * ratio - 0.5;
      let i = Math.floor(f);
      let t = f - i;
      if (i < 0) {
        i = 0;
        t = 0;
      }
      if (i >= from - 1) {
        i = from - 1;
        t = 0;
      }
      lo[d] = i;
      hi[d] = Math.min(i + 1, from - 1);
      w[d] = t;
    }
    return { lo, hi, w };
  };
  const xs = axis(sw, dw);
  const ys = axis(sh, dh);

  for (let y = 0; y < dh; y++) {
    const r0 = ys.lo[y] * sw;
    const r1 = ys.hi[y] * sw;
    const v = ys.w[y];
    const row = (y + box.top) * box.inputWidth + box.left;
    for (let x = 0; x < dw; x++) {
      const u = xs.w[x];
      const p00 = (r0 + xs.lo[x]) * 3;
      const p01 = (r0 + xs.hi[x]) * 3;
      const p10 = (r1 + xs.lo[x]) * 3;
      const p11 = (r1 + xs.hi[x]) * 3;
      const at = row + x;
      for (let c = 0; c < 3; c++) {
        const top = rgb[p00 + c] + (rgb[p01 + c] - rgb[p00 + c]) * u;
        const bottom = rgb[p10 + c] + (rgb[p11 + c] - rgb[p10 + c]) * u;
        // OpenCV stores the result as a byte, so round before scaling to 0..1.
        out[c * area + at] = Math.round(top + (bottom - top) * v) / 255;
      }
    }
  }
  return out;
}

/**
 * Reads the end-to-end (no NMS) head's first output, `[1, rows, cols]`: each row is x1, y1, x2,
 * y2 in input pixels, the score, the class index, then the mask coefficients, which are ignored
 * (the app's contract is boxes only). Rows below `floor` are dropped; the rest come back as centre
 * boxes in fractions of the original photo, in the model's order.
 */
export function decodeEndToEnd(
  data: ArrayLike<number>,
  rows: number,
  cols: number,
  floor: number,
  box: Letterbox,
): RawDetection[] {
  if (cols < 6)
    throw new Error(`The model's output has ${cols} values per row; expected 6 or more.`);
  if (data.length < rows * cols) throw new Error("The model's output is shorter than its shape.");
  const out: RawDetection[] = [];
  for (let r = 0; r < rows; r++) {
    const o = r * cols;
    const confidence = data[o + 4];
    if (!(confidence >= floor)) continue;
    // Back from the padded square to the photo, then to fractions of it.
    const x1 = (data[o] - box.left) / box.scale / box.sourceWidth;
    const y1 = (data[o + 1] - box.top) / box.scale / box.sourceHeight;
    const x2 = (data[o + 2] - box.left) / box.scale / box.sourceWidth;
    const y2 = (data[o + 3] - box.top) / box.scale / box.sourceHeight;
    out.push({
      classIndex: Math.round(data[o + 5]),
      confidence,
      cx: (x1 + x2) / 2,
      cy: (y1 + y2) / 2,
      w: x2 - x1,
      h: y2 - y1,
    });
  }
  return out;
}
