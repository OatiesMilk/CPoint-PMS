import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/server/services/demo-seed.service";
import { MODEL_CLASSES, scenario } from "@/server/lib/leather-scan";

describe("scenario (simulator and demo week)", () => {
  const draw = (n: number, classes = MODEL_CLASSES) => {
    const random = mulberry32(7);
    return Array.from({ length: n }, () => scenario(random, classes));
  };

  it("uses only the given classes, never one without a defect type (D-108)", () => {
    const keys = new Set(draw(400).flatMap((d) => d.map((x) => x.classKey)));
    expect([...keys].sort()).toEqual(["crease", "cut", "hole", "scratch"]);
  });

  it("draws strong marks from Not accepted types and middling ones from Usable types", () => {
    const rejectKeys = new Set(["cut", "hole"]);
    for (const d of draw(400)) {
      const top = d[0];
      if (!top) continue;
      if (top.confidence >= 0.9) expect(rejectKeys.has(top.classKey)).toBe(true);
      else if (top.confidence >= 0.6) expect(rejectKeys.has(top.classKey)).toBe(false);
      else expect(top.confidence).toBeLessThan(0.5); // below "found at" too
    }
  });

  it("falls back to every class when none fits an outcome, and needs at least one", () => {
    expect(draw(50, [{ key: "cut", outcome: "NOT_ACCEPTED" }]).flat().length).toBeGreaterThan(0);
    expect(() => scenario(Math.random, [])).toThrow(/at least one/);
  });
});
