import { describe, expect, it } from "vitest";
import {
  buildAttention,
  compare,
  daysOfCover,
  describeChange,
  paretoShares,
  type AttentionInput,
} from "@/lib/ops-rules";
import { parseRange, previousRange } from "@/lib/report-rules";

describe("compare / describeChange", () => {
  it("computes the change and says it in words", () => {
    expect(compare(12, 10).change).toBeCloseTo(0.2);
    expect(describeChange(0.2)).toBe("up 20%");
    expect(describeChange(-0.049)).toBe("down 5%");
    expect(describeChange(0.001)).toBe("no change");
  });

  it("has no percentage without a usable baseline", () => {
    expect(compare(5, 0).change).toBeNull();
    expect(compare(null, 4).change).toBeNull();
    expect(compare(5, null).change).toBeNull();
    expect(describeChange(null)).toBe("no earlier data");
  });
});

describe("previousRange", () => {
  it("is the same length, ending the day before", () => {
    const now = new Date("2026-10-08T04:00:00.000Z");
    const prev = previousRange(parseRange({ preset: "7d" }, now), now);
    expect(prev).toMatchObject({ from: "2026-09-25", to: "2026-10-01", days: 7 });
  });
});

describe("daysOfCover", () => {
  it("projects the pace of use over the range", () => {
    expect(daysOfCover(10, 20, 10)).toBe(5); // 2 a day
  });
  it("is null when nothing was used, and never negative", () => {
    expect(daysOfCover(10, 0, 7)).toBeNull();
    expect(daysOfCover(-3, 7, 7)).toBe(0);
  });
});

describe("paretoShares", () => {
  it("sorts biggest first with a running share that ends at 100%", () => {
    const rows = paretoShares([{ rolls: 2 }, { rolls: 6 }, { rolls: 2 }]);
    expect(rows.map((r) => r.rolls)).toEqual([6, 2, 2]);
    expect(rows[0]).toMatchObject({ share: 0.6, cumulative: 0.6 });
    expect(rows[2].cumulative).toBe(1);
  });
  it("copes with nothing", () => {
    expect(paretoShares([])).toEqual([]);
  });
});

describe("buildAttention", () => {
  const quiet: AttentionInput = {
    belowQuota: null,
    stock: { out: 0, low: 0, shortCover: [] },
    suppliers: [],
    lineReturnedShare: null,
  };

  it("is empty when nothing is wrong", () => {
    expect(buildAttention(quiet)).toEqual([]);
  });

  it("orders by severity and names what is wrong", () => {
    const items = buildAttention({
      ...quiet,
      belowQuota: { below: 3, of: 5 },
      stock: { out: 1, low: 2, shortCover: [{ item: "Thread", days: 1.2 }] },
    });
    expect(items.map((i) => i.id)).toEqual([
      "stock-out",
      "stock-low",
      "stock-cover",
      "below-quota",
    ]);
    expect(items[0].severity).toBe("critical");
    expect(items.find((i) => i.id === "below-quota")).toMatchObject({
      title: "3 of the last 5 working days were below quota",
      href: "/batches",
    });
  });

  it("flags a supplier only with enough rolls and a clear gap (D-117)", () => {
    const base = { ...quiet, lineReturnedShare: 0.2 };
    const flagged = buildAttention({
      ...base,
      suppliers: [
        { supplier: "Tannery A", rolls: 6, returnedShare: 0.5 },
        { supplier: "Tannery B", rolls: 2, returnedShare: 1 }, // too few rolls
        { supplier: "Tannery C", rolls: 8, returnedShare: 0.25 }, // not far enough above
      ],
    });
    expect(flagged).toHaveLength(1);
    expect(flagged[0].title).toContain("Tannery A");
    expect(flagged[0].detail).toBe(
      "50% of its rolls were returned to supplier, against 20% overall.",
    );
  });

  it("asks for a restock on low stock and links every item to a screen that exists (D-091)", () => {
    const items = buildAttention({
      ...quiet,
      belowQuota: { below: 3, of: 5 },
      stock: { out: 1, low: 2, shortCover: [{ item: "Thread", days: 1.2 }] },
      suppliers: [{ supplier: "Tannery A", rolls: 6, returnedShare: 0.5 }],
      lineReturnedShare: 0.2,
    });
    expect(items).toHaveLength(5);
    expect(items.find((i) => i.id === "stock-low")?.detail).toBe(
      "Restock them before they run out.",
    );
    const screens = ["/inventory", "/batches", "/reports"];
    for (const item of items) expect(screens).toContain(item.href.split(/[?#]/)[0]);
  });
});

describe("supplierIsHigh (Phase 20, on rolls since D-117)", () => {
  it("needs at least 5 rolls and a clear gap above the line", async () => {
    const { supplierIsHigh } = await import("@/lib/ops-rules");
    expect(supplierIsHigh({ rolls: 5, returnedShare: 0.4 }, 0.2)).toBe(true);
    expect(supplierIsHigh({ rolls: 4, returnedShare: 0.9 }, 0.2)).toBe(false);
    expect(supplierIsHigh({ rolls: 8, returnedShare: 0.25 }, 0.2)).toBe(false);
    expect(supplierIsHigh({ rolls: 8, returnedShare: null }, 0.2)).toBe(false);
    expect(supplierIsHigh({ rolls: 8, returnedShare: 0.9 }, null)).toBe(false);
  });
});
