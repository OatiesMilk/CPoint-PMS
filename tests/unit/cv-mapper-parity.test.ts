import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classKeyFor,
  iou,
  mapDetections,
  toBox,
  type MapperConfig,
  type RawDetection,
} from "@/server/lib/cv/mapper";

// Written by the camera station's own test (cv/tests/test_mapper_parity_fixture.py) from
// mapper.py. The Capture page maps the model's output with mapper.ts; both must agree exactly.
const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/cv-mapper-parity.json", import.meta.url)),
    "utf8",
  ),
) as {
  names: Record<string, string>;
  raw: RawDetection[];
  cases: { name: string; config: MapperConfig; expected: unknown[] }[];
};

const names = Object.fromEntries(Object.entries(fixture.names).map(([k, v]) => [Number(k), v]));

describe("mapper.ts against mapper.py (cv-mapper-parity.json)", () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(mapDetections(fixture.raw, names, c.config)).toEqual(c.expected);
  });
});

describe("mapper pieces", () => {
  it("clips a box running off the image and drops one fully outside", () => {
    expect(toBox(0.95, 0.6, 0.2, 0.08)).toEqual({ x: 0.85, y: 0.56, width: 0.15, height: 0.08 });
    expect(toBox(-0.2, 0.5, 0.1, 0.1)).toBeNull();
  });

  it("names an unknown class index class_<n>, after the renames", () => {
    expect(classKeyFor(7, { 0: "crease" }, {})).toBe("class_7");
    expect(classKeyFor(0, { 0: "crease" }, { crease: "wrinkle" })).toBe("wrinkle");
  });

  it("measures overlap", () => {
    const a = { x: 0, y: 0, width: 0.5, height: 0.5 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 })).toBe(0);
  });
});
