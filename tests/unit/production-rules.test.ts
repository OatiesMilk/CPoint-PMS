import { describe, expect, it } from "vitest";
import {
  addMonths,
  describePlanShort,
  lastDayOf,
  lastPlannableDay,
  monthWeeks,
  planProblem,
  rollsScannedLine,
  capturePlanDays,
  leatherRollsLine,
  DEFAULT_LUNCH,
  DEFAULT_SCHEDULE,
  batchState,
  batchesFor,
  belowQuotaAttention,
  breaksOf,
  describeInterval,
  describeMinutes,
  enteredLate,
  explainShortfall,
  failedShare,
  finishWindow,
  inForceOn,
  isoWeekday,
  lunchProblem,
  manilaDayOf,
  noticesFor,
  pairsPerConstructor,
  paceSentence,
  pausedForLunch,
  quotaProgress,
  suggestQuota,
  type BreakRule,
  type DayHistory,
  type ScheduleRule,
} from "@/lib/production-rules";

// Batch rules (Phase 27, D-097 to D-099). Manila is UTC+8: 13:00 Manila is 05:00Z.

const MIN = 60_000;
const at = (iso: string) => new Date(iso);
const MON = "2026-10-19";
const SUN = "2026-10-25";
const LUNCH: BreakRule[] = [{ ...DEFAULT_LUNCH }];
const every = (minutes: number | null): ScheduleRule => ({
  ...DEFAULT_SCHEDULE,
  intervalMinutes: minutes,
});
const spans = (rule: ScheduleRule, breaks = LUNCH, day = MON) =>
  batchesFor(rule, breaks, day).map((b) => `${b.startTime}–${b.time}`);
/** A Manila clock time on MON as an instant. */
const manila = (hhmm: string, day = MON) => new Date(`${day}T${hhmm}:00+08:00`);

