import { beforeEach, describe, expect, it, vi } from "vitest";

const model = {
  findAttendanceDay: vi.fn(),
  listRosterCandidates: vi.fn(),
  createAttendanceDay: vi.fn(),
  touchAttendanceDay: vi.fn(),
  replaceAttendanceMarks: vi.fn(),
};
const audit = { recordAudit: vi.fn() };
const TX = { tx: true };

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/attendance.model", () => model);
vi.mock("@/server/models/db", () => ({
  runInTransaction: vi.fn(async (fn: (tx: object) => unknown) => fn(TX)),
}));
vi.mock("@/server/services/audit.service", () => audit);

const { getAttendanceDay, saveAttendanceDay, STALE_ATTENDANCE } =
  await import("@/server/services/attendance.service");

// 09:00 Manila on Wed 21 Oct 2026.
const NOW = new Date("2026-10-21T01:00:00Z");
const FM = { id: "fm", role: "FLOOR_MANAGER" as const };
const AD = { id: "ad", role: "SYSTEM_ADMIN" as const };
const created = new Date("2026-10-01T00:00:00Z");
const PEOPLE = [
  {
    id: "c1",
    name: "Ana Cruz",
    email: "a@x",
    role: "SHOE_CONSTRUCTOR",
    isActive: true,
    createdAt: created,
  },
  {
    id: "c2",
    name: "Ben Santos",
    email: "b@x",
    role: "SHOE_CONSTRUCTOR",
    isActive: true,
    createdAt: created,
  },
  {
    id: "fm",
    name: "Ivy Reyes",
    email: "i@x",
    role: "FLOOR_MANAGER",
    isActive: true,
    createdAt: created,
  },
];
const SAVED_AT = new Date("2026-10-21T00:30:00Z");
const savedDay = (marks: { userId: string; present: boolean }[]) => ({
  id: "day1",
  updatedAt: SAVED_AT,
  takenAt: SAVED_AT,
  takenBy: { name: "Ivy Reyes" },
  marks,
});

beforeEach(() => {
  vi.clearAllMocks();
  model.listRosterCandidates.mockResolvedValue(PEOPLE);
  model.findAttendanceDay.mockResolvedValue(null);
  model.createAttendanceDay.mockResolvedValue({ id: "day1" });
  model.touchAttendanceDay.mockResolvedValue(1);
});

describe("reading a day", () => {
  it("shows a day never saved as not taken, editable for the Floor Manager", async () => {
    const view = await getAttendanceDay(undefined, FM, NOW);
    expect(view).toMatchObject({
      day: "2026-10-21",
      taken: false,
      editable: true,
      lockedReason: null,
      summary: "Attendance for Wed, 21 Oct hasn't been taken yet.",
    });
    expect(view.roster.map((p) => p.id)).toEqual(["c1", "c2", "fm"]);
  });

  it("is read-only for the System Admin, saying why", async () => {
    const view = await getAttendanceDay("2026-10-21", AD, NOW);
    expect(view).toMatchObject({
      editable: false,
      lockedReason: "Only the Floor Manager takes attendance.",
    });
  });

  it("locks a day more than 7 days ago", async () => {
    const view = await getAttendanceDay("2026-10-13", FM, NOW);
    expect(view).toMatchObject({
      editable: false,
      lockedReason: "Days more than 7 days ago are locked.",
    });
  });

  it("carries no per-person totals, only the day's marks (D-008)", async () => {
    model.findAttendanceDay.mockResolvedValue(savedDay([{ userId: "c1", present: true }]));
    const view = await getAttendanceDay("2026-10-21", FM, NOW);
    for (const row of view.roster)
      expect(Object.keys(row).sort()).toEqual(["email", "id", "name", "present", "role"]);
  });
});

