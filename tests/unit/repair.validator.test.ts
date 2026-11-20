import { describe, expect, it } from "vitest";
import {
  repairActionSchema,
  repairInspectSchema,
  stageAssignmentsSchema,
  stageCountSchema,
} from "@/server/validators/repair.validator";
import { checkInSchema, correctionSchema } from "@/server/validators/production.validator";
import {
  finalDefectTypeCreateSchema,
  finalDefectTypeUpdateSchema,
} from "@/server/validators/settings.validator";

// The Phase 34 request bodies (D-130): each message names the field and the fix.

const ID = "0192f1c8-7b1e-7a4a-9b0a-1f2d3c4b5a69";

describe("repairActionSchema", () => {
  it("takes back, move and notFixable", () => {
    expect(repairActionSchema.parse({ action: "back" })).toEqual({ action: "back" });
    expect(
      repairActionSchema.parse({ action: "move", stage: "FINISHING", reason: " Needs a press " }),
    ).toEqual({
      action: "move",
      stage: "FINISHING",
      reason: "Needs a press",
    });
    expect(repairActionSchema.parse({ action: "notFixable", reason: "Sole is torn" }).action).toBe(
      "notFixable",
    );
  });

  it("needs a reason of 5 characters and a real stage", () => {
    const r = repairActionSchema.safeParse({ action: "notFixable", reason: "no" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe("Say why, at least 5 characters.");
    const s = repairActionSchema.safeParse({
      action: "move",
      stage: "UPPER_MAKING",
      reason: "Needs a press",
    });
    expect(!s.success && s.error.issues[0].message).toBe(
      "Choose a stage: Preparation, Construction, Sole-ing or Finishing.",
    );
    expect(repairActionSchema.safeParse({ action: "scrap" }).success).toBe(false);
  });
});

describe("repairInspectSchema, stageCountSchema", () => {
  it("lets the service check the numbers against the job", () => {
    expect(
      repairInspectSchema.parse({ passedPairs: "3", resend: [{ stage: "SOLE_ING", pairs: 2 }] }),
    ).toMatchObject({
      passedPairs: "3",
    });
    expect(stageCountSchema.parse({ stage: "SOLE_ING", pairs: "12" })).toEqual({
      stage: "SOLE_ING",
      pairs: "12",
    });
    expect(stageCountSchema.safeParse({ stage: "ASSEMBLY", pairs: 1 }).success).toBe(false);
  });
});

describe("stageAssignmentsSchema", () => {
  it("takes the constructors of each stage", () => {
    expect(
      stageAssignmentsSchema.parse({ assignments: [{ stage: "SOLE_ING", userIds: [ID] }] })
        .assignments,
    ).toHaveLength(1);
    expect(
      stageAssignmentsSchema.safeParse({ assignments: [{ stage: "SOLE_ING", userIds: ["x"] }] })
        .success,
    ).toBe(false);
    expect(
      stageAssignmentsSchema.safeParse({
        assignments: Array.from({ length: 5 }, () => ({ stage: "SOLE_ING", userIds: [] })),
      }).success,
    ).toBe(false);
  });
});

describe("findings in the finish and correction bodies", () => {
  it("pass through for the service to check against the failed pairs", () => {
    const findings = [
      { finalDefectTypeId: ID, pairs: 2, remedy: "FIXABLE", returnStage: "SOLE_ING" },
    ];
    expect(
      checkInSchema.parse({ batchId: ID, pairs: 10, failedPairs: 2, findings }).findings,
    ).toEqual(findings);
    expect(
      checkInSchema.parse({ batchId: ID, pairs: 10, failedPairs: 0 }).findings,
    ).toBeUndefined();
    expect(
      correctionSchema.parse({
        expectedUpdatedAt: "2026-11-20T05:00:00.000Z",
        pairs: 10,
        failedPairs: 2,
        findings,
        reason: "Counted twice",
      }).findings,
    ).toEqual(findings);
    expect(checkInSchema.safeParse({ batchId: ID, findings: "x" }).success).toBe(false);
  });
});

describe("final defect types (Settings)", () => {
  it("makes the key capital letters and keeps it fixed on edit", () => {
    expect(
      finalDefectTypeCreateSchema.parse({ key: " lifted_sole ", label: "Lifted sole" }).key,
    ).toBe("LIFTED_SOLE");
    const bad = finalDefectTypeCreateSchema.safeParse({ key: "lifted sole", label: "Lifted sole" });
    expect(!bad.success && bad.error.issues[0].message).toBe(
      "Enter a key of up to 40 capital letters, numbers or _, e.g. LIFTED_SOLE.",
    );
    expect(finalDefectTypeUpdateSchema.parse({ label: "Lifted sole" })).not.toHaveProperty("key");
    const noLabel = finalDefectTypeUpdateSchema.safeParse({ label: " " });
    expect(!noLabel.success && noLabel.error.issues[0].message).toBe(
      "Enter a label people will read, e.g. Lifted sole.",
    );
  });
});
