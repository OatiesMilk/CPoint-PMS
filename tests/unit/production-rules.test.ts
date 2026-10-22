import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEDULE,
  belowQuotaAttention,
  checkInWindow,
  dayProgress,
  describeMinutes,
  effectiveFromFor,
  enteredLate,
  explainShortfall,
  inForceOn,
  isoWeekday,
  manilaDayOf,
  pairsPerConstructor,
  paceSentence,
  slotState,
  slotsFor,
  suggestQuota,
  type DayHistory,
} from "@/lib/production-rules";

// Production progression rules (Phase 23). Manila is UTC+8: 12:00 Manila is 04:00Z.

const MIN = 60_000;
const at = (iso: string) => new Date(iso);
const MON = "2026-10-19";
const SUN = "2026-10-25";

describe("slotsFor (D-083)", () => {
  it("gives 12:00, 16:00 and 17:00 for the default 08:00–17:00 every 4 hours", () => {
    const slots = slotsFor(DEFAULT_SCHEDULE, MON);
    expect(slots.map((s) => s.time)).toEqual(["12:00", "16:00", "17:00"]);
    expect(slots.map((s) => s.since)).toEqual(["08:00", "12:00", "16:00"]);
    expect(slots[0].at.toISOString()).toBe("2026-10-19T04:00:00.000Z");
  });

  it("adds the shift end when it is off the grid, and not twice when it is on it", () => {
    const every2 = { ...DEFAULT_SCHEDULE, intervalMinutes: 120 };
    expect(slotsFor(every2, MON).map((s) => s.time)).toEqual([
      "10:00",
      "12:00",
      "14:00",
      "16:00",
      "17:00",
    ]);
    const onGrid = { ...DEFAULT_SCHEDULE, shiftEnd: "16:00" };
    expect(slotsFor(onGrid, MON).map((s) => s.time)).toEqual(["12:00", "16:00"]);
  });

  it("has none on a day that isn't a working day, or without a schedule", () => {
    expect(isoWeekday(SUN)).toBe(7);
    expect(slotsFor(DEFAULT_SCHEDULE, SUN)).toEqual([]);
    expect(slotsFor(null, MON)).toEqual([]);
  });

  it("handles a shift shorter than one interval", () => {
    const short = { ...DEFAULT_SCHEDULE, shiftStart: "08:00", shiftEnd: "10:00" };
    expect(slotsFor(short, MON).map((s) => s.time)).toEqual(["10:00"]);
  });
});

describe("slotState (D-084)", () => {
  const slot = { at: at("2026-10-19T04:00:00.000Z") }; // 12:00 Manila

  it("is Upcoming before its time and Due from it", () => {
    expect(slotState(slot, null, at("2026-10-19T03:59:00.000Z"))).toBe("UPCOMING");
    expect(slotState(slot, null, at("2026-10-19T04:00:00.000Z"))).toBe("DUE");
  });

  it("turns Late after exactly 30 minutes, not at 30", () => {
    expect(slotState(slot, null, new Date(slot.at.getTime() + 30 * MIN))).toBe("DUE");
    expect(slotState(slot, null, new Date(slot.at.getTime() + 30 * MIN + 1))).toBe("LATE");
  });

  it("is Missed once the Manila day is over, and Entered whenever saved", () => {
    expect(slotState(slot, null, at("2026-10-19T15:59:00.000Z"))).toBe("LATE"); // 23:59 Manila
    expect(slotState(slot, null, at("2026-10-19T16:00:00.000Z"))).toBe("MISSED"); // midnight
    expect(
      slotState(slot, { enteredAt: at("2026-10-19T05:00:00Z") }, at("2026-10-20T00:00Z")),
    ).toBe("ENTERED");
  });

  it("marks an entry more than 30 minutes after its time as late", () => {
    expect(enteredLate(slot, new Date(slot.at.getTime() + 30 * MIN))).toBe(false);
    expect(enteredLate(slot, new Date(slot.at.getTime() + 50 * MIN))).toBe(true);
    expect(describeMinutes(40 * MIN)).toBe("40 minutes");
    expect(describeMinutes(65 * MIN)).toBe("1 hour 5 minutes");
  });
});

