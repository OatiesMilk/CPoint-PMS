import { beforeEach, describe, expect, it, vi } from "vitest";

// Batches service (Phase 27, D-097 to D-099; Phase 30E-2, D-114): finishing a batch, corrections,
// the day plans on the calendar and the lunch break.

const STAMP = new Date("2026-10-01T00:00:00.000Z");
/** A day's plan as the model returns it: every 4 hours, 08:00 to 17:00. */
const plan = (day: string, extra: object = {}) => ({
  id: `p-${day}`,
  day,
  kind: "PLANNED" as "PLANNED" | "NON_WORKING",
  rollsPlanned: 2 as number | null,
  quota: null as number | null,
  suggestedQuota: null,
  intervalMinutes: 240 as number | null,
  shiftStart: "08:00" as string | null,
  shiftEnd: "17:00" as string | null,
  createdById: "fm1",
  updatedById: "fm1",
  createdAt: STAMP,
  updatedAt: STAMP,
  createdBy: { name: "Rodel Pascual" },
  updatedBy: { name: "Rodel Pascual" },
  ...extra,
});
const weekday = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
};
const addDay = (day: string, n: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
/** Every weekday from `from` to `to` is planned, unless a test says otherwise. */
const plansBetween = (from: string, to: string) => {
  const out = [];
  for (let d = from; d <= to; d = addDay(d, 1)) if (weekday(d)) out.push(plan(d));
  return out;
};
const LUNCH = {
  id: "l1",
  startTime: "11:00",
  endTime: "12:00",
  effectiveFrom: "2000-01-01",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  createdById: null,
  createdBy: null,
};

const model = {
  listDayPlans: vi.fn(async (from: string, to: string) => plansBetween(from, to) as unknown[]),
  findDayPlan: vi.fn(async (day: string) => (weekday(day) ? plan(day) : null) as unknown),
  insertDayPlan: vi.fn(async (day: string, d: object) => ({ id: "p-new", day, ...d })),
  updateDayPlan: vi.fn(async () => true),
  deleteDayPlan: vi.fn(async () => true),
  listLunchBreaks: vi.fn(async () => [LUNCH] as unknown[]),
  countLunchBreaks: vi.fn(async () => 1),
  insertLunchBreak: vi.fn(async (d: object) => ({ id: "l2", ...d })),
  listCheckIns: vi.fn(async () => [] as unknown[]),
  findCheckIn: vi.fn(),
  firstCheckInDay: vi.fn(async () => "2026-10-01" as string | null),
  findCheckInBySlot: vi.fn(async () => null as unknown),
  insertCheckIn: vi.fn(async (d: object) => ({ id: "ci1", ...d })),
  correctCheckIn: vi.fn(async () => true),
};
const workforce = {
  qualityInspectorPresentOn: vi.fn(async () => true as boolean | null),
  workforceByDay: vi.fn(async (days: string[]) => {
    const m = new Map();
    for (const d of days)
      m.set(d, {
        taken: true,
        constructorsPresent: 14,
        constructorsOnRoster: 16,
        othersPresent: 3,
      });
    return m;
  }),
};
const recordAudit = vi.fn();
const rolls = {
  rollsUsedByCheckIn: vi.fn(async () => new Map<string, { id: string; code: string }[]>()),
  rollsScannedByDay: vi.fn(async () => new Map<string, number>()),
  rollOutcomesByDay: vi.fn(async () => new Map<string, { scanned: number; returned: number }>()),
};

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/production.model", () => model);
vi.mock("@/server/services/attendance.service", () => workforce);
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/services/roll.service", () => rolls);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));

const svc = await import("@/server/services/production.service");

const QI = { id: "qi1", name: "Lea Santos", role: "QUALITY_INSPECTOR" as const };
const FM = { id: "fm1" };
// Tue 20 Oct 2026. With lunch 11:00–12:00, Batch 1 is 08:00–13:00 (ends 05:00Z) and Batch 2
// 13:00–17:00 (ends 09:00Z).
const B1 = "2026-10-20T05:00:00.000Z";
const B2 = "2026-10-20T09:00:00.000Z";
const at = (iso: string) => new Date(iso);

beforeEach(() => {
  vi.clearAllMocks();
  model.findCheckInBySlot.mockResolvedValue(null);
});

describe("saveCheckIn: Finish batch (C-27, C-28)", () => {
  it("saves the pairs and failed pairs with the day's worker count, and audits in the same tx", async () => {
    const r = await svc.saveCheckIn(
      { slotAt: B1, pairs: "42", failedPairs: 2, notes: "Press down 20 min" },
      QI,
      at("2026-10-20T05:05:00.000Z"),
    );
    expect(r).toEqual({ id: "ci1", number: 1, time: "13:00" });
    expect(model.insertCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        day: "2026-10-20",
        slotAt: at(B1),
        enteredById: "qi1",
        pairs: 42,
        failedPairs: 2,
        constructorsPresent: 14,
        constructorsOnRoster: 16,
        notes: "Press down 20 min",
      }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "production.checkin",
        after: expect.objectContaining({ pairs: 42, failedPairs: 2 }),
      }),
    );
  });

  it("asks for no rolls: the QI only counts pairs (Phase 30E, D-111)", async () => {
    const r = await svc.saveCheckIn(
      { slotAt: B1, pairs: "42", failedPairs: 0, usedRollIds: ["001"] } as never,
      QI,
      at("2026-10-20T05:05:00.000Z"),
    );
    expect(r).not.toHaveProperty("usedRolls");
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        after: expect.not.objectContaining({ rollsFullyUsed: expect.anything() }),
      }),
    );
  });

  it("opens Finish batch 10 minutes before the end, not earlier", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: B2, pairs: 5 }, QI, at("2026-10-20T08:49:00.000Z")),
    ).rejects.toMatchObject({ status: 409, message: "Batch 2 can be finished from 16:50." });
    await svc.saveCheckIn({ slotAt: B2, pairs: 5 }, QI, at("2026-10-20T08:50:00.000Z"));
    expect(model.insertCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ failedPairs: 0 }),
      "tx",
    );
  });

  it("refuses after midnight", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: B1, pairs: 1 }, QI, at("2026-10-20T16:00:00.000Z")),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Batch 1 of Tue, 20 Oct closed at midnight."),
    });
  });

  it("refuses more failed pairs than finished, under the failed field", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: B1, pairs: 3, failedPairs: 4 }, QI, at(B1)),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["failedPairs"],
          message: "Failed inspection can't be more than the pairs finished (3).",
        },
      ],
    });
    expect(model.insertCheckIn).not.toHaveBeenCalled();
  });

  it("names the batch in a bad count", async () => {
    await expect(svc.saveCheckIn({ slotAt: B1, pairs: "2.5" }, QI, at(B1))).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["pairs"],
          message:
            "Enter the pairs finished in Batch 1 as a whole number, like 24. Enter 0 if none.",
        },
      ],
    });
  });

  it("saves without a worker count when attendance wasn't taken, never blocking", async () => {
    workforce.workforceByDay.mockResolvedValueOnce(
      new Map([
        [
          "2026-10-20",
          {
            taken: false,
            constructorsPresent: null,
            constructorsOnRoster: 16,
            othersPresent: null,
          },
        ],
      ]),
    );
    await svc.saveCheckIn({ slotAt: B1, pairs: 0 }, QI, at(B1));
    expect(model.insertCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ constructorsPresent: null, constructorsOnRoster: null }),
      "tx",
    );
  });

  it("refuses a second finish of the same batch as 409 STALE, naming who and when", async () => {
    model.findCheckInBySlot.mockResolvedValueOnce({
      enteredBy: { name: "Lea Santos" },
      enteredAt: at("2026-10-20T05:04:00.000Z"),
    });
    await expect(svc.saveCheckIn({ slotAt: B1, pairs: 1 }, QI, at(B1))).rejects.toMatchObject({
      status: 409,
      code: "STALE",
      message: "Lea Santos already finished Batch 1 at 13:04. Refresh to see it.",
    });
    expect(model.insertCheckIn).not.toHaveBeenCalled();
  });

  it("turns a race on the unique slot into the same 409 STALE", async () => {
    model.insertCheckIn.mockRejectedValueOnce({ code: "P2002" });
    model.findCheckInBySlot
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ enteredBy: { name: "Lea Santos" }, enteredAt: at(B1) });
    await expect(svc.saveCheckIn({ slotAt: B1, pairs: 1 }, QI, at(B1))).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
  });

  it("refuses a time that isn't a batch's end", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: "2026-10-20T04:00:00.000Z", pairs: 1 }, QI, at(B1)),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("no batch ending at 12:00"),
    });
  });
});

