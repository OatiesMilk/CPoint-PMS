import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { findMarkerQuads } from "@/lib/marker-detect";
import {
  cardOutline,
  firstMarkedFrame,
  insideQuad,
  MARKER_MESSAGES,
  markerPxPerIn,
  onCard,
  scaleFromFractions,
  scaleFromMarkers,
  worseProblem,
  type MarkerScale,
  type Quad,
} from "@/lib/scale-marker";

/** Pictures made from the printed PDF: the card at 50 px per inch on a 960 × 540 brown frame. */
async function picture(name: string) {
  const file = path.join(__dirname, "../fixtures/marker", name);
  const { data, info } = await sharp(readFileSync(file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

const square = (x: number, y: number, side: number): Quad => [
  { x, y },
  { x: x + side, y },
  { x: x + side, y: y + side },
  { x, y: y + side },
];

describe("reading the printed marker card (D-120)", () => {
  it("finds id 0 on the card and reads the 2.00 in square as 100 px, so 19.2 in across", async () => {
    const img = await picture("flat.png");
    const quads = findMarkerQuads(img);
    expect(quads).toHaveLength(1);
    const scale = scaleFromMarkers(quads, img.width, img.height);
    expect(scale.ok).toBe(true);
    if (scale.ok) {
      expect(Math.abs(scale.pxPerIn - 50)).toBeLessThan(0.3);
      expect(scale.widthIn).toBeCloseTo(19.2, 0);
    }
  });

  it("still reads the card turned 23°", async () => {
    const img = await picture("turned.png");
    const scale = scaleFromMarkers(findMarkerQuads(img), img.width, img.height);
    expect(scale.ok).toBe(true);
    if (scale.ok) expect(scale.widthIn).toBeCloseTo(19.2, 0);
  });

  it("finds the card on a large soft frame once it is read at 960 px, as Capture does (QA F1)", async () => {
    // A 2880 px frame as soft as a webcam's: the detector misses the card at full size, so
    // Capture reads every frame at 960 px wide, the size the live check uses.
    const big = await sharp(path.join(__dirname, "../fixtures/marker/flat.png"))
      .resize(2880)
      .blur(3)
      .toBuffer();
    const read = async (width?: number) => {
      const { data, info } = await sharp(big)
        .resize(width)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const img = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
      return scaleFromMarkers(findMarkerQuads(img), img.width, img.height);
    };
    expect((await read()).ok).toBe(false);
    const small = await read(960);
    expect(small.ok).toBe(true);
    if (small.ok) expect(small.widthIn).toBeCloseTo(19.2, 0);
  });

  it("finds nothing on bare leather and says to show the card", async () => {
    const img = await picture("none.png");
    const scale = scaleFromMarkers(findMarkerQuads(img), img.width, img.height);
    expect(scale).toEqual({ ok: false, problem: "none" });
    expect(MARKER_MESSAGES.none).toBe("Show the marker card to capture.");
  });
});

describe("the scale from the marker's corners", () => {
  it("refuses a marker too small to read well", () => {
    expect(markerPxPerIn(square(0, 0, 20))).toEqual({ problem: "small" });
  });

  it("refuses a marker that looks tilted (sides more than 15% apart)", () => {
    const tilted: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 90, y: 80 },
      { x: 10, y: 80 },
    ];
    expect(markerPxPerIn(tilted)).toEqual({ problem: "tilted" });
    expect(scaleFromMarkers([tilted], 1920, 1080)).toEqual({ ok: false, problem: "tilted" });
  });

  it("averages two cards and gives the corners in fractions", () => {
    const scale = scaleFromMarkers([square(100, 100, 100), square(600, 100, 120)], 1920, 1080);
    expect(scale.ok).toBe(true);
    if (!scale.ok) return;
    expect(scale.pxPerIn).toBeCloseTo(55, 5);
    expect(scale.widthIn).toBeCloseTo(34.91, 2);
    expect(scale.quads[0][0]).toEqual({ x: 100 / 1920, y: 100 / 1080 });
  });

  it("refuses a size outside 4 to 120 in across (a card not printed at 100%)", () => {
    expect(scaleFromMarkers([square(0, 0, 600)], 1000, 800)).toEqual({
      ok: false,
      problem: "range",
    });
  });

  it("gives the same scale from fractions as from pixels", () => {
    const px = scaleFromMarkers([square(400, 300, 80)], 1920, 1080);
    const fr = scaleFromFractions(
      [square(400, 300, 80).map((p) => ({ x: p.x / 1920, y: p.y / 1080 })) as Quad],
      1920,
      1080,
    );
    expect(fr.ok && px.ok && fr.widthIn === px.widthIn).toBe(true);
  });
});

describe("boxes on the card are not defects (A-46)", () => {
  const marker = square(0.4, 0.4, 0.2); // a 0.2-wide square; the card reaches 0.35 to 0.65 across

  it("draws the card around the square, with the caption below", () => {
    const card = cardOutline(marker);
    expect(card[0].x).toBeCloseTo(0.35);
    expect(card[0].y).toBeCloseTo(0.35);
    expect(card[2].x).toBeCloseTo(0.65);
    expect(card[2].y).toBeCloseTo(0.69);
  });

  it("drops a box whose centre is on the card, keeps one beside it", () => {
    expect(onCard({ x: 0.45, y: 0.62, width: 0.04, height: 0.04 }, [marker])).toBe(true);
    expect(onCard({ x: 0.7, y: 0.45, width: 0.05, height: 0.05 }, [marker])).toBe(false);
    expect(onCard({ x: 0.1, y: 0.1, width: 0.05, height: 0.05 }, [])).toBe(false);
  });

  it("tests a point either way round the quad", () => {
    const q = square(0, 0, 1);
    const reversed = [...q].reverse() as Quad;
    expect(insideQuad({ x: 0.5, y: 0.5 }, q)).toBe(true);
    expect(insideQuad({ x: 0.5, y: 0.5 }, reversed)).toBe(true);
    expect(insideQuad({ x: 1.5, y: 0.5 }, q)).toBe(false);
  });
});

describe("a press tries a few frames for the card (QA run 2, F1)", () => {
  const found: MarkerScale = { ok: true, pxPerIn: 50, widthIn: 19.2, quads: [] };
  const missed: MarkerScale = { ok: false, problem: "none" };
  const wait = () => Promise.resolve();

  it("sends the first frame the card reads on, not a later one", async () => {
    let n = 0;
    const reads = [missed, missed, found, found];
    const result = await firstMarkedFrame(
      () => ++n,
      (frame) => reads[frame - 1],
      wait,
    );
    expect(result).toEqual({ ok: true, frame: 3, scale: found });
  });

  it("gives up after the tries with the most useful problem", async () => {
    let n = 0;
    const reads: MarkerScale[] = [missed, { ok: false, problem: "tilted" }, missed];
    const result = await firstMarkedFrame(
      () => n++,
      (frame) => reads[frame] ?? missed,
      wait,
      3,
    );
    expect(result).toEqual({ ok: false, problem: "tilted" });
  });

  it("waits for a new frame between tries only", async () => {
    let waits = 0;
    await firstMarkedFrame(
      () => 1,
      () => missed,
      async () => {
        waits++;
      },
      4,
    );
    expect(waits).toBe(3);
  });

  it("ranks tilted over too small over not seen", () => {
    expect(worseProblem("none", "small")).toBe("small");
    expect(worseProblem("tilted", "small")).toBe("tilted");
    expect(worseProblem("range", "none")).toBe("range");
  });
});
