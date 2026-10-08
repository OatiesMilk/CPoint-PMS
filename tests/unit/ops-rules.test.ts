import { describe, expect, it } from "vitest";
import {
  buildAttention,
  compare,
  daysOfCover,
  describeChange,
  findStuckBatches,
  paretoShares,
  stageShares,
  type AttentionInput,
  type OpenBatch,
} from "@/lib/ops-rules";
import { parseRange, previousRange } from "@/lib/report-rules";

const H = 3_600_000;
const batch = (code: string, stage: OpenBatch["stage"], hours: number): OpenBatch => ({
  id: code,
  code,
  shoeType: "School Shoe",
  stage,
  inStageMs: hours * H,
  openRepairs: 0,
});

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

describe("findStuckBatches", () => {
  const stages = [
    { stage: "UPPER_MAKING" as const, visits: 5, medianMs: 4 * H },
    { stage: "SOLEING" as const, visits: 2, medianMs: 1 * H }, // too few visits to trust
  ];

  it("flags batches past 1.5x the stage median, longest first", () => {
    const stuck = findStuckBatches(
      [batch("A", "UPPER_MAKING", 5), batch("B", "UPPER_MAKING", 7), batch("C", "UPPER_MAKING", 6)],
      stages,
    );
    expect(stuck.map((b) => b.code)).toEqual(["B"]);
  });

  it("ignores stages without enough visits and very short waits", () => {
    expect(findStuckBatches([batch("D", "SOLEING", 50)], stages)).toEqual([]);
    expect(
      findStuckBatches(
        [batch("E", "UPPER_MAKING", 0.5)],
        [{ stage: "UPPER_MAKING", visits: 9, medianMs: 0.1 * H }],
      ),
    ).toEqual([]);
  });
});

describe("stageShares", () => {
  it("splits the line's time by stage median", () => {
    const shares = stageShares([
      { stage: "PREPARATION", medianMs: 1 * H },
      { stage: "UPPER_MAKING", medianMs: 3 * H },
      { stage: "SOLEING", medianMs: null },
    ]);
    expect(shares.get("UPPER_MAKING")).toBe(0.75);
    expect(shares.get("SOLEING")).toBeNull();
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
    const rows = paretoShares([{ scans: 2 }, { scans: 6 }, { scans: 2 }]);
    expect(rows.map((r) => r.scans)).toEqual([6, 2, 2]);
    expect(rows[0]).toMatchObject({ share: 0.6, cumulative: 0.6 });
    expect(rows[2].cumulative).toBe(1);
  });
  it("copes with nothing", () => {
    expect(paretoShares([])).toEqual([]);
  });
});

describe("buildAttention", () => {
  const quiet: AttentionInput = {
    stages: [],
    bottleneck: null,
    stuck: [],
    repairs: { waitingOverDay: 0, open: 0, oldestWaitingMs: null },
    stock: { out: 0, low: 0, shortCover: [] },
    requests: { urgentPending: 0, pending: 0, oldestPendingMs: null, lateAwaitingDelivery: 0 },
    suppliers: [],
    lineProblemShare: null,
    flaggedScans: 0,
  };

  it("is empty when nothing is wrong", () => {
    expect(buildAttention(quiet)).toEqual([]);
  });

  it("orders by severity and names what is wrong", () => {
    const items = buildAttention({
      ...quiet,
      stages: [
        { stage: "UPPER_MAKING", visits: 5, medianMs: 4 * H, inStageNow: 2, longestWaitMs: 9 * H },
      ],
      bottleneck: "UPPER_MAKING",
      stuck: [batch("B-1", "UPPER_MAKING", 9)],
      stock: { out: 1, low: 2, shortCover: [{ item: "Thread", days: 1.2 }] },
      flaggedScans: 3,
    });
    expect(items.map((i) => i.id)).toEqual([
      "stock-out",
      "stock-low",
      "stock-cover",
      "bottleneck",
      "stuck",
      "flagged",
    ]);
    expect(items[0].severity).toBe("critical");
    expect(items.find((i) => i.id === "bottleneck")?.title).toBe("Upper Making is the bottleneck");
    expect(items.find((i) => i.id === "stuck")?.detail).toContain("B-1");
  });

  it("flags a supplier only with enough sections and a clear gap", () => {
    const base = { ...quiet, lineProblemShare: 0.2 };
    const flagged = buildAttention({
      ...base,
      suppliers: [
        { supplier: "Tannery A", sections: 60, problemShare: 0.4 },
        { supplier: "Tannery B", sections: 10, problemShare: 0.9 }, // too few sections
        { supplier: "Tannery C", sections: 80, problemShare: 0.25 }, // not far enough above
      ],
    });
    expect(flagged).toHaveLength(1);
    expect(flagged[0].title).toContain("Tannery A");
  });

  it("prefers the urgent-request message over the age message", () => {
    const items = buildAttention({
      ...quiet,
      requests: { urgentPending: 1, pending: 3, oldestPendingMs: 100 * H, lateAwaitingDelivery: 1 },
    });
    expect(items.map((i) => i.id)).toEqual(["requests-urgent", "requests-late"]);
  });
});
