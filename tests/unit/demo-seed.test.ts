import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { fn: string; rollId?: string; now: Date; classKeys?: string[]; by?: string }[] = [];
let nextRoll = 0;
const svc = {
  startRoll: vi.fn(async (_v: unknown, actor: { id: string }, now: Date) => {
    nextRoll += 1;
    const id = `r${nextRoll}`;
    calls.push({ fn: "startRoll", rollId: id, now, by: actor.id });
    return { id, code: `R-2026-${String(nextRoll).padStart(4, "0")}` };
  }),
  finishRoll: vi.fn(async (rollId: string, actor: { id: string }, now: Date) => {
    calls.push({ fn: "finishRoll", rollId, now, by: actor.id });
  }),
  cancelRoll: vi.fn(async (rollId: string, _input: unknown, actor: { id: string }, now: Date) => {
    calls.push({ fn: "cancelRoll", rollId, now, by: actor.id });
  }),
  ingestScan: vi.fn(
    async (
      input: { rollId: string; detections: { classKey: string }[] },
      origin: { kind?: string; userId?: string },
      now: Date,
    ) => {
      calls.push({
        fn: "scan",
        by: origin.userId,
        rollId: input.rollId,
        now,
        classKeys: input.detections.map((d) => d.classKey),
      });
      // The unknown class is rejected, as the real decision engine does (A-12).
      const unknown = input.detections.some((d) => d.classKey === "sim-unknown");
      return {
        scanId: `s${calls.length}`,
        rollId: input.rollId,
        verdict: unknown ? "REJECT" : "PASS",
      };
    },
  ),
};
const mocks = {
  countRolls: vi.fn(async () => 0),
  // Each item is known by its code, so a movement shows which item it moved.
  findInventoryItemBySku: vi.fn(async (sku: string) => ({ id: sku })),
  listActiveSuppliers: vi.fn(async () => [{ id: "sp1", name: "Supplier" }]),
  listDefectTypes: vi.fn(async () => [
    { id: "d1", key: "crease", label: "Crease", isActive: true, outcome: "USABLE" },
    { id: "d2", key: "cut", label: "Cut", isActive: true, outcome: "NOT_ACCEPTED" },
    { id: "d3", key: "dirt", label: "Dirt", isActive: false, outcome: "NOT_ACCEPTED" },
  ]),
  findUserByEmail: vi.fn(async (email: string) => ({
    id: email,
    role: email.startsWith("inspector") ? "QUALITY_INSPECTOR" : "FLOOR_MANAGER",
    isActive: true,
  })),
};

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/lib/leather-scan", async (orig) => ({
  ...(await orig<typeof import("@/server/lib/leather-scan")>()),
  renderLeatherImage: vi.fn(async () => Buffer.from([0xff, 0xd8, 0xff])),
}));
vi.mock("@/server/models/roll.model", () => ({
  countRolls: mocks.countRolls,
}));
vi.mock("@/server/models/inventory.model", () => ({
  findInventoryItemBySku: mocks.findInventoryItemBySku,
  findInventoryItem: vi.fn(async (id: string) => ({ id, quantityOnHand: 20 })),
}));
vi.mock("@/server/models/reference-data.model", () => ({
  listActiveSuppliers: mocks.listActiveSuppliers,
  listDefectTypes: mocks.listDefectTypes,
  ensureSupplier: vi.fn(async (s: { name: string }) => ({ id: `sup-${s.name}` })),
}));
vi.mock("@/server/models/user.model", () => ({ findUserByEmail: mocks.findUserByEmail }));
const setCameraOperator = vi.fn(async () => ({}));
vi.mock("@/server/services/camera.service", () => ({ setCameraOperator }));
vi.mock("@/server/services/roll.service", () => svc);
const inventory = { createItem: vi.fn(async () => ({ id: "item" })) };
vi.mock("@/server/services/inventory.service", () => inventory);
const stockUpdates = { saveStockUpdate: vi.fn(async () => ({ id: "u", items: 1 })) };
vi.mock("@/server/services/stock-update.service", () => stockUpdates);
// Twelve demo constructors, as the bootstrap creates (D-081).
const roster = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `c${i + 1}`, role: "SHOE_CONSTRUCTOR" })),
  { id: "fm", role: "FLOOR_MANAGER" },
];
// Remembers what was saved, so the check-ins read the day's real worker count (D-080).
const savedPresent = new Map<string, number>();
const attendance = {
  getAttendanceDay: vi.fn(async (day: string) => ({
    updatedAt: null,
    roster,
    workforce: savedPresent.has(day)
      ? {
          taken: true,
          constructorsPresent: savedPresent.get(day),
          constructorsOnRoster: roster.filter((p) => p.role === "SHOE_CONSTRUCTOR").length,
          othersPresent: 1,
        }
      : {
          taken: false,
          constructorsPresent: null,
          constructorsOnRoster: roster.filter((p) => p.role === "SHOE_CONSTRUCTOR").length,
          othersPresent: null,
        },
  })),
  saveAttendanceDay: vi.fn(
    async (
      day: string,
      input: { marks: { userId: string; present: boolean }[] },
      _actor?: unknown,
      _when?: Date,
    ) => {
      savedPresent.set(
        day,
        input.marks.filter((m) => m.present && m.userId.startsWith("c")).length,
      );
    },
  ),
};
const production = {
  saveQuota: vi.fn(async () => ({ saved: true, effectiveFrom: "2026-09-28" })),
  saveCheckIn: vi.fn(async () => ({ id: "ci", number: 1, time: "13:00" })),
};
vi.mock("@/server/services/production.service", () => production);
vi.mock("@/server/services/attendance.service", () => attendance);
vi.mock("@/server/services/scan-ingest.service", () => ({ ingestScan: svc.ingestScan }));

