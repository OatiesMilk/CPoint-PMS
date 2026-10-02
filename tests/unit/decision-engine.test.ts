import { describe, expect, it } from "vitest";
import { decide, validateThresholds, type DefectTypeInfo } from "@/lib/decision-engine";

const types = new Map<string, DefectTypeInfo>([
  ["cut", { id: "t-cut", isActive: true }],
  ["hole", { id: "t-hole", isActive: true }],
  ["abrasion", { id: "t-abr", isActive: true }],
  ["dirt", { id: "t-dirt", isActive: false }], // deactivated by an admin
]);
const t = { rejectAtOrAbove: 0.9, reworkAtOrAbove: 0.6 };
const verdictFor = (...dets: [string, number][]) =>
  decide(
    dets.map(([classKey, confidence]) => ({ classKey, confidence })),
    types,
    t,
  ).verdict;

describe("decide (D-011)", () => {
  it("passes a clean section", () => {
    expect(decide([], types, t)).toEqual({
      verdict: "PASS",
      maxConfidence: null,
      unknownKeys: [],
      ignoredKeys: [],
    });
  });

  it.each([
    [0.5999, "PASS"],
    [0.6, "REWORK"],
    [0.75, "REWORK"],
    [0.8999, "REWORK"],
    [0.9, "REJECT"],
    [0.99, "REJECT"],
  ])("confidence %f → %s", (confidence, verdict) => {
    expect(verdictFor(["cut", confidence])).toBe(verdict);
  });

  it("uses the highest confidence across detections", () => {
    const d = decide(
      [
        { classKey: "hole", confidence: 0.62 },
        { classKey: "cut", confidence: 0.93 },
        { classKey: "abrasion", confidence: 0.4 },
      ],
      types,
      t,
    );
    expect(d).toMatchObject({ verdict: "REJECT", maxConfidence: 0.93 });
  });

  it("ignores deactivated defect types", () => {
    const d = decide([{ classKey: "dirt", confidence: 0.99 }], types, t);
    expect(d).toEqual({
      verdict: "PASS",
      maxConfidence: null,
      unknownKeys: [],
      ignoredKeys: ["dirt"],
    });
  });

  it("sends unknown classes to review, even next to a certain reject", () => {
    const d = decide(
      [
        { classKey: "cut", confidence: 0.95 },
        { classKey: "scratch", confidence: 0.7 },
        { classKey: "scratch", confidence: 0.8 },
      ],
      types,
      t,
    );
    expect(d).toEqual({
      verdict: "NEEDS_REVIEW",
      maxConfidence: 0.95,
      unknownKeys: ["scratch"],
      ignoredKeys: [],
    });
  });

  it("follows edited thresholds (they are data, not constants)", () => {
    expect(
      decide([{ classKey: "cut", confidence: 0.85 }], types, {
        rejectAtOrAbove: 0.8,
        reworkAtOrAbove: 0.5,
      }).verdict,
    ).toBe("REJECT");
  });
});

describe("validateThresholds", () => {
  it("accepts the defaults and rejects inverted or out-of-range values", () => {
    expect(validateThresholds(t)).toBeNull();
    expect(validateThresholds({ rejectAtOrAbove: 0.6, reworkAtOrAbove: 0.9 })).toMatch(
      /lower than/,
    );
    expect(validateThresholds({ rejectAtOrAbove: 1.2, reworkAtOrAbove: 0.6 })).toMatch(
      /between 0 and 1/,
    );
    expect(validateThresholds({ rejectAtOrAbove: 0.9, reworkAtOrAbove: 0 })).toMatch(
      /between 0 and 1/,
    );
  });
});