describe("the Floor Manager covers only when no QI is present (D-088)", () => {
  const FM_ACTOR = { id: "fm1", name: "Ivy", role: "FLOOR_MANAGER" as const };

  it("saves the Floor Manager's batch on a day no QI is present, marked as covering", async () => {
    workforce.qualityInspectorPresentOn.mockResolvedValueOnce(false);
    await svc.saveCheckIn({ slotAt: B1, pairs: 5 }, FM_ACTOR, at(B1));
    expect(model.insertCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ enteredById: "fm1" }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        after: expect.objectContaining({ coveringForQualityInspector: true }),
      }),
    );
  });

  it("refuses the Floor Manager when a QI is present, or attendance isn't taken", async () => {
    workforce.qualityInspectorPresentOn.mockResolvedValueOnce(true);
    await expect(svc.saveCheckIn({ slotAt: B1, pairs: 5 }, FM_ACTOR, at(B1))).rejects.toMatchObject(
      {
        status: 403,
        message: "A Quality Inspector is present today, so they finish the batches.",
      },
    );
    workforce.qualityInspectorPresentOn.mockResolvedValueOnce(null);
    await expect(svc.saveCheckIn({ slotAt: B1, pairs: 5 }, FM_ACTOR, at(B1))).rejects.toMatchObject(
      {
        status: 403,
        message:
          "Take today's attendance first. You can finish batches only when it shows no Quality Inspector present.",
      },
    );
    expect(model.insertCheckIn).not.toHaveBeenCalled();
  });

  it("never asks attendance for the QI, and refuses the Admin", async () => {
    await svc.saveCheckIn({ slotAt: B1, pairs: 1 }, QI, at(B1));
    expect(workforce.qualityInspectorPresentOn).not.toHaveBeenCalled();
    await expect(
      svc.saveCheckIn({ slotAt: B1, pairs: 1 }, { id: "ad1", role: "SYSTEM_ADMIN" }, at(B1)),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("correctCheckIn", () => {
  const saved = {
    id: "ci1",
    day: at("2026-10-20T00:00:00.000Z"),
    slotAt: at(B1),
    updatedAt: at("2026-10-20T05:05:00.000Z"),
    pairs: 42,
    failedPairs: 2,
    correctedAt: null,
    correctedBy: null,
  };
  const input = (over: object = {}) => ({
    expectedUpdatedAt: "2026-10-20T05:05:00.000Z",
    pairs: 40,
    failedPairs: 3,
    reason: "Counted a rack twice",
    ...over,
  });

  it("keeps both counts in the audit, with the reason", async () => {
    model.findCheckIn.mockResolvedValueOnce(saved);
    const r = await svc.correctCheckIn("ci1", input(), QI, at("2026-10-20T06:00:00.000Z"));
    expect(r).toEqual({ id: "ci1", number: 1, time: "13:00" });
    expect(model.correctCheckIn).toHaveBeenCalledWith(
      "ci1",
      saved.updatedAt,
      expect.objectContaining({
        correctedById: "qi1",
        correctionReason: "Counted a rack twice",
        pairs: 40,
        failedPairs: 3,
      }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "production.checkin.correct",
        before: { pairs: 42, failedPairs: 2 },
        after: { pairs: 40, failedPairs: 3, reason: "Counted a rack twice" },
      }),
    );
  });

  it("only on the same Manila day", async () => {
    model.findCheckIn.mockResolvedValueOnce(saved);
    await expect(
      svc.correctCheckIn("ci1", input(), QI, at("2026-10-20T16:30:00.000Z")),
    ).rejects.toMatchObject({
      status: 409,
      message: "A batch can only be corrected on the same day. This one was on Tue, 20 Oct.",
    });
  });

  it("is 409 STALE when someone corrected it first", async () => {
    model.findCheckIn.mockResolvedValueOnce({
      ...saved,
      updatedAt: at("2026-10-20T05:40:00.000Z"),
      correctedAt: at("2026-10-20T05:40:00.000Z"),
      correctedBy: { name: "Lea Santos" },
    });
    await expect(
      svc.correctCheckIn("ci1", input(), QI, at("2026-10-20T06:00:00.000Z")),
    ).rejects.toMatchObject({
      code: "STALE",
      message: "This batch was already corrected by Lea Santos at 13:40. Refresh to see it.",
    });
  });
});

describe("day plans on the calendar (Phase 30E-2, D-114, D-115)", () => {
  const now = at("2026-10-21T02:00:00.000Z"); // Wed 21 Oct, 10:00 Manila
  const input = {
    rollsPlanned: 5,
    quota: 128,
    suggestedQuota: 125,
    intervalMinutes: 240,
    shiftStart: "08:00",
    shiftEnd: "17:00",
    expectedUpdatedAt: null,
  };

  it("plans a new weekday and audits it in the same tx", async () => {
    model.findDayPlan.mockResolvedValueOnce(null);
    expect(await svc.saveDayPlan("2026-10-22", input, FM, now)).toEqual({
      saved: true,
      day: "2026-10-22",
    });
    expect(model.insertDayPlan).toHaveBeenCalledWith(
      "2026-10-22",
      expect.objectContaining({
        kind: "PLANNED",
        rollsPlanned: 5,
        quota: 128,
        intervalMinutes: 240,
      }),
      "fm1",
      now,
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "production.plan.set", entity: "DayPlan", before: null }),
    );
  });

  it("plans today too, until a batch is finished (A-36)", async () => {
    model.findDayPlan.mockResolvedValueOnce(null);
    await svc.saveDayPlan("2026-10-21", input, FM, now);
    expect(model.insertDayPlan).toHaveBeenCalledTimes(1);
    model.listCheckIns.mockResolvedValueOnce([{ id: "c1" }]);
    await expect(svc.saveDayPlan("2026-10-21", input, FM, now)).rejects.toMatchObject({
      status: 409,
      message: svc.TODAY_LOCKED,
    });
  });

  it("keeps an unplanned today open even when batches were finished before it had a plan", async () => {
    model.findDayPlan.mockResolvedValueOnce(null);
    model.listCheckIns.mockResolvedValue([{ id: "c1" }]);
    await svc.saveDayPlan("2026-10-21", input, FM, now);
    expect(model.insertDayPlan).toHaveBeenCalledTimes(1);
    model.listCheckIns.mockResolvedValue([]);
  });

  it("refuses weekends, past days and days more than three months ahead (D-105, A-40)", async () => {
    await expect(svc.saveDayPlan("2026-10-24", input, FM, now)).rejects.toMatchObject({
      status: 409,
      message: "Saturdays and Sundays can't be planned. The factory works Monday to Friday.",
    });
    await expect(svc.saveDayPlan("2026-10-20", input, FM, now)).rejects.toMatchObject({
      status: 409,
      message: "Tue, 20 Oct has passed, so its plan can't change.",
    });
    await expect(svc.saveDayPlan("2027-02-01", input, FM, now)).rejects.toMatchObject({
      status: 409,
      message: "Days can be planned up to Sun, 31 Jan.",
    });
    expect(model.insertDayPlan).not.toHaveBeenCalled();
  });

  it("answers STALE when the day changed since the dialog opened, naming who", async () => {
    await expect(svc.saveDayPlan("2026-10-22", input, FM, now)).rejects.toMatchObject({
      status: 409,
      code: "STALE",
      message: expect.stringContaining("Rodel Pascual changed Thu, 22 Oct"),
    });
    expect(model.insertDayPlan).not.toHaveBeenCalled();
    expect(model.updateDayPlan).not.toHaveBeenCalled();
  });

  it("changes a plan guarded by the updatedAt it saw, and skips one that wouldn't change", async () => {
    const seen = { ...input, expectedUpdatedAt: STAMP.toISOString() };
    await svc.saveDayPlan("2026-10-22", seen, FM, now);
    expect(model.updateDayPlan).toHaveBeenCalledWith(
      "p-2026-10-22",
      STAMP,
      expect.objectContaining({ rollsPlanned: 5, quota: 128 }),
      "fm1",
      now,
      "tx",
    );
    model.findDayPlan.mockResolvedValueOnce(plan("2026-10-22", { rollsPlanned: 5, quota: 128 }));
    expect(await svc.saveDayPlan("2026-10-22", seen, FM, now)).toEqual({
      saved: false,
      day: "2026-10-22",
    });
    expect(model.updateDayPlan).toHaveBeenCalledTimes(1);
  });

  it("refuses an old 2-hour interval only in the validator; the service saves what it's given", async () => {
    model.findDayPlan.mockResolvedValueOnce(null);
    await svc.saveDayPlan("2026-10-23", { ...input, intervalMinutes: null }, FM, now);
    expect(model.insertDayPlan).toHaveBeenCalledWith(
      "2026-10-23",
      expect.objectContaining({ intervalMinutes: null }),
      "fm1",
      now,
      "tx",
    );
  });

  it("marks a weekday Non-working / Holiday and undoes it", async () => {
    const seen = { expectedUpdatedAt: STAMP.toISOString() };
    await svc.markNonWorking("2026-10-23", seen, FM, now);
    expect(model.updateDayPlan).toHaveBeenCalledWith(
      "p-2026-10-23",
      STAMP,
      expect.objectContaining({ kind: "NON_WORKING", quota: null, shiftStart: null }),
      "fm1",
      now,
      "tx",
    );
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({ action: "production.plan.nonWorking" }),
    );
    model.findDayPlan.mockResolvedValueOnce(plan("2026-10-23", { kind: "NON_WORKING" }));
    expect(await svc.clearNonWorking("2026-10-23", seen, FM, now)).toEqual({
      saved: true,
      day: "2026-10-23",
    });
    expect(model.deleteDayPlan).toHaveBeenCalledWith("p-2026-10-23", STAMP, "tx");
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({ action: "production.plan.cleared" }),
    );
    await expect(svc.clearNonWorking("2026-10-23", seen, FM, now)).rejects.toMatchObject({
      status: 409,
      message: "Fri, 23 Oct isn't marked Non-working / Holiday.",
    });
  });

  it("shows the start-of-day notice on an unplanned weekday only (A-37)", async () => {
    model.findDayPlan.mockResolvedValueOnce(null);
    expect(await svc.planNoticeDue(now)).toBe(true);
    expect(await svc.planNoticeDue(now)).toBe(false);
    model.findDayPlan.mockResolvedValueOnce(plan("2026-10-21", { kind: "NON_WORKING" }));
    expect(await svc.planNoticeDue(now)).toBe(false);
    // Saturday 24 Oct: no notice, nothing to plan.
    expect(await svc.planNoticeDue(at("2026-10-24T02:00:00.000Z"))).toBe(false);
  });
});

