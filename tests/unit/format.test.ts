import { describe, expect, it } from "vitest";
import { formatDuration, manilaToday, manilaYear } from "@/lib/format";

describe("formatDuration", () => {
  it.each([
    [30_000, "under 1m"],
    [35 * 60_000, "35m"],
    [3 * 3_600_000, "3h"],
    [3 * 3_600_000 + 12 * 60_000, "3h 12m"],
    [2 * 86_400_000 + 4 * 3_600_000, "2d 4h"],
    [86_400_000, "1d"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("Manila dates", () => {
  it("uses Manila's calendar day, not UTC's", () => {
    const lateUtc = new Date("2026-12-31T17:30:00.000Z"); // 1:30 AM on Jan 1 in Manila
    expect(manilaToday(lateUtc)).toBe("2027-01-01");
    expect(manilaYear(lateUtc)).toBe(2027);
  });
});

describe("startOfManilaDay", async () => {
  const { startOfManilaDay } = await import("@/server/services/scan-query.service");
  it("is 16:00 UTC of the previous day", () => {
    expect(startOfManilaDay(new Date("2026-10-02T03:00:00.000Z")).toISOString()).toBe(
      "2026-10-01T16:00:00.000Z",
    );
    expect(startOfManilaDay(new Date("2026-10-02T17:00:00.000Z")).toISOString()).toBe(
      "2026-10-02T16:00:00.000Z",
    );
  });
});
