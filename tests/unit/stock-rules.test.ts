import { describe, expect, it } from "vitest";
import {
  daysLeft,
  daysToNextReminder,
  describeReminderDays,
  mayRunOut,
  stockUpdateDue,
  weekChange,
} from "@/lib/stock-rules";

// 2026-10-28 is a Wednesday, 2026-10-30 a Friday, 2026-11-01 a Sunday.

describe("the reminder (C-32)", () => {
  it("is due on a reminder day until an update is saved", () => {
    expect(stockUpdateDue("2026-10-28", [3, 5], false)).toBe(true);
    expect(stockUpdateDue("2026-10-28", [3, 5], true)).toBe(false);
    expect(stockUpdateDue("2026-10-29", [3, 5], false)).toBe(false);
    expect(stockUpdateDue("2026-10-30", [3, 5], false)).toBe(true);
  });

  it("counts the days to the next reminder day after today", () => {
    expect(daysToNextReminder("2026-10-28", [3, 5])).toBe(2);
    expect(daysToNextReminder("2026-10-30", [3, 5])).toBe(5);
    expect(daysToNextReminder("2026-10-28", [3])).toBe(7);
    expect(daysToNextReminder("2026-10-28", [])).toBeNull();
  });

  it("names the days in plain words", () => {
    expect(describeReminderDays([5, 3])).toBe("Wednesday and Friday");
    expect(describeReminderDays([1, 3, 5])).toBe("Monday, Wednesday and Friday");
    expect(describeReminderDays([])).toBe("no day");
  });
});

describe("consumption", () => {
  it("compares this week with last week", () => {
    expect(weekChange(12, 10)).toEqual({ diff: 2, change: 0.2 });
    expect(weekChange(3, 0)).toEqual({ diff: 3, change: null });
  });

  it("works out the days left at the last 4 weeks' pace", () => {
    expect(daysLeft(10, 28)).toBe(10);
    expect(daysLeft(-2, 28)).toBe(0);
    expect(daysLeft(10, 0)).toBeNull();
  });

  it("warns only when the stock lasts fewer days than to the next update", () => {
    expect(mayRunOut(1.5, 2)).toBe(true);
    expect(mayRunOut(2, 2)).toBe(false);
    expect(mayRunOut(null, 2)).toBe(false);
    expect(mayRunOut(1, null)).toBe(false);
  });
});