describe("saveLunchBreak (C-3)", () => {
  const now = at("2026-10-21T02:00:00.000Z"); // Wed 21 Oct, 10:00 Manila

  it("saves the lunch break from tomorrow and audits it (C-3)", async () => {
    const r = await svc.saveLunchBreak({ startTime: "11:30", endTime: "12:30" }, FM, now);
    expect(r.effectiveFrom).toBe("2026-10-22");
    expect(model.insertLunchBreak).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: "11:30",
        endTime: "12:30",
        effectiveFrom: "2026-10-22",
        createdById: "fm1",
      }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "production.lunch.set" }),
    );
  });

  it("refuses a lunch outside the factory's hours, and allows no lunch", async () => {
    await expect(
      svc.saveLunchBreak({ startTime: "07:00", endTime: "08:00" }, FM, now),
    ).rejects.toMatchObject({ status: 422 });
    expect(model.insertLunchBreak).not.toHaveBeenCalled();
    await svc.saveLunchBreak({ startTime: null, endTime: null }, FM, now);
    expect(model.insertLunchBreak).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: null, endTime: null }),
      "tx",
    );
  });
});

describe("saveLunchBreak repeats (team QA, 2026-11-02)", () => {
  const now = at("2026-10-21T02:00:00.000Z");

  it("skips a lunch equal to tomorrow's, and a second No lunch break", async () => {
    expect(await svc.saveLunchBreak({ startTime: "11:00", endTime: "12:00" }, FM, now)).toEqual({
      saved: false,
      effectiveFrom: "2026-10-22",
    });
    model.listLunchBreaks.mockResolvedValueOnce([
      LUNCH,
      { ...LUNCH, id: "l3", startTime: null, endTime: null, effectiveFrom: "2026-10-22" },
    ]);
    expect(await svc.saveLunchBreak({ startTime: null, endTime: null }, FM, now)).toEqual({
      saved: false,
      effectiveFrom: "2026-10-22",
    });
    expect(model.insertLunchBreak).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

describe("ensureDefaultLunchBreak (A-4, Dylan 2026-10-24)", () => {
  it("is in force from the start on a new database, from tomorrow once batches were finished", async () => {
    model.countLunchBreaks.mockResolvedValueOnce(0);
    model.firstCheckInDay.mockResolvedValueOnce(null);
    expect(await svc.ensureDefaultLunchBreak("tx" as never, at(B1))).toBe(true);
    expect(model.insertLunchBreak).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startTime: "11:00",
        endTime: "12:00",
        effectiveFrom: "2000-01-01",
      }),
      "tx",
    );
    model.countLunchBreaks.mockResolvedValueOnce(0);
    model.firstCheckInDay.mockResolvedValueOnce("2026-10-01");
    await svc.ensureDefaultLunchBreak("tx" as never, at(B1));
    expect(model.insertLunchBreak).toHaveBeenLastCalledWith(
      expect.objectContaining({ effectiveFrom: "2026-10-21" }),
      "tx",
    );
    model.countLunchBreaks.mockResolvedValueOnce(1);
    expect(await svc.ensureDefaultLunchBreak("tx" as never, at(B1))).toBe(false);
  });
});

describe("productionDays (D-086, D-008, C-41)", () => {
  /** Every key at any depth, to prove the day rows never carry a person. */
  function keysDeep(value: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        out.add(k);
        keysDeep(v, out);
      }
    return out;
  }

  it("totals each day's passed pairs against the quota, explains a short day and names nobody", async () => {
    model.listDayPlans.mockResolvedValueOnce([plan("2026-10-19", { quota: 85, rollsPlanned: 3 })]);
    rolls.rollsScannedByDay.mockResolvedValueOnce(new Map([["2026-10-19", 2]]));
    model.listCheckIns.mockResolvedValueOnce(
      ["05:00", "09:00"].map((t, i) => ({
        id: `c${i}`,
        day: at("2026-10-19T00:00:00.000Z"),
        slotAt: at(`2026-10-19T${t}:00.000Z`),
        enteredAt: at(`2026-10-19T${t}:05.000Z`),
        enteredBy: { name: "Lea Santos" },
        pairs: 40,
        failedPairs: 2,
      })),
    );
    const r = await svc.productionDays("2026-10-18", "2026-10-19", at("2026-10-20T04:00:00.000Z"));
    // Sunday 18 Oct isn't a working day and had no batches, so it is left out.
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-19"]);
    expect(r.days[0]).toMatchObject({
      batches: 2,
      finishedBatches: 2,
      missed: 0,
      full: true,
      finished: 80,
      failed: 4,
      passed: 76,
      quota: 85,
      rollsPlanned: 3,
      rollsScanned: 2,
      constructorsPresent: 14,
      shortfall: "Below quota by 9 pairs. 2 of 16 Shoe Constructors were absent.",
    });
    const keys = keysDeep(r);
    for (const k of ["userId", "name", "email", "enteredBy", "enteredById", "createdBy", "actor"])
      expect(keys.has(k)).toBe(false);
  });
});

