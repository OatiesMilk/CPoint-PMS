import { beforeEach, describe, expect, it, vi } from "vitest";

// Production progression service (Phase 23): check-ins, corrections, the schedule and quotas.

const ST = "0199a000-0000-7000-8000-0000000000a1"; // School Shoes
const TP = "0199a000-0000-7000-8000-0000000000a2"; // Topsider
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

const model = {
  listSchedules: vi.fn(async () => [SCHEDULE]),
  countSchedules: vi.fn(async () => 1),
  insertSchedule: vi.fn(async (d: object) => ({ id: "sch2", ...d })),
  listQuotas: vi.fn(async () => [] as unknown[]),
  insertQuota: vi.fn(async (d: object) => ({ id: "q1", ...d })),
  listCheckIns: vi.fn(async () => [] as unknown[]),
  findCheckIn: vi.fn(),
  firstCheckInDay: vi.fn(async () => "2026-10-01" as string | null),
  findCheckInBySlot: vi.fn(async () => null as unknown),
  insertCheckIn: vi.fn(async (d: object) => ({ id: "ci1", ...d })),
  correctCheckIn: vi.fn(async () => true),
};
const refs = {
  listActiveShoeTypes: vi.fn(async () => [
    { id: ST, name: "School Shoes" },
    { id: TP, name: "Topsider" },
  ]),
  listAllShoeTypes: vi.fn(async () => [
    { id: ST, name: "School Shoes", isActive: true },
    { id: TP, name: "Topsider", isActive: true },
  ]),
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

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/production.model", () => model);
vi.mock("@/server/models/reference-data.model", () => refs);
vi.mock("@/server/services/attendance.service", () => workforce);
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));

const svc = await import("@/server/services/production.service");

const QI = { id: "qi1", name: "Lea Santos", role: "QUALITY_INSPECTOR" as const };
const FM = { id: "fm1" };
// Tue 20 Oct 2026; 12:00 Manila = 04:00Z.
const NOON = "2026-10-20T04:00:00.000Z";
const at = (iso: string) => new Date(iso);
const counts = (school: unknown, top: unknown) => [
  { shoeTypeId: ST, pairs: school },
  { shoeTypeId: TP, pairs: top },
];

beforeEach(() => {
  vi.clearAllMocks();
  model.findCheckInBySlot.mockResolvedValue(null);
});

describe("saveCheckIn (D-084)", () => {
  it("saves the counts with the day's worker count read at save, and audits in the same tx", async () => {
    const r = await svc.saveCheckIn(
      { slotAt: NOON, counts: counts("22", 10), notes: "Press down 20 min" },
      QI,
      at("2026-10-20T04:05:00.000Z"),
    );
    expect(r).toEqual({ id: "ci1", time: "12:00" });
    expect(model.insertCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        day: "2026-10-20",
        slotAt: at(NOON),
        enteredById: "qi1",
        constructorsPresent: 14,
        constructorsOnRoster: 16,
        notes: "Press down 20 min",
        counts: [
          { shoeTypeId: ST, pairs: 22 },
          { shoeTypeId: TP, pairs: 10 },
        ],
      }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "production.checkin",
        after: expect.objectContaining({ counts: { "School Shoes": 22, Topsider: 10 } }),
      }),
    );
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
    await svc.saveCheckIn({ slotAt: NOON, counts: counts(0, 0) }, QI, at(NOON));
    expect(model.insertCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ constructorsPresent: null, constructorsOnRoster: null }),
      "tx",
    );
  });

  it("refuses a second entry of the same slot as 409 STALE, naming who and when", async () => {
    model.findCheckInBySlot.mockResolvedValueOnce({
      enteredBy: { name: "Lea Santos" },
      enteredAt: at("2026-10-20T04:04:00.000Z"),
    });
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: counts(1, 1) }, QI, at(NOON)),
    ).rejects.toMatchObject({
      status: 409,
      code: "STALE",
      message: "Lea Santos already entered the 12:00 check-in at 12:04. Refresh to see it.",
    });
    expect(model.insertCheckIn).not.toHaveBeenCalled();
  });

  it("turns a race on the unique slot into the same 409 STALE", async () => {
    model.insertCheckIn.mockRejectedValueOnce({ code: "P2002" });
    model.findCheckInBySlot
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ enteredBy: { name: "Lea Santos" }, enteredAt: at(NOON) });
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: counts(1, 1) }, QI, at(NOON)),
    ).rejects.toMatchObject({ status: 409, code: "STALE" });
  });

  it("refuses before the check-in opens and after midnight", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: counts(1, 1) }, QI, at("2026-10-20T03:00:00.000Z")),
    ).rejects.toMatchObject({
      status: 409,
      message: "The 12:00 check-in isn't open yet. You can enter it from 12:00.",
    });
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: counts(1, 1) }, QI, at("2026-10-20T16:00:00.000Z")),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("The check-in for Tue, 20 Oct closed at midnight."),
    });
  });

  it("refuses a time that isn't on the schedule", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: "2026-10-20T03:00:00.000Z", counts: counts(1, 1) }, QI, at(NOON)),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("no 11:00 check-in") });
  });

  it("puts each bad count under its own shoe type", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: counts("2.5", "3000") }, QI, at(NOON)),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["counts", ST],
          message:
            "Enter the School Shoes finished since 08:00 as a whole number, like 24. Enter 0 if none.",
        },
        {
          path: ["counts", TP],
          message: "Topsider can't be more than 2,000 pairs in one check-in. Check the number.",
        },
      ],
    });
  });

  it("asks for every active shoe type, so a type added mid-week isn't skipped", async () => {
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: [{ shoeTypeId: ST, pairs: 4 }] }, QI, at(NOON)),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["counts", TP] }] });
  });
});