describe("batchesFor: the visit's examples, 08:00–17:00 with lunch 11:00–12:00 (C-2, C-26)", () => {
  it("every 4 hours gives Batch 1 08:00–13:00 and Batch 2 13:00–17:00", () => {
    expect(spans(every(240))).toEqual(["08:00–13:00", "13:00–17:00"]);
  });

  it("every 2 hours gives 08:00–10:00, 10:00–13:00 with lunch inside, 13:00–15:00, 15:00–17:00", () => {
    const batches = batchesFor(every(120), LUNCH, MON);
    expect(batches.map((b) => `${b.startTime}–${b.time}`)).toEqual([
      "08:00–10:00",
      "10:00–13:00",
      "13:00–15:00",
      "15:00–17:00",
    ]);
    expect(batches[1].lunch).toEqual(DEFAULT_LUNCH);
    expect(batches[1].workingMinutes).toBe(120);
    expect(batches[1].label).toBe("Batch 2 · 10:00–13:00, lunch 11:00–12:00");
  });

  it("once at the end of the day gives one batch 08:00–17:00", () => {
    const batches = batchesFor(every(null), LUNCH, MON);
    expect(batches.map((b) => `${b.startTime}–${b.time}`)).toEqual(["08:00–17:00"]);
    expect(batches[0].workingMinutes).toBe(8 * 60);
  });

  it("every 3 hours: Batch 1 runs out at 11:00, so it carries on past lunch to 12:00", () => {
    expect(spans(every(180))).toEqual(["08:00–12:00", "12:00–15:00", "15:00–17:00"]);
  });

  it("every hour: Batch 3 is 10:00–12:00, then hourly again", () => {
    const s = spans(every(60));
    expect(s[2]).toBe("10:00–12:00");
    expect(s).toEqual([
      "08:00–09:00",
      "09:00–10:00",
      "10:00–12:00",
      "12:00–13:00",
      "13:00–14:00",
      "14:00–15:00",
      "15:00–16:00",
      "16:00–17:00",
    ]);
  });

  it("without lunch, every 4 hours gives the old 12:00, 16:00 and 17:00", () => {
    expect(spans(every(240), [])).toEqual(["08:00–12:00", "12:00–16:00", "16:00–17:00"]);
    expect(breaksOf({ startTime: null, endTime: null })).toEqual([]);
    expect(breaksOf(null)).toEqual([]);
  });

  it("takes a list of breaks, so a second one pauses its batch too", () => {
    const two = [...LUNCH, { startTime: "15:00", endTime: "15:30" }];
    expect(spans(every(240), two)).toEqual(["08:00–13:00", "13:00–17:00"]);
    expect(batchesFor(every(240), two, MON)[1].workingMinutes).toBe(210);
    expect(spans(every(120), two)).toEqual([
      "08:00–10:00",
      "10:00–13:00",
      "13:00–15:30",
      "15:30–17:00",
    ]);
  });

  it("ignores a lunch that isn't inside the shift", () => {
    expect(spans(every(240), [{ startTime: "07:00", endTime: "08:30" }])).toEqual([
      "08:00–12:00",
      "12:00–16:00",
      "16:00–17:00",
    ]);
  });

  it("has none on a day that isn't a working day, or without a schedule", () => {
    expect(isoWeekday(SUN)).toBe(7);
    expect(batchesFor(DEFAULT_SCHEDULE, LUNCH, SUN)).toEqual([]);
    expect(batchesFor(null, LUNCH, MON)).toEqual([]);
  });

  it("puts each batch's end at the Manila clock time", () => {
    const [b1] = batchesFor(DEFAULT_SCHEDULE, LUNCH, MON);
    expect(b1.start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(b1.at.toISOString()).toBe("2026-10-19T05:00:00.000Z");
  });

  it("describes how often", () => {
    expect(describeInterval(60)).toBe("every hour");
    expect(describeInterval(180)).toBe("every 3 hours");
    expect(describeInterval(null)).toBe("once at the end of the day");
  });
});

describe("lunchProblem (C-3, A-4)", () => {
  const shift = { shiftStart: "08:00", shiftEnd: "17:00" };
  it("needs the end after the start, inside the shift", () => {
    expect(lunchProblem({ startTime: "12:00", endTime: "11:00" }, shift)?.message).toBe(
      "Lunch must end after it starts.",
    );
    expect(lunchProblem({ startTime: "07:30", endTime: "08:30" }, shift)?.message).toBe(
      "Lunch must be inside the shift (08:00 to 17:00).",
    );
    expect(lunchProblem({ startTime: "16:30", endTime: "17:00" }, shift)?.message).toBe(
      "Lunch must be inside the shift (08:00 to 17:00).",
    );
    expect(lunchProblem({ startTime: "11:00", endTime: "12:00" }, shift)).toBeNull();
  });
});

describe("batchState (A-5)", () => {
  const [b1] = batchesFor(DEFAULT_SCHEDULE, LUNCH, MON); // 08:00–13:00, lunch 11:00–12:00

  it("is Upcoming before it starts, In progress until its end, Due at it", () => {
    expect(batchState(b1, null, manila("07:59"))).toBe("UPCOMING");
    expect(batchState(b1, null, manila("08:00"))).toBe("IN_PROGRESS");
    expect(batchState(b1, null, manila("12:59"))).toBe("IN_PROGRESS");
    expect(batchState(b1, null, manila("13:00"))).toBe("DUE");
  });

  it("reads Paused for lunch during lunch", () => {
    expect(pausedForLunch(b1, manila("10:59"))).toBe(false);
    expect(pausedForLunch(b1, manila("11:30"))).toBe(true);
    expect(pausedForLunch(b1, manila("12:00"))).toBe(false);
  });

  it("turns Late after exactly 30 minutes, not at 30", () => {
    expect(batchState(b1, null, manila("13:30"))).toBe("DUE");
    expect(batchState(b1, null, new Date(manila("13:30").getTime() + MIN))).toBe("LATE");
  });

  it("is Missed once the Manila day is over, and Finished whenever saved", () => {
    expect(batchState(b1, null, at("2026-10-19T15:59:00.000Z"))).toBe("LATE");
    expect(batchState(b1, null, at("2026-10-19T16:00:00.000Z"))).toBe("MISSED");
    expect(batchState(b1, { enteredAt: manila("12:55") }, manila("12:56"))).toBe("FINISHED");
  });

  it("marks a finish more than 30 minutes after the end as late", () => {
    expect(enteredLate(b1, manila("13:30"))).toBe(false);
    expect(enteredLate(b1, manila("13:31"))).toBe(true);
    expect(describeMinutes(40 * MIN)).toBe("40 minutes");
    expect(describeMinutes(65 * MIN)).toBe("1 hour 5 minutes");
  });
});

describe("finishWindow (C-28)", () => {
  const batches = batchesFor(every(120), LUNCH, MON);
  const b3 = batches[2]; // 13:00–15:00

  it("opens 10 minutes before the end, and says from when", () => {
    expect(finishWindow(b3, MON, manila("14:49"))).toEqual({
      ok: false,
      reason: "Batch 3 can be finished from 14:50.",
    });
    expect(finishWindow(b3, MON, manila("14:50"))).toEqual({ ok: true });
    expect(finishWindow(b3, MON, manila("23:59"))).toEqual({ ok: true });
  });

  it("closes at midnight, naming the day", () => {
    const r = finishWindow(b3, MON, at("2026-10-19T16:00:00.000Z"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/^Batch 3 of .+ closed at midnight\./);
  });
});

describe("noticesFor (A-9, C-6, C-31)", () => {
  const batches = batchesFor(DEFAULT_SCHEDULE, LUNCH, MON); // ends 13:00 and 17:00
  const none = new Set<string>();

  it("says nothing before 10 minutes to the end, and when the next notice comes", () => {
    const r = noticesFor(batches, none, manila("12:30"));
    expect(r.current).toEqual([]);
    expect(r.nextAt?.toISOString()).toBe(manila("12:50").toISOString());
  });

  it("at 10 minutes before the end: get ready", () => {
    const r = noticesFor(batches, none, manila("12:50"));
    expect(r.current).toEqual([
      {
        kind: "SOON",
        number: 1,
        slotAt: batches[0].at.toISOString(),
        message: "Batch 1 ends at 13:00. Get ready to count the finished pairs.",
      },
    ]);
    expect(r.nextAt?.toISOString()).toBe(manila("13:00").toISOString());
  });

  it("at the end: due, until it is finished", () => {
    const r = noticesFor(batches, none, manila("13:00"));
    expect(r.current.map((n) => [n.kind, n.message])).toEqual([
      ["DUE", "Batch 1 is due. Finish it now."],
    ]);
    expect(
      noticesFor(batches, new Set([batches[0].at.toISOString()]), manila("13:05")).current,
    ).toEqual([]);
  });

  it("goes by the clock, so a batch ending at 12:00 after lunch gets its first notice at 11:50", () => {
    const b = batchesFor(every(180), LUNCH, MON); // 08:00–12:00
    expect(noticesFor(b, none, manila("11:50")).current[0]?.kind).toBe("SOON");
  });

  it("stops at midnight", () => {
    expect(noticesFor(batches, none, at("2026-10-19T16:00:00.000Z")).current).toEqual([]);
  });
});

describe("inForceOn (the lunch break, D-097)", () => {
  const rows = [
    { effectiveFrom: "2026-10-01", pairs: 80 },
    { effectiveFrom: "2026-10-20", pairs: 90 },
  ];

  it("takes the latest row on or before the day, so a change for tomorrow leaves today alone", () => {
    expect(inForceOn(rows, "2026-09-30")).toBeNull();
    expect(inForceOn(rows, "2026-10-19")?.pairs).toBe(80);
    expect(inForceOn(rows, "2026-10-20")?.pairs).toBe(90);
  });

  it("lets the later of two same-day rows win", () => {
    const twice = [...rows, { effectiveFrom: "2026-10-20", pairs: 95 }];
    expect(inForceOn(twice, "2026-10-21")?.pairs).toBe(95);
  });
});

describe("quotaProgress and the pace on passed pairs (C-30, C-41)", () => {
  it("counts only the pairs that passed against the one quota", () => {
    const p = quotaProgress(90, 6, 120, 1);
    expect(p).toMatchObject({ passed: 84, finished: 90, failed: 6, quota: 120 });
    expect(p.share).toBeCloseTo(0.7);
    expect(p.pace).toBe("36 pairs more over 1 batch to reach the quota.");
  });

  it("says how far below once no batches are left, or when there is no quota", () => {
    expect(paceSentence(100, 120, 0)).toBe("Below quota by 20 pairs.");
    expect(paceSentence(120, 120, 2)).toBe("Quota reached.");
    expect(paceSentence(10, null, 2)).toBe("No daily quota is set yet.");
    expect(paceSentence(100, 120, 2)).toBe("20 pairs more over 2 batches to reach the quota.");
  });

  it("gives the failed share of the pairs finished", () => {
    expect(failedShare(40, 4)).toBeCloseTo(0.1);
    expect(failedShare(0, 0)).toBeNull();
  });
});

describe("explainShortfall (D-086, D-008)", () => {
  it("names how many were absent, never who", () => {
    expect(
      explainShortfall({
        pairs: 102,
        quota: 120,
        constructorsPresent: 11,
        constructorsOnRoster: 16,
      }),
    ).toBe("Below quota by 18 pairs. 5 of 16 Shoe Constructors were absent.");
    expect(
      explainShortfall({
        pairs: 102,
        quota: 120,
        constructorsPresent: 15,
        constructorsOnRoster: 16,
      }),
    ).toBe("Below quota by 18 pairs. 1 of 16 Shoe Constructors was absent.");
  });

  it("says when everyone was present, or attendance wasn't taken", () => {
    expect(
      explainShortfall({
        pairs: 114,
        quota: 120,
        constructorsPresent: 16,
        constructorsOnRoster: 16,
      }),
    ).toBe("Below quota by 6 pairs with everyone present.");
    expect(
      explainShortfall({
        pairs: 114,
        quota: 120,
        constructorsPresent: null,
        constructorsOnRoster: null,
      }),
    ).toBe("Below quota by 6 pairs. Attendance wasn't taken that day.");
  });

  it("handles zero constructors present", () => {
    expect(
      explainShortfall({ pairs: 0, quota: 120, constructorsPresent: 0, constructorsOnRoster: 16 }),
    ).toBe("Below quota by 120 pairs. 16 of 16 Shoe Constructors were absent.");
    expect(pairsPerConstructor(0, 0)).toBeNull();
    expect(pairsPerConstructor(110, 11)).toBe(10);
  });

  it("says nothing for a day on quota or without one", () => {
    expect(
      explainShortfall({
        pairs: 120,
        quota: 120,
        constructorsPresent: 1,
        constructorsOnRoster: 16,
      }),
    ).toBeNull();
    expect(
      explainShortfall({ pairs: 0, quota: null, constructorsPresent: 1, constructorsOnRoster: 16 }),
    ).toBeNull();
  });
});

describe("suggestQuota (D-099, Dylan 2026-10-24)", () => {
  const day = (
    d: string,
    passed: number,
    full = true,
    present: number | null = 12,
  ): DayHistory => ({
    day: d,
    full,
    passed,
    constructorsPresent: present,
  });

  it("needs 3 full days, and says how many there are", () => {
    const r = suggestQuota([day("2026-10-13", 100), day("2026-10-14", 100, false)], 12);
    expect(r.pairs).toBeNull();
    if (r.pairs === null)
      expect(r.reason).toBe(
        "A suggestion needs at least 3 working days with every batch finished. There is 1 so far.",
      );
  });

  it("averages the passed pairs per full working day", () => {
    const r = suggestQuota(
      [day("2026-10-13", 120), day("2026-10-14", 130), day("2026-10-15", 125)],
      12,
    );
    expect(r.pairs).toBe(125);
    if (r.pairs !== null) {
      expect(r.sentence).toBe(
        "Average 125 passed pairs a day over the last 3 full working days = 125 pairs.",
      );
      expect(r.perConstructor).toBe(
        "Or 10.4 passed pairs per Shoe Constructor present × 12 expected = 125 pairs.",
      );
    }
  });

  it("uses only the latest 10 full days", () => {
    const days = Array.from({ length: 12 }, (_, i) =>
      day(`2026-10-${String(i + 1).padStart(2, "0")}`, i < 2 ? 1000 : 100),
    );
    expect(suggestQuota(days, null).pairs).toBe(100);
  });
});

describe("belowQuotaAttention", () => {
  const d = (day: string, pairs: number) => ({ day, pairs, quota: 100 });
  it("counts the last 5 working days with a quota, from 2 below", () => {
    expect(
      belowQuotaAttention([
        d("2026-10-13", 90),
        d("2026-10-14", 100),
        d("2026-10-15", 80),
        d("2026-10-16", 120),
        d("2026-10-17", 70),
        d("2026-10-10", 10), // older than the last five
      ]),
    ).toEqual({ below: 3, of: 5 });
    expect(belowQuotaAttention([d("2026-10-13", 90), d("2026-10-14", 100)])).toBeNull();
  });
});

describe("manilaDayOf", () => {
  it("reads the Manila calendar day of an instant", () => {
    expect(manilaDayOf(at("2026-10-19T15:59:00.000Z"))).toBe("2026-10-19");
    expect(manilaDayOf(at("2026-10-19T16:00:00.000Z"))).toBe("2026-10-20");
  });
});

describe("qualityInspectorPresent (D-088)", () => {
  it("is null without attendance, and true only when a QI is marked present", async () => {
    const { qualityInspectorPresent } = await import("@/lib/attendance-rules");
    const roster = [
      { id: "qi", name: "Lea", email: "l@x", role: "QUALITY_INSPECTOR" as const },
      { id: "fm", name: "Ivy", email: "i@x", role: "FLOOR_MANAGER" as const },
    ];
    expect(qualityInspectorPresent(roster, null)).toBeNull();
    expect(qualityInspectorPresent(roster, [{ userId: "qi", present: true }])).toBe(true);
    expect(
      qualityInspectorPresent(roster, [
        { userId: "qi", present: false },
        { userId: "fm", present: true },
      ]),
    ).toBe(false);
  });
});

describe("the planning calendar (Phase 30E-2, D-114, A-40)", () => {
  it("lays a month out in weeks, Monday to Sunday", () => {
    const weeks = monthWeeks("2026-11");
    // 1 Nov 2026 is a Sunday.
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks.at(-1)).toEqual(["2026-11-30", null, null, null, null, null, null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(lastDayOf("2028-02")).toBe("2028-02-29");
  });

  it("plans weekdays from today to the end of the third month ahead", () => {
    const today = "2026-11-04";
    expect(planProblem("2026-11-04", today)).toBeNull();
    expect(planProblem("2027-02-26", today)).toBeNull();
    expect(planProblem("2026-11-07", today)).toMatch(/Saturdays and Sundays/);
    expect(planProblem("2026-11-03", today)).toBe(
      "Tue, 3 Nov has passed, so its plan can't change.",
    );
    expect(planProblem("2027-03-01", today)).toBe("Days can be planned up to Sun, 28 Feb.");
    expect(lastPlannableDay(today)).toBe("2027-02-28");
  });

  it("says a plan and its rolls in short", () => {
    expect(describePlanShort({ rollsPlanned: 5, quota: 128, intervalMinutes: 240 })).toBe(
      "5 rolls · 128 pairs · every 4 h",
    );
    // A day converted from the old schedule has no rolls, and may keep an older interval.
    expect(describePlanShort({ rollsPlanned: null, quota: 85, intervalMinutes: 120 })).toBe(
      "85 pairs · every 2 h",
    );
    expect(describePlanShort({ rollsPlanned: 1, quota: null, intervalMinutes: null })).toBe(
      "1 roll · once a day",
    );
    // Batches says the interval in full beside it, so the short one is left out (30F-3).
    expect(
      describePlanShort({ rollsPlanned: 5, quota: 128, intervalMinutes: 240 }, { interval: false }),
    ).toBe("5 rolls · 128 pairs");
    expect(
      describePlanShort(
        { rollsPlanned: null, quota: null, intervalMinutes: 240 },
        { interval: false },
      ),
    ).toBe("");
    expect(rollsScannedLine(3, 5)).toBe("3 of 5 rolls scanned");
    expect(rollsScannedLine(1, null)).toBe("1 roll scanned");
    expect(rollsScannedLine(3, 5, 1)).toBe("3 of 5 rolls scanned · 1 returned");
    expect(rollsScannedLine(3, 5, 0)).toBe("3 of 5 rolls scanned");
  });

  it("gives a day plan's batches without working days", () => {
    const b = batchesFor(
      { shiftStart: "08:00", shiftEnd: "17:00", intervalMinutes: 240 },
      [{ startTime: "11:00", endTime: "12:00" }],
      "2026-11-04",
    );
    expect(b.map((x) => `${x.startTime}–${x.time}`)).toEqual(["08:00–13:00", "13:00–17:00"]);
  });
});

describe("Capture's counter (Phase 30D, D-118)", () => {
  const p = (day: string, kind: "PLANNED" | "NON_WORKING", rollsPlanned: number | null) => ({
    day,
    kind,
    rollsPlanned,
  });

  it("reads Leather rolls scanned 3/15, or a bare count with nothing planned", () => {
    expect(leatherRollsLine(3, 15)).toBe("Leather rolls scanned 3/15");
    expect(leatherRollsLine(0, 15)).toBe("Leather rolls scanned 0/15");
    expect(leatherRollsLine(4, null)).toBe("Leather rolls scanned 4");
  });

  it("keeps today whatever its plan, then planned days only, five in all", () => {
    const plans = [
      p("2026-11-04", "NON_WORKING", null),
      p("2026-11-03", "PLANNED", 7), // the past: never shown
      p("2026-11-10", "PLANNED", 4),
      p("2026-11-05", "PLANNED", 15),
      p("2026-11-06", "NON_WORKING", null),
      p("2026-11-11", "PLANNED", 5),
      p("2026-11-12", "PLANNED", 6),
      p("2026-11-13", "PLANNED", 2),
    ];
    const days = capturePlanDays("2026-11-04", plans, 2);
    expect(days.map((d) => d.day)).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    expect(days[0]).toMatchObject({
      isToday: true,
      kind: "NON_WORKING",
      planned: null,
      scanned: 2,
    });
    expect(days[1]).toMatchObject({ isToday: false, kind: "PLANNED", planned: 15, scanned: 0 });
  });

  it("shows today as not planned when it has no plan", () => {
    expect(capturePlanDays("2026-11-04", [], 0)).toEqual([
      { day: "2026-11-04", isToday: true, kind: "NOT_PLANNED", planned: null, scanned: 0 },
    ]);
  });
});