describe("productionDays before any batch", () => {
  it("shows no days until the first batch is finished, so nothing reads as missed", async () => {
    model.firstCheckInDay.mockResolvedValueOnce(null);
    expect((await svc.productionDays("2026-10-12", "2026-10-19")).days).toEqual([]);
    model.firstCheckInDay.mockResolvedValueOnce("2026-10-16");
    const r = await svc.productionDays("2026-10-12", "2026-10-19", at("2026-10-20T04:00:00Z"));
    // Saturday 17 and Sunday 18 Oct aren't working days (D-105).
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-16", "2026-10-19"]);
  });
});

describe("productionToday (D-008, C-28)", () => {
  it("shows each batch with where it stands and when Finish batch opens", async () => {
    const r = await svc.productionToday(QI, at("2026-10-20T03:30:00.000Z")); // 11:30, lunch
    expect(r.rows.map((b) => [b.number, b.startTime, b.time, b.state])).toEqual([
      [1, "08:00", "13:00", "IN_PROGRESS"],
      [2, "13:00", "17:00", "UPCOMING"],
    ]);
    expect(r.rows[0]).toMatchObject({
      pausedForLunch: true,
      canFinishNow: false,
      finishOpensAt: "12:50",
    });
    expect(r.canEnter).toBe(true);
    expect(r).toMatchObject({ plan: "2 rolls · every 4 h", planNeeded: false, nonWorking: false });
  });

  it("has no batches without a plan, and asks the Floor Manager to plan (D-114, A-37)", async () => {
    model.listDayPlans.mockResolvedValueOnce([]);
    const r = await svc.productionToday(QI, at("2026-10-20T03:30:00.000Z"));
    expect(r).toMatchObject({ rows: [], workingDay: false, planNeeded: true, plan: null });
    model.listDayPlans.mockResolvedValueOnce([plan("2026-10-20", { kind: "NON_WORKING" })]);
    const off = await svc.productionToday(QI, at("2026-10-20T03:30:00.000Z"));
    expect(off).toMatchObject({ rows: [], nonWorking: true, planNeeded: false });
  });
});