describe("the Floor Manager covers only when no QI is present (D-088)", () => {
  const FM_ACTOR = { id: "fm1", name: "Ivy", role: "FLOOR_MANAGER" as const };

  it("saves the Floor Manager's count on a day no QI is present, marked as covering", async () => {
    workforce.qualityInspectorPresentOn.mockResolvedValueOnce(false);
    await svc.saveCheckIn({ slotAt: NOON, counts: counts(5, 5) }, FM_ACTOR, at(NOON));
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
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: counts(5, 5) }, FM_ACTOR, at(NOON)),
    ).rejects.toMatchObject({
      status: 403,
      message: "A Quality Inspector is present today, so they enter the check-ins.",
    });
    workforce.qualityInspectorPresentOn.mockResolvedValueOnce(null);
    await expect(
      svc.saveCheckIn({ slotAt: NOON, counts: counts(5, 5) }, FM_ACTOR, at(NOON)),
    ).rejects.toMatchObject({
      status: 403,
      message:
        "Take today's attendance first. You can enter check-ins only when it shows no Quality Inspector present.",
    });
    expect(model.insertCheckIn).not.toHaveBeenCalled();
  });

  it("never asks attendance for the QI, and refuses the Admin", async () => {
    await svc.saveCheckIn({ slotAt: NOON, counts: counts(1, 1) }, QI, at(NOON));
    expect(workforce.qualityInspectorPresentOn).not.toHaveBeenCalled();
    await expect(
      svc.saveCheckIn(
        { slotAt: NOON, counts: counts(1, 1) },
        { id: "ad1", role: "SYSTEM_ADMIN" },
        at(NOON),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("correctCheckIn", () => {
  const saved = {
    id: "ci1",
    day: at("2026-10-20T00:00:00.000Z"),
    slotAt: at(NOON),
    updatedAt: at("2026-10-20T04:05:00.000Z"),
    counts: [
      { shoeTypeId: ST, pairs: 22 },
      { shoeTypeId: TP, pairs: 10 },
    ],
    correctedAt: null,
    correctedBy: null,
  };

  it("keeps both values in the audit, with the reason", async () => {
    model.findCheckIn.mockResolvedValueOnce(saved);
    await svc.correctCheckIn(
      "ci1",
      {
        expectedUpdatedAt: "2026-10-20T04:05:00.000Z",
        counts: counts(20, 10),
        reason: "Counted a rack twice",
      },
      QI,
      at("2026-10-20T05:00:00.000Z"),
    );
    expect(model.correctCheckIn).toHaveBeenCalledWith(
      "ci1",
      saved.updatedAt,
      expect.objectContaining({ correctedById: "qi1", correctionReason: "Counted a rack twice" }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "production.checkin.correct",
        before: { counts: { "School Shoes": 22, Topsider: 10 } },
        after: { counts: { "School Shoes": 20, Topsider: 10 }, reason: "Counted a rack twice" },
      }),
    );
  });

  it("only on the same Manila day", async () => {
    model.findCheckIn.mockResolvedValueOnce(saved);
    await expect(
      svc.correctCheckIn(
        "ci1",
        {
          expectedUpdatedAt: "2026-10-20T04:05:00.000Z",
          counts: counts(20, 10),
          reason: "Late fix",
        },
        QI,
        at("2026-10-20T16:30:00.000Z"),
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: "A check-in can only be corrected on the same day. This one was for Tue, 20 Oct.",
    });
  });

  it("is 409 STALE when someone corrected it first", async () => {
    model.findCheckIn.mockResolvedValueOnce({
      ...saved,
      updatedAt: at("2026-10-20T04:40:00.000Z"),
      correctedAt: at("2026-10-20T04:40:00.000Z"),
      correctedBy: { name: "Lea Santos" },
    });
    await expect(
      svc.correctCheckIn(
        "ci1",
        {
          expectedUpdatedAt: "2026-10-20T04:05:00.000Z",
          counts: counts(20, 10),
          reason: "Recount",
        },
        QI,
        at("2026-10-20T05:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      code: "STALE",
      message: "This check-in was already corrected by Lea Santos at 12:40. Refresh to see it.",
    });
  });
});

describe("saveSchedule and saveQuotas (D-083, D-085)", () => {
  const now = at("2026-10-21T02:00:00.000Z"); // Wed 21 Oct, 10:00 Manila

  it("applies a schedule change from tomorrow", async () => {
    const r = await svc.saveSchedule(
      { shiftStart: "07:00", shiftEnd: "16:00", intervalMinutes: 120, workingDays: [6, 1, 1] },
      FM,
      now,
    );
    expect(r.effectiveFrom).toBe("2026-10-22");
    expect(model.insertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ workingDays: [1, 6], effectiveFrom: "2026-10-22" }),
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "production.schedule.set" }),
    );
  });

  it("applies a first quota from today and a change from tomorrow (Dylan 5A)", async () => {
    model.listQuotas.mockResolvedValueOnce([
      { shoeTypeId: TP, pairs: 40, effectiveFrom: "2026-10-01" },
    ]);
    await svc.saveQuotas(
      {
        quotas: [
          { shoeTypeId: ST, pairs: "110", suggestedPairs: 108 },
          { shoeTypeId: TP, pairs: 45, suggestedPairs: null },
        ],
      },
      FM,
      now,
    );
    expect(model.insertQuota.mock.calls.map(([d]) => d)).toEqual([
      expect.objectContaining({
        shoeTypeId: ST,
        pairs: 110,
        suggestedPairs: 108,
        effectiveFrom: "2026-10-21",
      }),
      expect.objectContaining({ shoeTypeId: TP, pairs: 45, effectiveFrom: "2026-10-22" }),
    ]);
  });

  it("skips a quota that wouldn't change, and names the shoe type in a bad one", async () => {
    model.listQuotas.mockResolvedValue([
      { shoeTypeId: TP, pairs: 40, effectiveFrom: "2026-10-01" },
    ]);
    expect(await svc.saveQuotas({ quotas: [{ shoeTypeId: TP, pairs: 40 }] }, FM, now)).toEqual({
      saved: 0,
    });
    await expect(
      svc.saveQuotas({ quotas: [{ shoeTypeId: TP, pairs: "0" }] }, FM, now),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["quotas", TP],
          message: "Enter the daily quota for Topsider as a whole number of pairs, at least 1.",
        },
      ],
    });
    model.listQuotas.mockResolvedValue([]);
  });
});

