import { describe, expect, it } from "vitest";
import { decide, outcomeFor, type DefectTypeInfo } from "@/lib/decision-engine";
import {
  boxAreaSqIn,
  boxLengthIn,
  isOver,
  measureShot,
  rollShare,
  scaleOf,
  unionArea,
  unionAreaSqIn,
  widthInFrom,
} from "@/lib/measure";
import { rollFindings } from "@/lib/roll-findings";

// The Phase 30B letter-size test (cv/reports/2026-11-02-LETTER-TEST-measure.md): 3024 × 4032
// phone photos, the width seen from the sheet itself, and the toolkit's box figures.
const PHOTO = { width: 3024, height: 4032 };
const shot35 = scaleOf(18.41, PHOTO.width, PHOTO.height)!;
const shot55 = scaleOf(18.47, PHOTO.width, PHOTO.height)!;
const box35 = { x: 0.4, y: 0.45, width: 3.49 / 18.41, height: 0.81 / (18.41 * (4032 / 3024)) };
const box55 = { x: 0.4, y: 0.4, width: 3.14 / 18.47, height: 4.88 / (18.47 * (4032 / 3024)) };

describe("measuring by the box (D-106), matching the toolkit", () => {
  it("reads the 3.5 in line as 3.58 in and the 5.5 in line as 5.80 in", () => {
    expect(boxLengthIn(box35, shot35)).toBeCloseTo(3.58, 2);
    expect(boxLengthIn(box55, shot55)).toBeCloseTo(5.8, 2);
  });

  it("gives the same box areas: 2.83 and 15.33 sq in", () => {
    expect(boxAreaSqIn(box35, shot35)).toBeCloseTo(2.83, 2);
    expect(boxAreaSqIn(box55, shot55)).toBeCloseTo(15.32, 1);
  });

  it("puts the letter piece at 19.4% by box, over 10%", () => {
    const share = rollShare(
      0.649,
      [
        { defectAreaSqIn: 0, flatSharePct: 0 },
        { defectAreaSqIn: 2.84, flatSharePct: 0 },
        { defectAreaSqIn: 15.33, flatSharePct: 0 },
      ],
      10,
    );
    expect(share).toMatchObject({ measured: true, over: true });
    if (share.measured) expect(share.sharePct).toBeCloseTo(19.4, 1);
  });

  it("puts the same piece at 2% when each cut from 3 in counts a flat 1% (D-110)", () => {
    const cut = { notAcceptedFromIn: 3, flatSharePct: 1 };
    const a = measureShot([{ box: box35, found: true, rule: cut }], shot35);
    const b = measureShot([{ box: box55, found: true, rule: cut }], shot55);
    expect(a).toMatchObject({ defectAreaSqIn: 0, flatSharePct: 1 });
    expect(b).toMatchObject({ defectAreaSqIn: 0, flatSharePct: 1 });
    const share = rollShare(0.649, [a, b], 10);
    expect(share).toEqual({ measured: true, defectAreaSqIn: 0, sharePct: 2, over: false });
  });

  it("adds nothing for a cut under 3 in, and counts a hole by its box area", () => {
    const scale = scaleOf(20, 2000, 1000)!; // 20 × 10 in
    const short = { x: 0, y: 0, width: 0.1, height: 0.1 }; // 2 × 1 in, 2.24 in long
    const hole = { x: 0.5, y: 0.5, width: 0.05, height: 0.1 }; // 1 × 1 in
    const shot = measureShot(
      [
        { box: short, found: true, rule: { notAcceptedFromIn: 3, flatSharePct: 1 } },
        { box: hole, found: true, rule: { notAcceptedFromIn: null, flatSharePct: null } },
      ],
      scale,
    );
    expect(shot.flatSharePct).toBe(0);
    expect(shot.defectAreaSqIn).toBeCloseTo(1, 6);
    expect(shot.sizes[0].lengthIn).toBeCloseTo(Math.hypot(2, 1), 6);
  });

  it("leaves out defects below found-at and of inactive types", () => {
    const scale = scaleOf(20, 2000, 1000)!;
    const box = { x: 0, y: 0, width: 0.5, height: 0.5 };
    const shot = measureShot(
      [
        { box, found: false, rule: { notAcceptedFromIn: null, flatSharePct: null } },
        { box, found: true, rule: null },
      ],
      scale,
    );
    expect(shot).toMatchObject({ defectAreaSqIn: 0, flatSharePct: 0 });
  });

  it("measures nothing without a calibration", () => {
    const shot = measureShot(
      [{ box: box35, found: true, rule: { notAcceptedFromIn: 3, flatSharePct: 1 } }],
      scaleOf(null, 3024, 4032),
    );
    expect(shot).toEqual({
      sizes: [{ lengthIn: null, areaSqIn: null }],
      defectAreaSqIn: null,
      flatSharePct: null,
    });
  });
});

describe("unionArea: overlaps counted once (C-35)", () => {
  it("adds separate boxes and counts an overlap once", () => {
    expect(
      unionArea([
        { x: 0, y: 0, width: 2, height: 2 },
        { x: 5, y: 5, width: 1, height: 1 },
      ]),
    ).toBeCloseTo(5, 9);
    expect(
      unionArea([
        { x: 0, y: 0, width: 2, height: 2 },
        { x: 1, y: 1, width: 2, height: 2 },
      ]),
    ).toBeCloseTo(7, 9);
    expect(
      unionArea([
        { x: 0, y: 0, width: 4, height: 4 },
        { x: 1, y: 1, width: 1, height: 1 },
      ]),
    ).toBeCloseTo(16, 9);
    expect(unionArea([])).toBe(0);
  });

  it("works in inches from fractions", () => {
    const scale = scaleOf(20, 2000, 1000)!;
    expect(
      unionAreaSqIn(
        [
          { x: 0, y: 0, width: 0.1, height: 0.2 },
          { x: 0.05, y: 0, width: 0.1, height: 0.2 },
        ],
        scale,
      ),
    ).toBeCloseTo(6, 9); // 3 in × 2 in
  });
});

