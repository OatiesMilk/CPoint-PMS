import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  clampPage,
  pageCountFor,
  pageOf,
  pageWindow,
  shownRange,
} from "@/lib/pagination";

describe("pagination (D-047)", () => {
  it("uses 15 rows per page", () => {
    expect(PAGE_SIZE).toBe(15);
  });

  it("counts pages, with at least one", () => {
    expect(pageCountFor(0)).toBe(1);
    expect(pageCountFor(15)).toBe(1);
    expect(pageCountFor(16)).toBe(2);
    expect(pageCountFor(42)).toBe(3);
  });

  it("keeps a page inside the list", () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(Number.NaN, 3)).toBe(1);
    expect(clampPage(2, 3)).toBe(2);
    expect(clampPage(9, 3)).toBe(3);
  });

  it("windows a page for the database", () => {
    expect(pageWindow(1)).toEqual({ skip: 0, take: 15 });
    expect(pageWindow(3)).toEqual({ skip: 30, take: 15 });
  });

  it("says which rows a page shows", () => {
    expect(shownRange(1, 0)).toEqual({ from: 0, to: 0 });
    expect(shownRange(1, 8)).toEqual({ from: 1, to: 8 });
    expect(shownRange(2, 42)).toEqual({ from: 16, to: 30 });
    expect(shownRange(3, 42)).toEqual({ from: 31, to: 42 });
  });

  it("cuts an in-memory list", () => {
    const rows = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(pageOf(rows, 1)).toHaveLength(15);
    expect(pageOf(rows, 2)).toEqual([16, 17, 18, 19, 20]);
  });
});
