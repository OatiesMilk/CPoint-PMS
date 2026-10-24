import { describe, expect, it } from "vitest";
import {
  decide,
  detectionOutcome,
  outcomeGroups,
  readSnapshot,
  type DefectTypeInfo,
} from "@/lib/decision-engine";

// The model's classes as CPoint decided them (C-11, C-12, C-19, A-13), plus an inactive Not accepted type.
const types = new Map<string, DefectTypeInfo>([
  ["cut", { id: "t-cut", isActive: true, outcome: "NOT_ACCEPTED" }],
  ["hole", { id: "t-hole", isActive: true, outcome: "NOT_ACCEPTED" }],
  ["crease", { id: "t-crease", isActive: true, outcome: "USABLE" }],
  ["scratch", { id: "t-scratch", isActive: true, outcome: "USABLE" }],
  ["dirt", { id: "t-dirt", isActive: false, outcome: "NOT_ACCEPTED" }], // turned off by an admin
]);
const rule = { foundAtOrAbove: 0.5 };
const verdictFor = (...dets: [string, number][]) =>
  decide(
    dets.map(([classKey, confidence]) => ({ classKey, confidence })),
    types,
    rule,
  ).verdict;

describe("decide: Pass or Reject (D-093)", () => {
  it("passes a section with no detections", () => {
    expect(decide([], types, rule)).toEqual({
      verdict: "PASS",
      maxConfidence: null,
      unknownKeys: [],
      ignoredKeys: [],
    });
  });

  it.each([
    [0.4999, "PASS"],
    [0.5, "REJECT"],
    [0.97, "REJECT"],
  ])("a Not accepted cut at %f → %s", (confidence, verdict) => {
    expect(verdictFor(["cut", confidence])).toBe(verdict);
  });

  it("passes only Usable defects, however sure the camera is", () => {
    expect(verdictFor(["crease", 0.5])).toBe("PASS");
    expect(verdictFor(["scratch", 0.99], ["crease", 0.8])).toBe("PASS");
  });

  it("rejects Usable plus Not accepted", () => {
    expect(verdictFor(["scratch", 0.66], ["hole", 0.52])).toBe("REJECT");
  });

  it("doesn't count a Not accepted type below found-at", () => {
    expect(verdictFor(["scratch", 0.66], ["hole", 0.3])).toBe("PASS");
  });

  it("reports the highest confidence across several types", () => {
    const d = decide(
      [
        { classKey: "hole", confidence: 0.62 },
        { classKey: "cut", confidence: 0.93 },
        { classKey: "crease", confidence: 0.4 },
      ],
      types,
      rule,
    );
    expect(d).toMatchObject({ verdict: "REJECT", maxConfidence: 0.93 });
  });

  it("ignores an inactive Not accepted type", () => {
    expect(decide([{ classKey: "dirt", confidence: 0.99 }], types, rule)).toEqual({
      verdict: "PASS",
      maxConfidence: null,
      unknownKeys: [],
      ignoredKeys: ["dirt"],
    });
  });

  it("rejects an unknown class alone (A-12)", () => {
    expect(decide([{ classKey: "stain", confidence: 0.3 }], types, rule)).toEqual({
      verdict: "REJECT",
      maxConfidence: null,
      unknownKeys: ["stain"],
      ignoredKeys: [],
    });
  });

  it("rejects an unknown class beside a Usable one", () => {
    const d = decide(
      [
        { classKey: "crease", confidence: 0.8 },
        { classKey: "stain", confidence: 0.7 },
        { classKey: "stain", confidence: 0.6 },
      ],
      types,
      rule,
    );
    expect(d).toEqual({
      verdict: "REJECT",
      maxConfidence: 0.8,
      unknownKeys: ["stain"],
      ignoredKeys: [],
    });
  });

  it("follows an edited found-at value (it is data)", () => {
    expect(
      decide([{ classKey: "cut", confidence: 0.55 }], types, { foundAtOrAbove: 0.6 }).verdict,
    ).toBe("PASS");
  });
});

describe("detectionOutcome", () => {
  it("gives the type's outcome once found and nothing below", () => {
    expect(detectionOutcome(0.5, "USABLE", rule)).toBe("USABLE");
    expect(detectionOutcome(0.5, "NOT_ACCEPTED", rule)).toBe("NOT_ACCEPTED");
    expect(detectionOutcome(0.49, "NOT_ACCEPTED", rule)).toBeNull();
  });

  it("treats an unknown class as Not accepted at any confidence", () => {
    expect(detectionOutcome(0.1, null, rule)).toBe("NOT_ACCEPTED");
  });
});

describe("readSnapshot", () => {
  it("reads a new snapshot back", () => {
    expect(
      readSnapshot({ foundAtOrAbove: 0.6, outcomes: { cut: "NOT_ACCEPTED", crease: "USABLE" } }),
    ).toEqual({
      foundAtOrAbove: 0.6,
      outcomes: { cut: "NOT_ACCEPTED", crease: "USABLE" },
      earlierRule: false,
    });
  });

  it("marks an old snapshot (two thresholds and actions) as the earlier rule", () => {
    const s = readSnapshot({
      rejectAtOrAbove: 0.9,
      reworkAtOrAbove: 0.6,
      foundAtOrAbove: 0.5,
      actions: { cut: "REJECT" },
    });
    expect(s).toEqual({ foundAtOrAbove: 0.5, outcomes: {}, earlierRule: true });
  });

  it("uses 0.5 when an old snapshot has no found-at value", () => {
    expect(readSnapshot({ rejectAtOrAbove: 0.9, reworkAtOrAbove: 0.6 })).toMatchObject({
      foundAtOrAbove: 0.5,
      earlierRule: true,
    });
    expect(readSnapshot(null).earlierRule).toBe(true);
  });
});

describe("outcomeGroups", () => {
  it("groups class keys by outcome, sorted", () => {
    expect(outcomeGroups({ hole: "NOT_ACCEPTED", cut: "NOT_ACCEPTED", scratch: "USABLE" })).toEqual(
      { notAccepted: ["cut", "hole"], usable: ["scratch"] },
    );
  });
});
