import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ingestFieldsSchema, MAX_DETECTIONS } from "@/server/validators/scan.validator";

// Written by the camera station's own test (cv/tests/test_contract_fixture.py) from its mapper and
// payload builder. If the station's output or this contract changes, one side breaks.
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/cv-payload.json", import.meta.url)), "utf8"),
) as { fields: Record<string, string> };

describe("camera station contract (cv-payload.json)", () => {
  it("is accepted by POST /api/v1/scans's field validator", () => {
    const parsed = ingestFieldsSchema.safeParse(fixture.fields);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("keeps every detection, its class key and its box", () => {
    const parsed = ingestFieldsSchema.parse(fixture.fields);
    const sent = JSON.parse(fixture.fields.detections) as unknown[];
    expect(parsed.detections).toHaveLength(sent.length);
    expect(parsed.detections.length).toBeLessThanOrEqual(MAX_DETECTIONS);
    expect(parsed.detections.map((d) => d.classKey)).toEqual(["hole", "cut", "crease", "scratch"]);
    expect(parsed.detections).toEqual(sent);
    expect(parsed.modelVersion).toBe("yolo-v1-1d729fb0");
    expect(parsed.source).toBe("WEBCAM");
    expect(parsed.capturedAt?.toISOString()).toBe("2026-10-01T01:30:00.000Z");
    expect(parsed.captureId).toBe("0199f0a1-7c2e-4a51-9d3f-2b8c4e6a1f00");
    expect(parsed.batchId).toBe("0199e2b4-1f00-7c3a-8d21-5e6f7a8b9c0d");
  });
});
