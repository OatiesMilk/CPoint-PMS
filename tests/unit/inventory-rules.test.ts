import { describe, expect, it } from "vitest";
import {
  formatDelta,
  formatQuantity,
  hasAtMostTwoDecimals,
  MOVEMENT_LABELS,
  nextItemCode,
  planStockLine,
  stockLevel,
} from "@/lib/inventory-rules";

const item = (quantityOnHand: number, isActive = true) => ({
  name: "Tacks",
  quantityOnHand,
  isActive,
  unit: "box",
});

describe("quantities", () => {
  it("formats with the unit, pluralising count units only", () => {
    expect(formatQuantity(3, "roll")).toBe("3 rolls");
    expect(formatQuantity(1, "roll")).toBe("1 roll");
    expect(formatQuantity(20, "box")).toBe("20 boxes");
    expect(formatQuantity(2.5, "kg")).toBe("2.5 kg");
    expect(formatQuantity(1200, "m")).toBe("1,200 m");
    expect(formatQuantity(2.1)).toBe("2.1");
  });

  it("formats signed changes with a true minus sign", () => {
    expect(formatDelta(3)).toBe("+3");
    expect(formatDelta(-1.5)).toBe("−1.5");
    expect(formatDelta(0)).toBe("0");
  });

  it("allows at most two decimals", () => {
    expect(hasAtMostTwoDecimals(2.25)).toBe(true);
    expect(hasAtMostTwoDecimals(0.1 + 0.2)).toBe(true);
    expect(hasAtMostTwoDecimals(2.255)).toBe(false);
  });
});

describe("stockLevel", () => {
  it("is Out at zero, Low at or below the reorder level, otherwise OK", () => {
    expect(stockLevel(0, 2)).toBe("OUT");
    expect(stockLevel(0, 0)).toBe("OUT");
    expect(stockLevel(2, 2)).toBe("LOW");
    expect(stockLevel(1.5, 2)).toBe("LOW");
    expect(stockLevel(3, 2)).toBe("OK");
  });
});

describe("nextItemCode", () => {
  it("continues after the highest code for the prefix", () => {
    expect(nextItemCode("LR", [])).toBe("LR-001");
    expect(nextItemCode("LR", ["LR-001", "LR-007", "NL-020", "LR-custom"])).toBe("LR-008");
    expect(nextItemCode("LR", ["LR-999"])).toBe("LR-1000");
  });
});

describe("planStockLine (Phase 29, D-102)", () => {
  it("turns added, used and a correction into IN, OUT and ADJUST, in that order", () => {
    expect(
      planStockLine(item(4), {
        seenQuantity: 4,
        added: 6,
        used: 3,
        correction: -1,
        reason: " Recounted the shelf ",
      }),
    ).toEqual({
      ok: true,
      after: 6,
      entries: [
        { type: "IN", delta: 6, reason: "Added on a stock update" },
        { type: "OUT", delta: -3, reason: "Used on the line" },
        { type: "ADJUST", delta: -1, reason: "Recounted the shelf" },
      ],
    });
  });

  it("keeps hundredths exact", () => {
    const plan = planStockLine(item(0.3), { seenQuantity: 0.3, used: 0.1 });
    expect(plan).toMatchObject({ ok: true, after: 0.2 });
  });

  it("refuses using more than is on the shelf, counting what was added", () => {
    expect(planStockLine(item(1), { seenQuantity: 1, added: 2, used: 4 })).toEqual({
      ok: false,
      field: "used",
      reason: "Only 3 boxes of Tacks in stock. Enter a smaller amount.",
    });
  });

  it("refuses a correction below zero", () => {
    expect(
      planStockLine(item(2), { seenQuantity: 2, correction: -3, reason: "Recount" }),
    ).toMatchObject({
      ok: false,
      field: "correction",
    });
  });

  it("needs a reason for a correction, and nothing else", () => {
    expect(planStockLine(item(2), { seenQuantity: 2, correction: 1 })).toEqual({
      ok: false,
      field: "reason",
      reason: "Enter a reason for the Tacks correction, like “Recounted the shelf.”",
    });
    expect(planStockLine(item(2), { seenQuantity: 2, added: 1 })).toMatchObject({ ok: true });
  });

  it("needs at least one number", () => {
    expect(planStockLine(item(2), { seenQuantity: 2, added: 0 })).toMatchObject({
      ok: false,
      field: "added",
    });
  });

  it("is STALE, naming the item, when stock moved since the sheet loaded", () => {
    expect(planStockLine(item(5), { seenQuantity: 4, added: 1 })).toEqual({
      ok: false,
      code: "STALE",
      reason: "Tacks changed while you were updating (now 5 boxes). Check it and save again.",
    });
  });

  it("refuses a deactivated item", () => {
    expect(planStockLine(item(2, false), { seenQuantity: 2, added: 1 }).ok).toBe(false);
  });

  it("labels the ledger types Added, Used and Correction", () => {
    expect(MOVEMENT_LABELS).toEqual({ IN: "Added", OUT: "Used", ADJUST: "Correction" });
  });
});
