import { describe, expect, it } from "vitest";
import {
  daysIn,
  daysInMonth,
  isAvailable,
  keepWeek,
  monthWeekOf,
  previousMonthWeek,
  resolveWeek,
  sumByWeek,
  weekRangeText,
  weeksEndingWith,
  workingDaysIn,
  workingDaysLabel,
  weeksOfMonth,
} from "@/lib/month-weeks";

// Weeks of a month from its 1st (D-109). Today: Monday 2 Nov 2026, Manila.
const today = "2026-11-02";

describe("weeksOfMonth", () => {
  it("runs seven days from the 1st, the last week shorter", () => {
    const nov = weeksOfMonth(2026, 11);
    expect(nov.map((w) => w.label)).toEqual([
      "Week 1 · Nov 1–7",
      "Week 2 · Nov 8–14",
      "Week 3 · Nov 15–21",
      "Week 4 · Nov 22–28",
      "Week 5 · Nov 29–30",
    ]);
    expect(nov[0]).toMatchObject({ from: "2026-11-01", to: "2026-11-07" });
    expect(nov[4]).toMatchObject({ from: "2026-11-29", to: "2026-11-30" });
    expect(daysIn(nov[4])).toBe(2);
  });

  it("gives a 28-day February four full weeks", () => {
    const feb = weeksOfMonth(2026, 2);
    expect(feb).toHaveLength(4);
    expect(feb.at(-1)).toMatchObject({ from: "2026-02-22", to: "2026-02-28" });
  });

  it("gives a leap February a one-day Week 5", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    const feb = weeksOfMonth(2028, 2);
    expect(feb.at(-1)).toMatchObject({ week: 5, from: "2028-02-29", to: "2028-02-29" });
    expect(feb.at(-1)!.label).toBe("Week 5 · Feb 29");
  });

  it("ends a 31-day month on the 31st", () => {
    expect(weeksOfMonth(2026, 12).at(-1)).toMatchObject({
      label: "Week 5 · Dec 29–31",
      to: "2026-12-31",
    });
  });
});

describe("monthWeekOf and the week before", () => {
  it("finds the week a day falls in, at the edges too", () => {
    expect(monthWeekOf("2026-11-01").week).toBe(1);
    expect(monthWeekOf("2026-11-07").week).toBe(1);
    expect(monthWeekOf("2026-11-08").week).toBe(2);
    expect(monthWeekOf("2026-10-31")).toMatchObject({ week: 5, from: "2026-10-29" });
  });

  it("steps back across a month and a year", () => {
    expect(previousMonthWeek(weeksOfMonth(2026, 11)[0])).toMatchObject({
      year: 2026,
      month: 10,
      week: 5,
      from: "2026-10-29",
      to: "2026-10-31",
    });
    expect(previousMonthWeek(weeksOfMonth(2027, 1)[0])).toMatchObject({
      year: 2026,
      month: 12,
      week: 5,
    });
    expect(previousMonthWeek(weeksOfMonth(2026, 11)[2]).week).toBe(2);
  });

  it("lists eight weeks ending with the picked one, oldest first", () => {
    const weeks = weeksEndingWith(weeksOfMonth(2026, 11)[0], 8);
    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)!.label).toBe("Week 1 · Nov 1–7");
    expect(weeks.at(-2)!.label).toBe("Week 5 · Oct 29–31");
    expect(weeks[0].label).toBe("Week 4 · Sep 22–28");
  });
});

describe("resolveWeek: the week the page shows", () => {
  it("defaults to the week today falls in", () => {
    expect(resolveWeek({}, today)).toMatchObject({ year: 2026, month: 11, week: 1 });
  });

  it("takes a valid past week from the URL", () => {
    expect(resolveWeek({ year: "2026", month: "10", week: "4" }, today)).toMatchObject({
      label: "Week 4 · Oct 22–28",
    });
  });

  it("turns a week number the month doesn't have into its last week", () => {
    expect(resolveWeek({ year: "2026", month: "2", week: "5" }, today)).toMatchObject({
      month: 2,
      week: 4,
    });
    expect(resolveWeek({ year: "2028", month: "2", week: "9" }, "2028-03-10")).toMatchObject({
      week: 5,
      from: "2028-02-29",
    });
  });

  it("never shows a week that hasn't started, or a bad value", () => {
    // Week 2 of November starts on the 8th: not yet.
    expect(resolveWeek({ year: "2026", month: "11", week: "2" }, today).week).toBe(1);
    expect(resolveWeek({ year: "2026", month: "12", week: "1" }, today)).toMatchObject({
      month: 11,
      week: 1,
    });
    for (const bad of [
      { year: "x", month: "11", week: "1" },
      { year: "2026", month: "13", week: "1" },
      { year: "2026", month: "0", week: "1" },
      { year: "1999", month: "1", week: "1" },
      { year: ["2026"], month: ["10"], week: ["-1"] },
    ])
      expect(resolveWeek(bad, today)).toMatchObject({ year: 2026 });
    expect(resolveWeek({ year: "2026", month: "10", week: "abc" }, today).week).toBe(1);
  });
});

describe("keepWeek: changing the month or year", () => {
  it("keeps the week number when the month has it", () => {
    expect(keepWeek(2026, 9, 3, today)).toMatchObject({ month: 9, week: 3 });
  });

  it("moves to the last week when the month is shorter", () => {
    // Week 5 of October → February 2026 has only four weeks.
    expect(keepWeek(2026, 2, 5, today)).toMatchObject({ week: 4, from: "2026-02-22" });
  });

  it("moves to the last week that has started in the current month", () => {
    expect(keepWeek(2026, 11, 4, today)).toMatchObject({ week: 1 });
  });

  it("gives nothing for a month that hasn't started", () => {
    expect(keepWeek(2026, 12, 1, today)).toBeNull();
    expect(isAvailable(weeksOfMonth(2026, 11)[1], today)).toBe(false);
  });
});

describe("sumByWeek and the range text", () => {
  it("adds the days into their weeks, both ends included", () => {
    const weeks = [weeksOfMonth(2026, 10)[4], weeksOfMonth(2026, 11)[0]];
    expect(
      sumByWeek(weeks, [
        { day: "2026-10-28", value: 9 }, // Week 4 of October: outside
        { day: "2026-10-29", value: 1 },
        { day: "2026-10-31", value: 2 },
        { day: "2026-11-01", value: 3 },
        { day: "2026-11-07", value: 4 },
        { day: "2026-11-08", value: 9 }, // Week 2: outside
      ]),
    ).toEqual([3, 7]);
  });

  it("writes the range with the year", () => {
    expect(weekRangeText(weeksOfMonth(2026, 11)[0])).toBe("Nov 1–7, 2026");
  });
});

describe("workingDaysIn (D-118)", () => {
  it("counts Monday to Friday, less the Non-working days", () => {
    // Week 1 of November 2026: Sun 1 to Sat 7, five weekdays.
    const w = monthWeekOf("2026-11-02");
    expect(workingDaysIn(w, new Set())).toBe(5);
    expect(workingDaysIn(w, new Set(["2026-11-02", "2026-11-07"]))).toBe(4);
    // Week 5 of November: Sun 29 and Mon 30, one weekday.
    expect(workingDaysIn(monthWeekOf("2026-11-30"), new Set())).toBe(1);
    expect(workingDaysLabel(1)).toBe("1 working day");
    expect(workingDaysLabel(4)).toBe("4 working days");
  });
});
