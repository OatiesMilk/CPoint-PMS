import { describe, expect, it } from "vitest";
import {
  defectShareText,
  finishedLine,
  isReturnedToSupplier,
  returnMark,
  rollReportStatus,
} from "@/lib/roll-rules";
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

  it("tells the constructor the roll is off stock, and when it is Returned to supplier (D-116)", () => {
    const roll = { code: "LR-MLT-001", shots: 6, item: "Brown suede" };
    expect(
      finishedLine(roll, { sharePct: 12.4, limitPct: 10, marked: true, notMeasured: null }),
    ).toBe(
      "LR-MLT-001 is finished with 6 shots. It is taken off the Brown suede stock. 12.4% of it has defects, over the 10% limit, so it is marked Returned to supplier. Set it aside for the Floor Manager.",
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
    ).toMatch(/taken before the marker card/);
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

  it("takes a device's scale with a scan, 4 to 120 in, or none", () => {
    expect(ingestFieldsSchema.parse({ widthIn: "22.4" }).widthIn).toBe(22.4);
    expect(ingestFieldsSchema.parse({}).widthIn).toBeUndefined();
    expect(message(ingestFieldsSchema.safeParse({ widthIn: "2" }))).toMatch(/^widthIn must be/);
  });

  it("reads the marker card's corners on a Capture shot, and no widthIn (D-120, D-121)", () => {
    const captureId = "0199f0a1-7c2e-7a51-9d3f-2b8c4e6a1f00";
    const card = [
      [
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.4 },
        { x: 0.5, y: 0.5 },
        { x: 0.4, y: 0.5 },
      ],
    ];
    const parsed = captureFieldsSchema.parse({
      captureId,
      markerCorners: JSON.stringify(card),
      widthIn: "18.5",
    });
    expect(parsed.markerCorners).toEqual(card);
    expect(parsed).not.toHaveProperty("widthIn");
    // D-121: a later shot of a roll may leave the corners out; the service takes its scale.
    expect(captureFieldsSchema.parse({ captureId }).markerCorners).toBeUndefined();
    expect(
      message(captureFieldsSchema.safeParse({ captureId, markerCorners: '[[{"x":0.4}]]' })),
    ).toMatch(/^markerCorners must be a JSON array/);
    expect(
      message(captureFieldsSchema.safeParse({ captureId, markerCorners: "not json" })),
    ).toMatch(/^markerCorners must be a JSON array/);
  });

  it("has no To return filter any more (Phase 30E)", () => {
    expect(rollListQuerySchema.parse({ toReturn: "1" })).not.toHaveProperty("toReturn");
  });
});

describe("Reports → Rolls status (D-116)", () => {
  const roll = (
    status: Parameters<typeof rollReportStatus>[0]["status"],
    markedForReturn = false,
    returnDecision: "RETURNED" | "KEPT" | null = null,
  ) => ({ status, markedForReturn, returnDecision });

  it("reads Not yet scanned, Scanning passed or Returned to supplier", () => {
    expect(rollReportStatus(roll("IN_STOCK"))).toBe("NOT_SCANNED");
    expect(rollReportStatus(roll("FINISHED"))).toBe("PASSED");
    expect(rollReportStatus(roll("USED"))).toBe("PASSED");
    expect(rollReportStatus(roll("FINISHED", true))).toBe("RETURNED");
    expect(rollReportStatus(roll("RETURNED", true, "RETURNED"))).toBe("RETURNED");
  });

  it("keeps a Phase 30C Keep as passed, and has no report status while scanning or removed", () => {
    expect(rollReportStatus(roll("FINISHED", true, "KEPT"))).toBe("PASSED");
    expect(isReturnedToSupplier(roll("FINISHED", true, "KEPT"))).toBe(false);
    expect(rollReportStatus(roll("OPEN"))).toBeNull();
    expect(rollReportStatus(roll("CANCELLED", true))).toBeNull();
  });
});