describe("the supplier limit: more than, strictly (C-9)", () => {
  it("doesn't mark exactly 10.00% and marks 10.01%", () => {
    expect(isOver(10, 10)).toBe(false);
    expect(isOver(10.004, 10)).toBe(false);
    expect(isOver(10.01, 10)).toBe(true);
    // 10 sq ft = 1,440 sq in; 144 sq in is exactly 10%.
    expect(rollShare(10, [{ defectAreaSqIn: 144, flatSharePct: 0 }], 10)).toMatchObject({
      sharePct: 10,
      over: false,
    });
    expect(rollShare(10, [{ defectAreaSqIn: 144.2, flatSharePct: 0 }], 10)).toMatchObject({
      over: true,
    });
  });

  it("isn't measured with no area, no shots or a shot without a scale (A-28)", () => {
    expect(rollShare(null, [{ defectAreaSqIn: 1, flatSharePct: 0 }], 10)).toMatchObject({
      measured: false,
      reason: "no-area",
    });
    expect(rollShare(20, [], 10)).toMatchObject({ measured: false, reason: "no-shots" });
    expect(
      rollShare(
        20,
        [
          { defectAreaSqIn: 1, flatSharePct: 0 },
          { defectAreaSqIn: null, flatSharePct: null },
        ],
        10,
      ),
    ).toEqual({ measured: false, reason: "unscaled", unscaledShots: 1 });
  });

  it("adds the flat shares to the area share", () => {
    // 20 sq ft = 2,880 sq in; 144 sq in is 5%, plus three cuts at 1% each.
    expect(
      rollShare(
        20,
        [
          { defectAreaSqIn: 144, flatSharePct: 2 },
          { defectAreaSqIn: 0, flatSharePct: 1 },
        ],
        10,
      ),
    ).toEqual({ measured: true, defectAreaSqIn: 144, sharePct: 8, over: false });
  });
});

describe("the 3-inch line (C-37)", () => {
  const types = new Map<string, DefectTypeInfo>([
    ["cut", { id: "c", isActive: true, outcome: "NOT_ACCEPTED", notAcceptedFromIn: 3 }],
    ["scratch", { id: "s", isActive: true, outcome: "USABLE", notAcceptedFromIn: null }],
  ]);
  const rule = { foundAtOrAbove: 0.5 };
  const verdict = (classKey: string, lengthIn: number | null) =>
    decide([{ classKey, confidence: 0.9, lengthIn }], types, rule).verdict;

  it("passes a 2.99 in cut and rejects a 3.00 in one", () => {
    expect(verdict("cut", 2.99)).toBe("PASS");
    expect(verdict("cut", 3)).toBe("REJECT");
    expect(verdict("cut", 5.8)).toBe("REJECT");
  });

  it("counts an unmeasured cut as Not accepted, the safe side", () => {
    expect(verdict("cut", null)).toBe("REJECT");
    expect(outcomeFor("NOT_ACCEPTED", 3, undefined)).toBe("NOT_ACCEPTED");
  });

  it("leaves a type without a length limit to its outcome (a scratch at any length, C-39)", () => {
    expect(verdict("scratch", 20)).toBe("PASS");
    expect(outcomeFor("USABLE", null, 20)).toBe("USABLE");
  });
});

describe("the scale from pixels per inch", () => {
  it("gives the inches a photo covers across", () => {
    expect(widthInFrom(100, 1920)).toBeCloseTo(19.2, 5);
  });
});

describe("rollFindings (Phase 30C)", () => {
  const snapshot = {
    foundAtOrAbove: 0.5,
    outcomes: { cut: "NOT_ACCEPTED", scratch: "USABLE" },
    lengthLimits: { cut: 3 },
  };
  const det = (key: string, confidence: number, lengthIn: number | null, areaSqIn: number) => ({
    rawClassKey: key,
    confidence,
    lengthIn,
    areaSqIn,
    defectType: { label: key === "cut" ? "Cut" : "Scratch" },
  });

  it("counts found defects by type with the longest, and lists the largest boxes", () => {
    const f = rollFindings([
      {
        id: "s1",
        sequence: 1,
        thresholdsSnapshot: snapshot,
        detections: [det("cut", 0.9, 2.5, 3), det("cut", 0.9, 4.2, 9), det("cut", 0.3, 9, 50)],
      },
      {
        id: "s2",
        sequence: 2,
        thresholdsSnapshot: snapshot,
        detections: [det("scratch", 0.8, 6, 12)],
      },
    ]);
    expect(f.byType).toEqual([
      { label: "Cut", count: 2, notAccepted: 1, longestIn: 4.2 },
      { label: "Scratch", count: 1, notAccepted: 0, longestIn: 6 },
    ]);
    expect(f.largest.map((d) => [d.sequence, d.label, d.areaSqIn, d.outcome])).toEqual([
      [2, "Scratch", 12, "USABLE"],
      [1, "Cut", 9, "NOT_ACCEPTED"],
      [1, "Cut", 3, "USABLE"],
    ]);
  });
});