const { mulberry32, seedDemoWeek, preparationMs, PREPARATION_HOURS, DEMO_QUOTA } =
  await import("@/server/services/demo-seed.service");
const { UNKNOWN_CLASS } = await import("@/server/lib/leather-scan");

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  nextRoll = 0;
  savedPresent.clear();
});

describe("mulberry32", () => {
  it("gives the same sequence for the same seed, in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(43)()).not.toBe(xs[0]);
  });
});

describe("preparation times (D-082)", () => {
  it("stay in range", () => {
    const random = mulberry32(7);
    const [lo, hi] = PREPARATION_HOURS;
    for (let i = 0; i < 200; i++) {
      const ms = preparationMs(random);
      expect(ms).toBeGreaterThanOrEqual(lo * 3_600_000);
      expect(ms).toBeLessThanOrEqual(hi * 3_600_000);
    }
  });
});

describe("seedDemoWeek", () => {
  const now = new Date("2026-10-03T08:00:00.000Z"); // Saturday 16:00 in Manila

  it("never runs on a database that already has rolls", async () => {
    mocks.countRolls.mockResolvedValueOnce(3);
    expect(await seedDemoWeek({ now })).toEqual({ seeded: false, reason: "rolls already exist" });
    expect(svc.startRoll).not.toHaveBeenCalled();
  });

  it("needs the demo users", async () => {
    mocks.findUserByEmail.mockResolvedValueOnce(null as never);
    expect(await seedDemoWeek({ now })).toMatchObject({ seeded: false });
  });

  it("replays each roll forward in time, never past now", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    expect(result).toMatchObject({ seeded: true });
    const byRoll = new Map<string, Date[]>();
    for (const c of calls) byRoll.set(c.rollId!, [...(byRoll.get(c.rollId!) ?? []), c.now]);
    expect(byRoll.size).toBeGreaterThan(8);
    for (const times of byRoll.values()) {
      for (let i = 1; i < times.length; i++)
        expect(times[i].getTime()).toBeGreaterThanOrEqual(times[i - 1].getTime());
      expect(times.at(-1)!.getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it.each([
    ["Saturday afternoon", now],
    ["Monday before the first shift", new Date("2026-10-04T23:30:00.000Z")],
  ])("ends on the newest roll's last section, an unknown class (%s)", async (_label, at) => {
    await seedDemoWeek({ now: at, seed: 1 });
    const scans = calls.filter((c) => c.fn === "scan");
    // Ten sections a roll (D-082): small, but every roll has a full set.
    expect(scans.length).toBeGreaterThanOrEqual(80);
    expect(scans.at(-1)!.classKeys).toEqual([UNKNOWN_CLASS]);
  });

  it("captures every section on a constructor's phone with the real model, ten a roll (Phase 26)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    const inputs = svc.ingestScan.mock.calls.map(
      (c) => c[0] as unknown as { source: string; modelVersion: string; rollId: string },
    );
    expect(new Set(inputs.map((i) => i.source))).toEqual(new Set(["PHONE"]));
    expect(new Set(inputs.map((i) => i.modelVersion))).toEqual(new Set(["yolo-v1-1d729fb0"]));
    const perRoll = new Map<string, number>();
    for (const i of inputs) perRoll.set(i.rollId, (perRoll.get(i.rollId) ?? 0) + 1);
    expect(Math.max(...perRoll.values())).toBe(10);
    for (const [, origin] of svc.ingestScan.mock.calls)
      expect(origin).toMatchObject({ kind: "website" });
    // The System Admin gives the four demo capturers camera access (D-075, Phase 26).
    expect(setCameraOperator.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "constructor@cpoint.local",
      "arnel.bautista@cpoint.local",
      "jocelyn.reyes@cpoint.local",
      "rommel.delacruz@cpoint.local",
    ]);
    for (const call of setCameraOperator.mock.calls)
      expect((call as unknown[])[2]).toMatchObject({ id: "admin@cpoint.local" });
    // Only the capturers capture: never the QI or the Floor Manager (C-18).
    const capturers = new Set(svc.ingestScan.mock.calls.map(([, origin]) => origin.userId));
    expect(capturers.has("inspector@cpoint.local")).toBe(false);
    expect(capturers.has("manager@cpoint.local")).toBe(false);
  });

  it("has the Floor Manager enter the check-ins on the day the QI is absent (D-088)", async () => {
    roster.push({ id: "inspector@cpoint.local", role: "QUALITY_INSPECTOR" });
    try {
      await seedDemoWeek({ now, seed: 1 });
    } finally {
      roster.pop();
    }
    // 30 Sep: no constructor absent, the QI away.
    const away = attendance.saveAttendanceDay.mock.calls.find(([day]) => day === "2026-09-30")!;
    const marks = (away[1] as { marks: { userId: string; present: boolean }[] }).marks;
    expect(marks.filter((m) => !m.present).map((m) => m.userId)).toEqual([
      "inspector@cpoint.local",
    ]);
    const byDay = (t: Date) => new Date(t.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
    const checkIns = production.saveCheckIn.mock.calls as unknown as [
      unknown,
      { id: string },
      Date,
    ][];
    for (const [, actor, when] of checkIns)
      expect(actor.id).toBe(
        byDay(when) === "2026-09-30" ? "manager@cpoint.local" : "inspector@cpoint.local",
      );
    expect(checkIns.some(([, actor]) => actor.id === "manager@cpoint.local")).toBe(true);
  });

  it("draws defects from the active defect types only", async () => {
    await seedDemoWeek({ now, seed: 1 });
    const keys = new Set(calls.filter((c) => c.fn === "scan").flatMap((c) => c.classKeys ?? []));
    expect([...keys].sort()).toEqual(["crease", "cut", UNKNOWN_CLASS].sort());
  });

  it("seeds nothing when no defect type is active", async () => {
    mocks.listDefectTypes.mockResolvedValueOnce([]);
    expect(await seedDemoWeek({ now, seed: 1 })).toEqual({
      seeded: false,
      reason: "no active defect types",
    });
  });

  it("takes attendance for the working days before today, never today, with a few absences (D-081)", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    // Saturday 3 Oct: the demo week's days before it (Sunday skipped), oldest first.
    const days = attendance.saveAttendanceDay.mock.calls.map(([day]) => day);
    expect(days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(result).toMatchObject({ attendanceDays: 5 });
    const absent = attendance.saveAttendanceDay.mock.calls.map(
      ([, input]) =>
        (input as { marks: { present: boolean }[] }).marks.filter((m) => !m.present).length,
    );
    // The newest days of the pattern: none, 1, 5, none, 3, 2 (oldest first).
    expect(absent).toEqual([1, 5, 0, 3, 2]);
    for (const [, , actor, when] of attendance.saveAttendanceDay.mock.calls) {
      expect(actor).toMatchObject({ role: "FLOOR_MANAGER" });
      expect((when as Date).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it("starts and finishes each roll at Capture, leaves the newest open and has the FM cancel one (Phase 26)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    const started = calls.filter((c) => c.fn === "startRoll");
    const finished = calls.filter((c) => c.fn === "finishRoll");
    expect(finished.length).toBeGreaterThan(5);
    // Whoever started a roll finishes it.
    for (const f of finished) expect(f.by).toBe(started.find((s) => s.rollId === f.rollId)!.by);
    // One roll cancelled by the Floor Manager, with a reason; it has no shots.
    expect(svc.cancelRoll).toHaveBeenCalledTimes(1);
    const [cancelledId, input, actor] = svc.cancelRoll.mock.calls[0] as unknown as [
      string,
      { by: string; reason: string },
      { id: string },
    ];
    expect(input).toMatchObject({ by: "manager", reason: expect.stringMatching(/wrong supplier/) });
    expect(actor.id).toBe("manager@cpoint.local");
    expect(calls.some((c) => c.fn === "scan" && c.rollId === cancelledId)).toBe(false);
    // The newest roll with shots stays open, so Capture opens on a roll.
    const closed = new Set([...finished.map((f) => f.rollId), cancelledId]);
    expect(started.filter((s) => !closed.has(s.rollId))).toHaveLength(1);
    // The leather rolls laid out are entered as Used on the next stock update (Phase 29).
    const leatherUsed = (
      stockUpdates.saveStockUpdate.mock.calls as unknown as [
        { lines: { itemId: string; used?: number }[] },
      ][]
    ).flatMap(([b]) => b.lines.filter((l) => l.itemId.startsWith("LR-")).map((l) => l.used ?? 0));
    expect(leatherUsed.reduce((t, n) => t + n, 0)).toBeGreaterThan(5);
  });

  it("finishes the batches as the QI, with one late and one missed, and three short days that line up with the absences", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    expect(production.saveQuota).toHaveBeenCalledTimes(1);
    expect(production.saveQuota).toHaveBeenCalledWith(
      { pairs: DEMO_QUOTA, suggestedPairs: null },
      expect.anything(),
      expect.any(Date),
    );
    const calls = production.saveCheckIn.mock.calls as unknown as [
      { slotAt: string; pairs: number; failedPairs: number; notes?: string },
      { id: string },
      Date,
    ][];
    expect(result).toMatchObject({ checkIns: calls.length });
    for (const [input, actor, when] of calls) {
      expect(actor.id).toBe("inspector@cpoint.local");
      expect(when.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(when.getTime()).toBeGreaterThanOrEqual(new Date(input.slotAt).getTime());
    }
    const late = calls.filter(
      ([input, , when]) => when.getTime() - new Date(input.slotAt).getTime() > 30 * 60_000,
    );
    expect(late).toHaveLength(1);
    // Passed pairs per past day against the one quota (C-41).
    const byDay = new Map<string, { passed: number; slots: number }>();
    for (const [input] of calls) {
      const day = new Date(new Date(input.slotAt).getTime() + 8 * 3_600_000)
        .toISOString()
        .slice(0, 10);
      expect(input.failedPairs).toBeGreaterThanOrEqual(1);
      expect(input.failedPairs).toBeLessThanOrEqual(input.pairs);
      const d = byDay.get(day) ?? { passed: 0, slots: 0 };
      d.passed += input.pairs - input.failedPairs;
      d.slots += 1;
      byDay.set(day, d);
    }
    // Five past working days of two batches each (08:00–13:00 with lunch, 13:00–17:00), one
    // missed: 9.
    const past = [...byDay].filter(([day]) => day < "2026-10-03");
    expect(past.reduce((t, [, d]) => t + d.slots, 0)).toBe(9);
    const below = past.filter(([, d]) => d.passed < DEMO_QUOTA).map(([day]) => day);
    // 29 Sep (5 absent), 1 Oct (3 absent) and 2 Oct (2 absent).
    expect(below).toEqual(["2026-09-29", "2026-10-01", "2026-10-02"]);
  });

  it("keeps the same three short days with a 13th constructor on the roster (dev databases)", async () => {
    roster.unshift({ id: "c13", role: "SHOE_CONSTRUCTOR" });
    try {
      await seedDemoWeek({ now, seed: 1 });
    } finally {
      roster.shift();
    }
    const calls = production.saveCheckIn.mock.calls as unknown as [
      { slotAt: string; pairs: number; failedPairs: number },
    ][];
    const passed = new Map<string, number>();
    for (const [input] of calls) {
      const day = new Date(new Date(input.slotAt).getTime() + 8 * 3_600_000)
        .toISOString()
        .slice(0, 10);
      passed.set(day, (passed.get(day) ?? 0) + input.pairs - input.failedPairs);
    }
    const below = [...passed]
      .filter(([day, p]) => day < "2026-10-03" && p < DEMO_QUOTA)
      .map(([day]) => day);
    expect(below).toEqual(["2026-09-29", "2026-10-01", "2026-10-02"]);
  });

  it("enters the week's stock on Wednesday and Friday through Update stock (Phase 29, D-102)", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    expect(Object.keys(result).sort()).toEqual([
      "attendanceDays",
      "checkIns",
      "ms",
      "rolls",
      "scans",
      "seeded",
      "stockUpdates",
    ]);
    const saves = stockUpdates.saveStockUpdate.mock.calls as unknown as [
      {
        lines: {
          itemId: string;
          seenQuantity: number;
          added?: number;
          used?: number;
          correction?: number;
          reason?: string;
        }[];
      },
      { id: string },
      Date,
    ][];
    expect(result).toMatchObject({ stockUpdates: 2 });
    // Wednesday 30 Sep and Friday 2 Oct, 16:30 Manila, by the Floor Manager.
    expect(saves.map(([, actor, when]) => [actor.id, when.toISOString()])).toEqual([
      ["manager@cpoint.local", "2026-09-30T08:30:00.000Z"],
      ["manager@cpoint.local", "2026-10-02T08:30:00.000Z"],
    ]);
    const [wednesday, friday] = saves.map(([body]) => body.lines);
    // Every line says something, nothing below zero, and the deliveries came in as Added.
    for (const line of [...wednesday, ...friday]) {
      expect((line.added ?? 0) + (line.used ?? 0) + Math.abs(line.correction ?? 0)).toBeGreaterThan(
        0,
      );
      expect(line.seenQuantity - (line.used ?? 0) + (line.added ?? 0)).toBeGreaterThanOrEqual(0);
    }
    expect(wednesday.find((l) => l.itemId === "TH-001")).toMatchObject({ added: 14 });
    // Friday's sheet corrects the tacks after a recount, with a reason.
    expect(friday.find((l) => l.itemId === "NL-001")).toMatchObject({
      correction: -1,
      reason: expect.stringMatching(/Recounted/),
    });
    expect(wednesday.some((l) => l.correction)).toBe(false);
  });
});
