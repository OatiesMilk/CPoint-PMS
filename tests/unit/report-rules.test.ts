import { describe, expect, it } from "vitest";
import {
  agreementRate,
  csvCell,
  fillDays,
  parseRange,
  pickBottleneck,
  toCsv,
} from "@/lib/report-rules";

// 2026-10-03 01:00 in Manila is still 2026-10-02 in UTC.
const now = new Date("2026-10-02T17:00:00.000Z");

describe("parseRange", () => {
  it("defaults to the last 14 Manila days including today", () => {
    const r = parseRange({}, now);
    expect(r).toMatchObject({ from: "2026-09-20", to: "2026-10-03", days: 14, preset: "14d" });
    expect(r.start.toISOString()).toBe("2026-09-19T16:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-03T16:00:00.000Z");
  });

  it("uses presets, and Today is one Manila day", () => {
    expect(parseRange({ preset: "today" }, now)).toMatchObject({
      from: "2026-10-03",
      to: "2026-10-03",
      days: 1,
      preset: "today",
    });
  });

  it("swaps a reversed range, never goes past today, and clamps to 92 days", () => {
    expect(parseRange({ from: "2026-10-01", to: "2026-09-25" }, now)).toMatchObject({
      from: "2026-09-25",
      to: "2026-10-01",
      preset: null,
    });
    expect(parseRange({ from: "2026-10-01", to: "2027-01-01" }, now).to).toBe("2026-10-03");
    const long = parseRange({ from: "2025-01-01", to: "2026-10-03" }, now);
    expect(long.days).toBe(92);
    expect(long.from).toBe("2026-07-04");
  });
});

describe("fillDays", () => {
  it("fills missing days with empty rows, oldest first", () => {
    const rows = fillDays(
      [{ day: "2026-10-02", n: 5 }],
      { from: "2026-10-01", to: "2026-10-03" },
      (day) => ({
        day,
        n: 0,
      }),
    );
    expect(rows).toEqual([
      { day: "2026-10-01", n: 0 },
      { day: "2026-10-02", n: 5 },
      { day: "2026-10-03", n: 0 },
    ]);
  });
});

describe("agreementRate", () => {
  it("is the share kept, or null when the AI decided nothing", () => {
    expect(agreementRate({ agreed: 9, aiDecided: 10 })).toBe(0.9);
    expect(agreementRate({ agreed: 0, aiDecided: 0 })).toBeNull();
  });
});

describe("pickBottleneck", () => {
  it("picks the highest median, ignores stages without data, and keeps line order on ties", () => {
    expect(
      pickBottleneck([
        { stage: "PREPARATION", medianMs: 10, visits: 2 },
        { stage: "UPPER_MAKING", medianMs: 50, visits: 3 },
        { stage: "SOLEING", medianMs: 50, visits: 1 },
        { stage: "FINISHING", medianMs: null, visits: 0 },
      ]),
    ).toBe("UPPER_MAKING");
    expect(pickBottleneck([{ stage: "SOLEING", medianMs: null, visits: 0 }])).toBeNull();
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and newlines, and neutralises formulas in text", () => {
    expect(csvCell('Roll "A", left')).toBe('"Roll ""A"", left"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell(-1)).toBe("-1");
    expect(csvCell(null)).toBe("");
  });

  it("starts with a BOM and uses CRLF", () => {
    const csv = toCsv(
      [{ a: 1, b: "x" }],
      [
        { header: "A", value: (r) => r.a },
        { header: "B", value: (r) => r.b },
      ],
    );
    expect(csv).toBe("﻿A,B\r\n1,x\r\n");
  });
});