describe("capturePlan (Phase 30D, D-118)", () => {
  it("shows today and the next planned days, five in all, with rolls planned and scanned", async () => {
    model.listDayPlans.mockResolvedValueOnce([
      plan("2026-11-04", { rollsPlanned: 15 }),
      plan("2026-11-05", { rollsPlanned: 12 }),
      plan("2026-11-06", { kind: "NON_WORKING", rollsPlanned: null }),
      plan("2026-11-09", { rollsPlanned: 10 }),
      plan("2026-11-10", { rollsPlanned: null }),
      plan("2026-11-11", { rollsPlanned: 8 }),
      plan("2026-11-12", { rollsPlanned: 9 }),
    ]);
    rolls.rollsScannedByDay.mockResolvedValueOnce(new Map([["2026-11-04", 3]]));
    // Wednesday 4 Nov 2026, 10:00 in Manila.
    const days = await svc.capturePlan(new Date("2026-11-04T02:00:00.000Z"));
    expect(model.listDayPlans).toHaveBeenLastCalledWith("2026-11-04", "2027-02-12");
    expect(rolls.rollsScannedByDay).toHaveBeenLastCalledWith("2026-11-04", "2026-11-04");
    expect(days.map((d) => [d.day, d.planned, d.scanned])).toEqual([
      ["2026-11-04", 15, 3],
      ["2026-11-05", 12, 0],
      ["2026-11-09", 10, 0],
      ["2026-11-10", null, 0],
      ["2026-11-11", 8, 0],
    ]);
    expect(days[0]).toMatchObject({ isToday: true, kind: "PLANNED", label: "Wed, 4 Nov" });
  });

  it("keeps today on the counter when it isn't planned", async () => {
    model.listDayPlans.mockResolvedValueOnce([plan("2026-11-05", { rollsPlanned: 12 })]);
    const days = await svc.capturePlan(new Date("2026-11-04T02:00:00.000Z"));
    expect(days[0]).toMatchObject({ day: "2026-11-04", kind: "NOT_PLANNED", planned: null });
    expect(days).toHaveLength(2);
  });
});