describe("checkInWindow", () => {
  const slot = { at: at("2026-10-19T06:00:00.000Z"), time: "14:00" };

  it("refuses before its time with the time it opens", () => {
    expect(checkInWindow(slot, MON, at("2026-10-19T05:00:00.000Z"))).toEqual({
      ok: false,
      reason: "The 14:00 check-in isn't open yet. You can enter it from 14:00.",
    });
  });

  it("refuses after midnight, naming the day", () => {
    const r = checkInWindow(slot, MON, at("2026-10-19T16:00:00.000Z"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain("The check-in for Mon, 19 Oct closed at midnight.");
  });

  it("is open from its time to the end of the day", () => {
    expect(checkInWindow(slot, MON, at("2026-10-19T06:00:00.000Z"))).toEqual({ ok: true });
    expect(checkInWindow(slot, MON, at("2026-10-19T15:59:59.000Z"))).toEqual({ ok: true });
  });
});

describe("inForceOn and effectiveFromFor (D-083, D-085, Dylan 5A)", () => {
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

  it("applies a change from tomorrow and a first quota from today", () => {
    expect(effectiveFromFor("2026-10-21")).toBe("2026-10-22");
    expect(effectiveFromFor("2026-10-21", true)).toBe("2026-10-21");
  });
});

describe("dayProgress and the pace (D-086)", () => {
  const types = [
    { id: "sch", name: "School Shoes" },
    { id: "top", name: "Topsider" },
    { id: "new", name: "Loafer" }, // added mid-week, no quota yet
  ];
  const counts = [
    { shoeTypeId: "sch", pairs: 40 },
    { shoeTypeId: "sch", pairs: 42 },
    { shoeTypeId: "top", pairs: 50 },
  ];

  it("sums each type against its quota with the pace still needed", () => {
    const p = dayProgress(
      types,
      counts,
      new Map([
        ["sch", 120],
        ["top", 45],
      ]),
      2,
    );
    expect(p[0]).toMatchObject({ pairs: 82, quota: 120 });
    expect(p[0].share).toBeCloseTo(82 / 120);
    expect(p[0].pace).toBe("38 pairs more over 2 check-ins to reach the quota.");
    expect(p[1].pace).toBe("Quota reached.");
    expect(p[2]).toMatchObject({ pairs: 0, quota: null, share: null });
    expect(p[2].pace).toBe("No daily quota is set for Loafer yet.");
  });

  it("says how far below once no check-ins are left", () => {
    expect(paceSentence("School Shoes", 100, 120, 0)).toBe("Below quota by 20 pairs.");
    expect(paceSentence("School Shoes", 119, 120, 1)).toBe(
      "1 pair more over 1 check-in to reach the quota.",
    );
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

describe("suggestQuota (D-085, Dylan 4A)", () => {
  const day = (d: number, pairs: number, full = true, present: number | null = 10): DayHistory => ({
    day: `2026-10-${String(d).padStart(2, "0")}`,
    full,
    checkIns: 3,
    pairs,
    constructorsPresent: present,
  });

  it("needs 3 full days, and says how many there are", () => {
    const r = suggestQuota([day(1, 60), day(2, 60), day(3, 90, false)], 3, 12);
    expect(r).toEqual({
      pairs: null,
      reason:
        "A suggestion needs at least 3 working days with every check-in entered. There are 2 so far.",
    });
  });

  it("averages pairs per check-in over the full days × check-ins a day", () => {
    const r = suggestQuota([day(1, 60), day(2, 66), day(3, 72), day(4, 10, false)], 3, 12);
    expect(r.pairs).toBe(66); // 198 pairs over 9 check-ins = 22 a check-in, × 3
    expect(r.pairs !== null && r.sentence).toBe(
      "Average 22 pairs per check-in over the last 3 full working days × 3 check-ins a day = 66 pairs.",
    );
    expect(r.pairs !== null && r.perConstructor).toBe(
      "Or 6.6 pairs per Shoe Constructor present × 12 expected = 79 pairs.",
    );
  });

  it("uses only the latest 10 full days", () => {
    const history = [
      ...Array.from({ length: 10 }, (_, i) => day(i + 11, 30)),
      day(1, 300),
      day(2, 300),
    ];
    const r = suggestQuota(history, 3, null);
    expect(r).toMatchObject({ pairs: 30, days: 10, perConstructor: null });
  });

  it("follows the schedule for the next day (a change effective tomorrow)", () => {
    const history = [day(1, 60), day(2, 60), day(3, 60)]; // 20 a check-in
    expect(suggestQuota(history, 5, null).pairs).toBe(100);
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
