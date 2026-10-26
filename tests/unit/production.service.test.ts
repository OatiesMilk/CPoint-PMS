import { beforeEach, describe, expect, it, vi } from "vitest";

// Batches service (Phase 27, D-097 to D-099): finishing a batch, corrections, the schedule, the
// one daily quota and the lunch break.

const SCHEDULE = {
  id: "sch1",
  shiftStart: "08:00",
  shiftEnd: "17:00",
  intervalMinutes: 240,
  workingDays: [1, 2, 3, 4, 5, 6],
  effectiveFrom: "2000-01-01",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  createdById: null,
  createdBy: null,
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
  listSchedules: vi.fn(async () => [SCHEDULE]),
  countSchedules: vi.fn(async () => 1),
  insertSchedule: vi.fn(async (d: object) => ({ id: "sch2", ...d })),
  listLunchBreaks: vi.fn(async () => [LUNCH] as unknown[]),
  countLunchBreaks: vi.fn(async () => 1),
  insertLunchBreak: vi.fn(async (d: object) => ({ id: "l2", ...d })),
  listQuotas: vi.fn(async () => [] as unknown[]),
  insertQuota: vi.fn(async (d: object) => ({ id: "q1", ...d })),
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
  markRollsUsed: vi.fn(async (_tx: unknown, ids: string[]) => ids.map((id) => `LR-MLT-${id}`)),
  unmarkRollsUsed: vi.fn(async (_tx: unknown, ids: string[]) => ids.map((id) => `LR-MLT-${id}`)),
  rollsToTick: vi.fn(async (): Promise<unknown[]> => []),
  rollsUsedByCheckIn: vi.fn(async () => new Map<string, { id: string; code: string }[]>()),
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
    expect(r).toEqual({ id: "ci1", number: 1, time: "13:00", usedRolls: [] });
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

  it("ticks the rolls fully used in the same transaction and names them in the audit (Phase 30A)", async () => {
    const r = await svc.saveCheckIn(
      { slotAt: B1, pairs: "42", failedPairs: 0, usedRollIds: ["001", "002"] },
      QI,
      at("2026-10-20T05:05:00.000Z"),
    );
    expect(rolls.markRollsUsed).toHaveBeenCalledWith(
      "tx",
      ["001", "002"],
      { checkInId: "ci1", label: expect.stringMatching(/^Batch 1 /) },
      QI,
      at("2026-10-20T05:05:00.000Z"),
    );
    expect(r.usedRolls).toEqual(["LR-MLT-001", "LR-MLT-002"]);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        after: expect.objectContaining({ rollsFullyUsed: ["LR-MLT-001", "LR-MLT-002"] }),
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
    expect(rolls.markRollsUsed).toHaveBeenCalledWith(
      "tx",
      [],
      expect.anything(),
      QI,
      expect.any(Date),
    );
    expect(rolls.unmarkRollsUsed).toHaveBeenCalledWith(
      "tx",
      [],
      expect.anything(),
      QI,
      expect.any(Date),
    );
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

  it("ticks and unticks rolls against what this batch ticked, with the reason (Phase 30A)", async () => {
    model.findCheckIn.mockResolvedValueOnce(saved);
    rolls.rollsUsedByCheckIn.mockResolvedValueOnce(
      new Map([
        [
          "ci1",
          [
            { id: "a", code: "LR-MLT-00a" },
            { id: "b", code: "LR-MLT-00b" },
          ],
        ],
      ]),
    );
    await svc.correctCheckIn(
      "ci1",
      input({ usedRollIds: ["b", "c"] }),
      QI,
      at("2026-10-20T06:00:00.000Z"),
    );
    expect(rolls.unmarkRollsUsed).toHaveBeenCalledWith(
      "tx",
      ["a"],
      expect.objectContaining({ checkInId: "ci1", reason: "Counted a rack twice" }),
      QI,
      expect.any(Date),
    );
    expect(rolls.markRollsUsed).toHaveBeenCalledWith(
      "tx",
      ["c"],
      expect.objectContaining({ checkInId: "ci1" }),
      QI,
      expect.any(Date),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        before: expect.objectContaining({ rollsFullyUsed: ["LR-MLT-00a", "LR-MLT-00b"] }),
        after: expect.objectContaining({ rollsTicked: ["LR-MLT-c"], rollsUnticked: ["LR-MLT-a"] }),
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

describe("saveSchedule, saveQuota and saveLunchBreak (D-083, D-085, D-097, D-099)", () => {
  const now = at("2026-10-21T02:00:00.000Z"); // Wed 21 Oct, 10:00 Manila

  it("applies a schedule change from tomorrow, and accepts once at the end of the day", async () => {
    const r = await svc.saveSchedule(
      { shiftStart: "07:00", shiftEnd: "16:00", intervalMinutes: null, workingDays: [6, 1, 1] },
      FM,
      now,
    );
    expect(r.effectiveFrom).toBe("2026-10-22");
    expect(model.insertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        intervalMinutes: null,
        workingDays: [1, 6],
        effectiveFrom: "2026-10-22",
      }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "production.schedule.set" }),
    );
  });

  it("applies a first quota from today and a change from tomorrow (Dylan 5A)", async () => {
    model.listQuotas.mockResolvedValueOnce([]);
    expect(await svc.saveQuota({ pairs: 128, suggestedPairs: 125 }, FM, now)).toEqual({
      saved: true,
      effectiveFrom: "2026-10-21",
    });
    expect(model.insertQuota).toHaveBeenLastCalledWith(
      expect.objectContaining({ pairs: 128, suggestedPairs: 125, effectiveFrom: "2026-10-21" }),
      "tx",
    );
    model.listQuotas.mockResolvedValueOnce([{ pairs: 128, effectiveFrom: "2026-10-21" }]);
    expect(await svc.saveQuota({ pairs: 135, suggestedPairs: null }, FM, now)).toEqual({
      saved: true,
      effectiveFrom: "2026-10-22",
    });
    expect(recordAudit).toHaveBeenLastCalledWith(
      "tx",
      expect.objectContaining({
        action: "production.quota.set",
        before: { pairs: 128 },
      }),
    );
  });

  it("skips a quota that wouldn't change", async () => {
    model.listQuotas.mockResolvedValueOnce([{ pairs: 128, effectiveFrom: "2026-10-01" }]);
    expect(await svc.saveQuota({ pairs: 128 }, FM, now)).toEqual({
      saved: false,
      effectiveFrom: "2026-10-22",
    });
    expect(model.insertQuota).not.toHaveBeenCalled();
  });

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

  it("refuses a lunch outside tomorrow's shift, and allows no lunch", async () => {
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
    model.listQuotas.mockResolvedValueOnce([{ pairs: 85, effectiveFrom: "2026-10-01" }]);
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
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-16", "2026-10-17", "2026-10-19"]);
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
  });
});

describe("ensureDefaultSchedule (Dylan 2B)", () => {
  it("creates 08:00 to 17:00 every 4 hours, Monday to Saturday, only once", async () => {
    model.countSchedules.mockResolvedValueOnce(0);
    expect(await svc.ensureDefaultSchedule("tx" as never)).toBe(true);
    expect(model.insertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        shiftStart: "08:00",
        shiftEnd: "17:00",
        intervalMinutes: 240,
        workingDays: [1, 2, 3, 4, 5, 6],
        createdById: null,
      }),
      "tx",
    );
    model.countSchedules.mockResolvedValueOnce(1);
    expect(await svc.ensureDefaultSchedule("tx" as never)).toBe(false);
  });
});
