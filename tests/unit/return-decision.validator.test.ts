import { describe, expect, it } from "vitest";
import { defectShareText, finishedLine, returnMark } from "@/lib/roll-rules";
import { captureFieldsSchema, ingestFieldsSchema } from "@/server/validators/scan.validator";
import { defectTypeCreateSchema, thresholdsSchema } from "@/server/validators/settings.validator";
import { rollListQuerySchema } from "@/server/validators/roll.validator";

const message = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues[0]?.message;

describe("what the lists and Capture say (Phase 30C)", () => {
  it("shows the share, Not measured or a dash, and the mark", () => {
    const finishedAt = new Date();
    expect(defectShareText({ status: "FINISHED", defectSharePct: 12.44, finishedAt })).toBe(
      "12.4%",
    );
    expect(defectShareText({ status: "FINISHED", defectSharePct: null, finishedAt })).toBe(
      "Not measured",
    );
    expect(defectShareText({ status: "IN_STOCK", defectSharePct: null })).toBe("—");
    expect(returnMark({ markedForReturn: true, returnDecision: null })).toBe("to-return");
    expect(returnMark({ markedForReturn: true, returnDecision: "KEPT" })).toBe("kept");
    expect(returnMark({ markedForReturn: false, returnDecision: null })).toBeNull();
  });

  it("tells the constructor the roll is off stock, and when it has too many defects (Phase 30E)", () => {
    const roll = { code: "LR-MLT-001", shots: 6, item: "Brown suede" };
    expect(
      finishedLine(roll, { sharePct: 12.4, limitPct: 10, marked: true, notMeasured: null }),
    ).toBe(
      "LR-MLT-001 is finished with 6 shots. It is taken off the Brown suede stock. 12.4% of it has defects, which is too many. The Floor Manager will see it.",
    );
    expect(
      finishedLine(roll, { sharePct: 3.2, limitPct: 10, marked: false, notMeasured: null }),
    ).toBe(
      "LR-MLT-001 is finished with 6 shots. It is taken off the Brown suede stock. 3.2% of it has defects.",
    );
    expect(finishedLine({ code: "R-2026-0001", shots: 1 })).toBe(
      "R-2026-0001 is finished with 1 shot.",
    );
    expect(
      finishedLine(roll, { sharePct: null, limitPct: 10, marked: false, notMeasured: "unscaled" }),
    ).toMatch(/Set up this phone next time/);
  });
});

describe("the new settings and fields", () => {
  it("takes the supplier limit from 1 to 100 with one decimal", () => {
    expect(thresholdsSchema.parse({ foundPercent: 50, returnPercent: "12.5" })).toMatchObject({
      returnPercent: 12.5,
    });
    expect(thresholdsSchema.parse({ foundPercent: 50 }).returnPercent).toBeUndefined();
    for (const bad of ["0", "101", "10.25", "ten"])
      expect(message(thresholdsSchema.safeParse({ foundPercent: 50, returnPercent: bad }))).toMatch(
        /^Enter a percentage from 1 to 100/,
      );
  });

  it("takes a length limit and a flat share per defect type, blank as none", () => {
    const base = { key: "cut", label: "Cut", outcome: "NOT_ACCEPTED" };
    expect(
      defectTypeCreateSchema.parse({ ...base, notAcceptedFromIn: "3", flatSharePct: "1" }),
    ).toMatchObject({ notAcceptedFromIn: 3, flatSharePct: 1 });
    expect(
      defectTypeCreateSchema.parse({ ...base, notAcceptedFromIn: "", flatSharePct: "" }),
    ).toMatchObject({ notAcceptedFromIn: null, flatSharePct: null });
    expect(message(defectTypeCreateSchema.safeParse({ ...base, notAcceptedFromIn: "0" }))).toMatch(
      /^Enter the length in inches from 0.1 to 100/,
    );
    expect(message(defectTypeCreateSchema.safeParse({ ...base, flatSharePct: "abc" }))).toMatch(
      /^Enter the flat share as a percentage/,
    );
  });

  it("takes the phone's calibration with a scan, 4 to 120 in, or none", () => {
    expect(ingestFieldsSchema.parse({ widthIn: "22.4" }).widthIn).toBe(22.4);
    expect(ingestFieldsSchema.parse({}).widthIn).toBeUndefined();
    expect(
      captureFieldsSchema.parse({
        captureId: "0199f0a1-7c2e-7a51-9d3f-2b8c4e6a1f00",
        widthIn: "18.5",
      }).widthIn,
    ).toBe(18.5);
    expect(message(ingestFieldsSchema.safeParse({ widthIn: "2" }))).toMatch(/^widthIn must be/);
  });

  it("has no To return filter any more (Phase 30E)", () => {
    expect(rollListQuerySchema.parse({ toReturn: "1" })).not.toHaveProperty("toReturn");
  });
});
