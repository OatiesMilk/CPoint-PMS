import { describe, expect, it } from "vitest";
import {
  formatDelta,
  formatQuantity,
  hasAtMostTwoDecimals,
  nextItemCode,
  planMovement,
  reversalOf,
  stockLevel,
} from "@/lib/inventory-rules";

const item = (quantityOnHand: number, isActive = true) => ({
  quantityOnHand,
  isActive,
  unit: "roll",
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

describe("planMovement", () => {
  it("stores receipts as + and usage as −, with default notes", () => {
    expect(planMovement(item(2), { type: "IN", quantity: 3 })).toEqual({
      ok: true,
      delta: 3,
      reason: "Delivery received",
    });
    expect(
      planMovement(item(2), { type: "OUT", quantity: 2, reason: " For B-2026-0001 " }),
    ).toEqual({
      ok: true,
      delta: -2,
      reason: "For B-2026-0001",
    });
  });

  it("refuses using more than is in stock", () => {
    expect(planMovement(item(2), { type: "OUT", quantity: 3 })).toEqual({
      ok: false,
      reason: "Only 2 rolls in stock. Record a delivery first, or use less.",
    });
  });

  it("turns a stock count into the difference, and needs a reason", () => {
    expect(
      planMovement(item(5), { type: "ADJUST", counted: 4.5, expectedQuantity: 5, reason: "Count" }),
    ).toEqual({ ok: true, delta: -0.5, reason: "Count" });
    expect(
      planMovement(item(5), { type: "ADJUST", counted: 4, expectedQuantity: 5 }),
    ).toMatchObject({
      ok: false,
      reason: "Say why the count differs.",
    });
    expect(
      planMovement(item(5), { type: "ADJUST", counted: 5, expectedQuantity: 5, reason: "x" }),
    ).toMatchObject({ ok: false });
  });

  it("marks a count STALE when stock moved while counting", () => {
    expect(
      planMovement(item(6), { type: "ADJUST", counted: 4, expectedQuantity: 5, reason: "x" }),
    ).toMatchObject({ ok: false, code: "STALE" });
  });

  it("refuses any movement on a deactivated item", () => {
    expect(planMovement(item(5, false), { type: "IN", quantity: 1 })).toMatchObject({ ok: false });
  });
});

describe("reversalOf", () => {
  it("undoes receipts and usage, but not stock counts", () => {
    expect(reversalOf({ type: "IN", quantityDelta: 3 })).toEqual({ type: "OUT", quantity: 3 });
    expect(reversalOf({ type: "OUT", quantityDelta: -2 })).toEqual({ type: "IN", quantity: 2 });
    expect(reversalOf({ type: "ADJUST", quantityDelta: -1 })).toBeNull();
  });
});
