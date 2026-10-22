import { describe, expect, it } from "vitest";
import {
  attendanceSummary,
  changedMarks,
  editableDay,
  formatAttendanceDay,
  rosterFor,
  workforceFor,
  type RosterCandidate,
} from "@/lib/attendance-rules";

const person = (over: Partial<RosterCandidate> & { id: string }): RosterCandidate => ({
  name: over.id,
  email: `${over.id}@cpoint.local`,
  role: "SHOE_CONSTRUCTOR",
  isActive: true,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...over,
});

describe("rosterFor (D-078)", () => {
  it("includes someone created late on the day in Manila, and not the day before", () => {
    // 23:30 Manila on 21 Oct is 15:30 UTC.
    const late = person({ id: "late", createdAt: new Date("2026-10-21T15:30:00Z") });
    expect(rosterFor([late], "2026-10-21").map((p) => p.id)).toEqual(["late"]);
    expect(rosterFor([late], "2026-10-20")).toEqual([]);
  });

  it("leaves out someone created just after the Manila day ends", () => {
    // 00:00 Manila on 22 Oct is 16:00 UTC on 21 Oct.
    const next = person({ id: "next", createdAt: new Date("2026-10-21T16:00:00Z") });
    expect(rosterFor([next], "2026-10-21")).toEqual([]);
  });

  it("keeps a deactivated person on a day they were marked, and only there", () => {
    const gone = person({ id: "gone", isActive: false });
    expect(rosterFor([gone], "2026-10-20", new Set(["gone"])).map((p) => p.id)).toEqual(["gone"]);
    expect(rosterFor([gone], "2026-10-21")).toEqual([]);
  });

  it("puts Shoe Constructors first, then the other roles, then by name", () => {
    const roster = rosterFor(
      [
        person({ id: "a", name: "Zed Admin", role: "SYSTEM_ADMIN" }),
        person({ id: "q", name: "Ana Inspector", role: "QUALITY_INSPECTOR" }),
        person({ id: "c2", name: "maria Cruz" }),
        person({ id: "f", name: "Ivy Reyes", role: "FLOOR_MANAGER" }),
        person({ id: "c1", name: "Ben Santos" }),
      ],
      "2026-10-21",
    );
    expect(roster.map((p) => p.id)).toEqual(["c1", "c2", "f", "q", "a"]);
  });
});

describe("editableDay (D-079)", () => {
  const today = "2026-10-21";
  it("allows today and exactly 7 days ago", () => {
    expect(editableDay(today, today)).toEqual({ ok: true });
    expect(editableDay("2026-10-14", today)).toEqual({ ok: true });
  });
  it("locks 8 days ago", () => {
    expect(editableDay("2026-10-13", today)).toEqual({
      ok: false,
      reason: "Days more than 7 days ago are locked.",
    });
  });
  it("refuses tomorrow", () => {
    expect(editableDay("2026-10-22", today)).toEqual({
      ok: false,
      reason: "Attendance can't be taken for a future day.",
    });
  });
});

describe("workforceFor (D-080)", () => {
  const roster = rosterFor(
    [
      person({ id: "c1" }),
      person({ id: "c2" }),
      person({ id: "c3" }),
      person({ id: "fm", role: "FLOOR_MANAGER" }),
      person({ id: "qi", role: "QUALITY_INSPECTOR" }),
    ],
    "2026-10-21",
  );

  it("says not taken when the day was never saved, never 0", () => {
    expect(workforceFor(roster, null)).toEqual({
      taken: false,
      constructorsPresent: null,
      constructorsOnRoster: 3,
      othersPresent: null,
    });
  });

  it("counts everyone present", () => {
    const marks = roster.map((p) => ({ userId: p.id, present: true }));
    expect(workforceFor(roster, marks)).toEqual({
      taken: true,
      constructorsPresent: 3,
      constructorsOnRoster: 3,
      othersPresent: 2,
    });
  });

  it("counts no workers when only the office roles came in", () => {
    const marks = roster.map((p) => ({ userId: p.id, present: p.role !== "SHOE_CONSTRUCTOR" }));
    expect(workforceFor(roster, marks)).toMatchObject({
      taken: true,
      constructorsPresent: 0,
      othersPresent: 2,
    });
  });
});

describe("the day's summary", () => {
  it("reads as one line for the whole line, no names", () => {
    expect(
      attendanceSummary(
        { taken: true, constructorsPresent: 14, constructorsOnRoster: 16, othersPresent: 3 },
        "2026-10-21",
      ),
    ).toBe("14 of 16 Shoe Constructors present · 3 others present");
    expect(
      attendanceSummary(
        { taken: true, constructorsPresent: 1, constructorsOnRoster: 1, othersPresent: 0 },
        "2026-10-21",
      ),
    ).toBe("1 of 1 Shoe Constructor present · 0 others present");
  });

  it("says plainly when it wasn't taken", () => {
    expect(
      attendanceSummary(
        { taken: false, constructorsPresent: null, constructorsOnRoster: 16, othersPresent: null },
        "2026-10-21",
      ),
    ).toBe("Attendance for Wed, 21 Oct hasn't been taken yet.");
    expect(formatAttendanceDay("2026-10-20")).toBe("Tue, 20 Oct");
  });
});

describe("changedMarks (audit)", () => {
  it("lists who changed by name, and nobody else", () => {
    const names = new Map([
      ["a", "Ana"],
      ["b", "Ben"],
      ["c", "Cora"],
    ]);
    expect(
      changedMarks(
        [
          { userId: "a", present: true },
          { userId: "b", present: false },
        ],
        [
          { userId: "a", present: false },
          { userId: "b", present: false },
          { userId: "c", present: true },
        ],
        names,
      ),
    ).toEqual({ nowPresent: ["Cora"], nowAbsent: ["Ana"] });
  });
});
