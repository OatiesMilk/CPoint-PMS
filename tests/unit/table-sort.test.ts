import { describe, expect, it } from "vitest";
import { parseSort, sortFor, sortRows, sortText } from "@/lib/table-sort";
import { reportQuerySchema } from "@/server/validators/report.validator";

type Row = { name: string; n: number | null; day: string };
const rows: Row[] = [
  { name: "Roll 10", n: 5, day: "2026-10-02" },
  { name: "Roll 9", n: null, day: "2026-10-03" },
  { name: "roll 2", n: 5, day: "2026-10-01" },
  { name: "Roll 1", n: 20, day: "2026-10-04" },
];
const keys = { name: (r: Row) => r.name, n: (r: Row) => r.n, day: (r: Row) => r.day };
const names = (list: Row[]) => list.map((r) => r.name);

describe("parseSort", () => {
  it("reads table.column and a direction, and ignores anything else", () => {
    expect(parseSort("final-defects.pairs-found", "desc")).toEqual({
      table: "final-defects",
      column: "pairs-found",
      dir: "desc",
    });
    expect(parseSort("rolls.roll", undefined)?.dir).toBe("asc");
    expect(parseSort("rolls", "asc")).toBeNull();
    expect(parseSort("rolls.roll; drop", "asc")).toBeNull();
    expect(parseSort(undefined, "desc")).toBeNull();
  });
});

describe("sortRows", () => {
  it("sorts numbers as numbers, with empty values last in both directions", () => {
    expect(names(sortRows(rows, keys, "n", "asc"))).toEqual([
      "Roll 10",
      "roll 2",
      "Roll 1",
      "Roll 9",
    ]);
    expect(names(sortRows(rows, keys, "n", "desc"))).toEqual([
      "Roll 1",
      "Roll 10",
      "roll 2",
      "Roll 9",
    ]);
  });

  it("sorts text by the alphabet, numbers inside it in order, ignoring case", () => {
    expect(names(sortRows(rows, keys, "name", "asc"))).toEqual([
      "Roll 1",
      "roll 2",
      "Roll 9",
      "Roll 10",
    ]);
    expect(names(sortRows(rows, keys, "name", "desc"))).toEqual([
      "Roll 10",
      "Roll 9",
      "roll 2",
      "Roll 1",
    ]);
  });

  it("sorts days (YYYY-MM-DD) as text, and keeps equal rows in their order (stable)", () => {
    expect(sortRows(rows, keys, "day", "desc").map((r) => r.day)[0]).toBe("2026-10-04");
    // Roll 10 and roll 2 both have n = 5: they stay in the order they came.
    const tied = sortRows(rows, keys, "n", "asc");
    expect(tied.indexOf(rows[0])).toBeLessThan(tied.indexOf(rows[2]));
  });

  it("leaves the rows alone for an unknown column, and never changes the input", () => {
    const copy = [...rows];
    expect(names(sortRows(rows, keys, "toString", "asc"))).toEqual(names(rows));
    expect(names(sortRows(rows, keys, "nope", "asc"))).toEqual(names(rows));
    sortRows(rows, keys, "n", "desc");
    expect(rows).toEqual(copy);
  });
});

describe("sortFor", () => {
  it("sorts only the table the page's sort names", () => {
    const state = parseSort("stock.n", "desc");
    expect(names(sortFor(state, "stock", rows, keys))[0]).toBe("Roll 1");
    expect(names(sortFor(state, "daily", rows, keys))).toEqual(names(rows));
    expect(names(sortFor(null, "stock", rows, keys))).toEqual(names(rows));
  });

  it("words the sort for the printed header", () => {
    expect(sortText(null)).toBeNull();
    expect(sortText(parseSort("final-defects.pairs-found", "desc"))).toBe(
      "Sorted by pairs found in final defects, high to low, or Z to A",
    );
  });
});

describe("the report query", () => {
  it("drops an invalid filter or sort instead of failing the page", () => {
    const q = reportQuerySchema.parse({
      period: "decade",
      remedy: "MAYBE",
      stage: "PACKING",
      supplierId: "not-a-uuid",
      sort: "x;y",
      dir: "sideways",
      defect: "GLUE",
      week: ["1", "2"],
    });
    expect(q).toMatchObject({ defect: "GLUE" });
    for (const key of ["period", "remedy", "stage", "supplierId", "sort", "dir", "week"] as const)
      expect(q[key]).toBeUndefined();
  });

  it("keeps a valid period, filter and sort", () => {
    const q = reportQuerySchema.parse({
      period: "week",
      year: "2026",
      month: "11",
      week: "3",
      remedy: "FIXABLE",
      stage: "SOLE_ING",
      sort: "final-defects.pairs-found",
      dir: "desc",
    });
    expect(q).toMatchObject({
      period: "week",
      week: "3",
      remedy: "FIXABLE",
      stage: "SOLE_ING",
      dir: "desc",
    });
  });
});
