import { describe, expect, it } from "vitest";
import {
  compareLabel,
  csvCell,
  fillDays,
  parseRange,
  previousRange,
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

  it("swaps a reversed range, never goes past today, and clamps to 366 days", () => {
    expect(parseRange({ from: "2026-10-01", to: "2026-09-25" }, now)).toMatchObject({
      from: "2026-09-25",
      to: "2026-10-01",
      preset: null,
    });
    expect(parseRange({ from: "2026-10-01", to: "2027-01-01" }, now).to).toBe("2026-10-03");
    const long = parseRange({ from: "2024-01-01", to: "2026-10-03" }, now);
    expect(long.days).toBe(366);
    expect(long.from).toBe("2025-10-03");
    // A year is allowed whole (A-68).
    expect(parseRange({ from: "2025-10-03", to: "2026-10-03" }, now).days).toBe(366);
  });
});

describe("parseRange: Day, Week, Month (Phase 35)", () => {
  it("a day is one Manila day, never past today", () => {
    expect(parseRange({ period: "day", day: "2026-09-30" }, now)).toMatchObject({
      from: "2026-09-30",
      to: "2026-09-30",
      days: 1,
      mode: "day",
      preset: null,
    });
    expect(parseRange({ period: "day", day: "2026-12-25" }, now).from).toBe("2026-10-03");
    expect(parseRange({ period: "day" }, now).from).toBe("2026-10-03");
    // "2026-02-30" has the shape of a day but is not one: today, not a crash.
    expect(parseRange({ period: "day", day: "2026-02-30" }, now).from).toBe("2026-10-03");
    expect(parseRange({ from: "2026-02-30", to: "2026-02-31" }, now).to).toBe("2026-10-03");
  });

  it("a week is a week of the month, as Materials counts them (A-67)", () => {
    const w = parseRange({ period: "week", year: "2026", month: "9", week: "2" }, now);
    expect(w).toMatchObject({ from: "2026-09-08", to: "2026-09-14", days: 7, mode: "week" });
    expect(w.label).toBe("Week 2 · Sep 8–14, 2026");
    // The last week of a month may be short.
    expect(parseRange({ period: "week", year: "2026", month: "9", week: "5" }, now)).toMatchObject({
      from: "2026-09-29",
      to: "2026-09-30",
      days: 2,
    });
    // The week under way ends today.
    expect(parseRange({ period: "week", year: "2026", month: "10", week: "1" }, now)).toMatchObject(
      {
        from: "2026-10-01",
        to: "2026-10-03",
        days: 3,
      },
    );
    // A week that hasn't started, or nonsense, becomes today's week.
    expect(parseRange({ period: "week", year: "2026", month: "11", week: "1" }, now).from).toBe(
      "2026-10-01",
    );
    expect(parseRange({ period: "week", year: "abc" }, now).from).toBe("2026-10-01");
  });

  it("a month runs from the 1st to its last day, a leap February included", () => {
    expect(parseRange({ period: "month", year: "2026", month: "9" }, now)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
      days: 30,
      label: "September 2026",
      mode: "month",
    });
    const leap = parseRange(
      { period: "month", year: "2028", month: "2" },
      new Date("2028-03-05T04:00:00Z"),
    );
    expect(leap).toMatchObject({ from: "2028-02-01", to: "2028-02-29", days: 29 });
    // Across a year end.
    const dec = parseRange(
      { period: "month", year: "2026", month: "12" },
      new Date("2027-01-04T04:00:00Z"),
    );
    expect(dec).toMatchObject({ from: "2026-12-01", to: "2026-12-31", days: 31 });
    // The month under way ends today; a future or invalid month is this month.
    expect(parseRange({ period: "month", year: "2026", month: "10" }, now)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-03",
    });
    expect(parseRange({ period: "month", year: "2026", month: "12" }, now).from).toBe("2026-10-01");
    expect(parseRange({ period: "month", year: "2026", month: "13" }, now).from).toBe("2026-10-01");
  });

  it("keeps the old preset and from/to links working, with their own labels", () => {
    expect(parseRange({ preset: "7d" }, now)).toMatchObject({ mode: "preset", preset: "7d" });
    const custom = parseRange({ from: "2026-09-25", to: "2026-10-01" }, now);
    expect(custom).toMatchObject({ mode: "custom", preset: null });
    expect(custom.label).toBe("Sep 25 – Oct 1");
    expect(parseRange({ from: "2025-12-30", to: "2026-01-02" }, now).label).toBe(
      "Dec 30, 2025 – Jan 2, 2026",
    );
  });
});

describe("previousRange and compareLabel", () => {
  it("compares a month with the month before, not the same number of days", () => {
    const prev = previousRange(parseRange({ period: "month", year: "2026", month: "10" }, now));
    expect(prev).toMatchObject({ from: "2026-09-01", to: "2026-09-30", days: 30, mode: "month" });
    const jan = previousRange(
      parseRange({ period: "month", year: "2027", month: "1" }, new Date("2027-01-04T04:00:00Z")),
    );
    expect(jan).toMatchObject({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("compares a week with the week before, across a month", () => {
    const w2 = previousRange(
      parseRange({ period: "week", year: "2026", month: "9", week: "2" }, now),
    );
    expect(w2).toMatchObject({ from: "2026-09-01", to: "2026-09-07" });
    const w1 = previousRange(
      parseRange({ period: "week", year: "2026", month: "10", week: "1" }, now),
    );
    expect(w1).toMatchObject({ from: "2026-09-29", to: "2026-09-30", days: 2 });
  });

  it("a day, a preset or a custom range goes back by its own length", () => {
    expect(previousRange(parseRange({ period: "day", day: "2026-09-30" }, now))).toMatchObject({
      from: "2026-09-29",
      to: "2026-09-29",
    });
    expect(previousRange(parseRange({ preset: "7d" }, now))).toMatchObject({
      from: "2026-09-20",
      to: "2026-09-26",
    });
  });

  it("words the comparison for each period", () => {
    expect(compareLabel(parseRange({ preset: "today" }, now))).toBe("vs yesterday");
    expect(compareLabel(parseRange({ preset: "7d" }, now))).toBe("vs previous 7 days");
    expect(compareLabel(parseRange({ period: "day", day: "2026-09-30" }, now))).toBe(
      "vs the day before",
    );
    expect(compareLabel(parseRange({ period: "week" }, now))).toBe("vs previous week");
    expect(compareLabel(parseRange({ period: "month" }, now))).toBe("vs previous month");
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