describe("saving a day (D-079)", () => {
  it("creates the day, saves everyone on the roster and writes one audit row in the same tx", async () => {
    await saveAttendanceDay(
      "2026-10-21",
      { expectedUpdatedAt: null, marks: [{ userId: "c1", present: true }] },
      FM,
      NOW,
    );
    expect(model.createAttendanceDay).toHaveBeenCalledWith("2026-10-21", "fm", NOW, TX);
    // Ben and Ivy weren't sent, so they are saved absent: a saved day is always whole.
    expect(model.replaceAttendanceMarks).toHaveBeenCalledWith(
      "day1",
      [
        { userId: "c1", present: true },
        { userId: "c2", present: false },
        { userId: "fm", present: false },
      ],
      TX,
    );
    expect(audit.recordAudit).toHaveBeenCalledTimes(1);
    expect(audit.recordAudit).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        action: "attendance.take",
        entity: "AttendanceDay",
        after: expect.objectContaining({ present: 1, absent: 2, nowPresent: ["Ana Cruz"] }),
      }),
    );
  });

  it("refuses a save when someone else saved since the page loaded (409 STALE)", async () => {
    model.findAttendanceDay.mockResolvedValue(savedDay([{ userId: "c1", present: true }]));
    model.touchAttendanceDay.mockResolvedValue(0);
    await expect(
      saveAttendanceDay(
        "2026-10-21",
        { expectedUpdatedAt: SAVED_AT.toISOString(), marks: [{ userId: "c1", present: false }] },
        FM,
        NOW,
      ),
    ).rejects.toMatchObject({ status: 409, code: "STALE", message: STALE_ATTENDANCE });
    expect(audit.recordAudit).not.toHaveBeenCalled();
  });

  it("refuses a first save when the day was saved meanwhile", async () => {
    model.findAttendanceDay.mockResolvedValue(savedDay([]));
    await expect(
      saveAttendanceDay(
        "2026-10-21",
        { expectedUpdatedAt: null, marks: [{ userId: "c1", present: true }] },
        FM,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });

  it("turns a racing first save into 409 STALE", async () => {
    model.createAttendanceDay.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(
      saveAttendanceDay(
        "2026-10-21",
        { expectedUpdatedAt: null, marks: [{ userId: "c1", present: true }] },
        FM,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });

  it("updates a saved day and records who changed", async () => {
    model.findAttendanceDay.mockResolvedValue(
      savedDay([
        { userId: "c1", present: true },
        { userId: "c2", present: true },
        { userId: "fm", present: true },
      ]),
    );
    await saveAttendanceDay(
      "2026-10-21",
      {
        expectedUpdatedAt: SAVED_AT.toISOString(),
        marks: [
          { userId: "c1", present: true },
          { userId: "c2", present: false },
          { userId: "fm", present: true },
        ],
      },
      FM,
      NOW,
    );
    expect(model.touchAttendanceDay).toHaveBeenCalledWith("day1", SAVED_AT, "fm", NOW, TX);
    expect(audit.recordAudit).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        action: "attendance.update",
        before: expect.objectContaining({ present: 3, constructorsPresent: 2 }),
        after: expect.objectContaining({
          present: 2,
          constructorsPresent: 1,
          nowAbsent: ["Ben Santos"],
        }),
      }),
    );
  });

  it("refuses someone who isn't on that day's roster, naming the day", async () => {
    await expect(
      saveAttendanceDay(
        "2026-10-21",
        { expectedUpdatedAt: null, marks: [{ userId: "stranger", present: true }] },
        FM,
        NOW,
      ),
    ).rejects.toThrow("Someone in this list isn't on the roster for 21 Oct. Refresh the list.");
  });

  it("refuses a locked day and a future day", async () => {
    const input = { expectedUpdatedAt: null, marks: [{ userId: "c1", present: true }] };
    await expect(saveAttendanceDay("2026-10-13", input, FM, NOW)).rejects.toThrow(
      "Days more than 7 days ago are locked.",
    );
    await expect(saveAttendanceDay("2026-10-22", input, FM, NOW)).rejects.toThrow(
      "Attendance can't be taken for a future day.",
    );
  });

  it("is for the Floor Manager only", async () => {
    await expect(
      saveAttendanceDay(
        "2026-10-21",
        { expectedUpdatedAt: null, marks: [{ userId: "c1", present: true }] },
        AD,
        NOW,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