describe("productionDays (D-086, D-008)", () => {
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

  it("totals each day per shoe type against the quota, explains a short day and names nobody", async () => {
    model.listQuotas.mockResolvedValueOnce([
      { shoeTypeId: ST, pairs: 85, effectiveFrom: "2026-10-01" },
    ]);
    model.listCheckIns.mockResolvedValueOnce(
      ["04:00", "08:00", "09:00"].map((t, i) => ({
        id: `c${i}`,
        day: at("2026-10-19T00:00:00.000Z"),
        slotAt: at(`2026-10-19T${t}:00.000Z`),
        enteredAt: at(`2026-10-19T${t}:05.000Z`),
        enteredBy: { name: "Lea Santos" },
        counts: [
          { shoeTypeId: ST, pairs: 25 },
          { shoeTypeId: TP, pairs: 10 },
        ],
      })),
    );
    const r = await svc.productionDays("2026-10-18", "2026-10-19", at("2026-10-20T04:00:00.000Z"));
    // Sunday 18 Oct isn't a working day and had no check-ins, so it is left out.
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-19"]);
    expect(r.days[0]).toMatchObject({
      checkIns: 3,
      entered: 3,
      full: true,
      pairs: 105,
      quota: 85,
      constructorsPresent: 14,
      pairsPerConstructor: 7.5,
      shortfall: "Below quota by 10 pairs. 2 of 16 Shoe Constructors were absent.",
    });
    const keys = keysDeep(r);
    for (const k of ["userId", "name", "email", "enteredBy", "enteredById", "createdBy", "actor"])
      expect(keys.has(k)).toBe(false);
  });
});

describe("productionDays before any check-in", () => {
  it("shows no days until the first check-in is entered, so nothing reads as missed", async () => {
    model.firstCheckInDay.mockResolvedValueOnce(null);
    expect((await svc.productionDays("2026-10-12", "2026-10-19")).days).toEqual([]);
    model.firstCheckInDay.mockResolvedValueOnce("2026-10-16");
    const r = await svc.productionDays("2026-10-12", "2026-10-19", at("2026-10-20T04:00:00Z"));
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-16", "2026-10-17", "2026-10-19"]);
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
