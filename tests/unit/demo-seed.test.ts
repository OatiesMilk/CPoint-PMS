import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { fn: string; batchId?: string; now: Date; classKeys?: string[]; by?: string }[] = [];
let nextBatch = 0;
const svc = {
  createBatch: vi.fn(async (_v: unknown, _a: unknown, now: Date) => {
    nextBatch += 1;
    const id = `b${nextBatch}`;
    calls.push({ fn: "createBatch", batchId: id, now });
    return { id, code: `B-${nextBatch}` };
  }),
  transitionBatchStage: vi.fn(async (batchId: string, _i: unknown, _a: unknown, now: Date) => {
    calls.push({ fn: "transition", batchId, now });
  }),
  cancelBatch: vi.fn(),
  ingestScan: vi.fn(
    async (
      input: { batchId: string; detections: { classKey: string }[] },
      origin: { kind?: string; userId?: string },
      now: Date,
    ) => {
      calls.push({
        fn: "scan",
        by: origin.userId,
        batchId: input.batchId,
        now,
        classKeys: input.detections.map((d) => d.classKey),
      });
      // The unknown class is rejected, as the real decision engine does (A-12).
      const unknown = input.detections.some((d) => d.classKey === "sim-unknown");
      return {
        scanId: `s${calls.length}`,
        batchId: input.batchId,
        verdict: unknown ? "REJECT" : "PASS",
      };
    },
  ),
};
const mocks = {
  countBatches: vi.fn(async () => 0),
  // Each item is known by its code, so a movement shows which item it moved.
  findInventoryItemBySku: vi.fn(async (sku: string) => ({ id: sku })),
  listActiveShoeTypes: vi.fn(async () => [
    { id: "st1", name: "School Shoe" },
    { id: "st2", name: "Topsider" },
  ]),
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
vi.mock("@/server/models/batch.model", () => ({
  countBatches: mocks.countBatches,
}));
vi.mock("@/server/models/inventory.model", () => ({
  findInventoryItemBySku: mocks.findInventoryItemBySku,
}));
vi.mock("@/server/models/reference-data.model", () => ({
  listActiveShoeTypes: mocks.listActiveShoeTypes,
  listActiveSuppliers: mocks.listActiveSuppliers,
  listDefectTypes: mocks.listDefectTypes,
  ensureSupplier: vi.fn(),
}));
vi.mock("@/server/models/user.model", () => ({ findUserByEmail: mocks.findUserByEmail }));
const setCameraOperator = vi.fn(async () => ({}));
vi.mock("@/server/services/camera.service", () => ({ setCameraOperator }));
vi.mock("@/server/services/batch.service", () => svc);
const inventory = { createItem: vi.fn(async () => ({ id: "item" })), recordMovement: vi.fn() };
vi.mock("@/server/services/inventory.service", () => inventory);
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
          constructorsOnRoster: 12,
          othersPresent: 1,
        }
      : { taken: false, constructorsPresent: null, constructorsOnRoster: 12, othersPresent: null },
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
  saveQuotas: vi.fn(async () => ({ saved: 2 })),
  saveCheckIn: vi.fn(async () => ({ id: "ci", time: "12:00" })),
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
  nextBatch = 0;
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

  it("never runs on a database that already has batches", async () => {
    mocks.countBatches.mockResolvedValueOnce(3);
    expect(await seedDemoWeek({ now })).toEqual({ seeded: false, reason: "batches already exist" });
    expect(svc.createBatch).not.toHaveBeenCalled();
  });

  it("needs the demo users", async () => {
    mocks.findUserByEmail.mockResolvedValueOnce(null as never);
    expect(await seedDemoWeek({ now })).toMatchObject({ seeded: false });
  });

  it("replays each batch forward in time, never past now", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    expect(result).toMatchObject({ seeded: true });
    const byBatch = new Map<string, Date[]>();
    for (const c of calls) byBatch.set(c.batchId!, [...(byBatch.get(c.batchId!) ?? []), c.now]);
    expect(byBatch.size).toBeGreaterThan(8);
    for (const times of byBatch.values()) {
      for (let i = 1; i < times.length; i++)
        expect(times[i].getTime()).toBeGreaterThanOrEqual(times[i - 1].getTime());
      expect(times.at(-1)!.getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it.each([
    ["Saturday afternoon", now],
    ["Monday before the first shift", new Date("2026-10-04T23:30:00.000Z")],
  ])("ends on the newest batch's last section, an unknown class (%s)", async (_label, at) => {
    await seedDemoWeek({ now: at, seed: 1 });
    const scans = calls.filter((c) => c.fn === "scan");
    // Ten sections a roll (D-082): small, but every roll has a full set.
    expect(scans.length).toBeGreaterThanOrEqual(80);
    expect(scans.at(-1)!.classKeys).toEqual([UNKNOWN_CLASS]);
  });

  it("captures every section from the website camera with the real model, ten a roll (D-090)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    const inputs = svc.ingestScan.mock.calls.map(
      (c) => c[0] as unknown as { source: string; modelVersion: string; batchId: string },
    );
    expect(new Set(inputs.map((i) => i.source))).toEqual(new Set(["WEBCAM"]));
    expect(new Set(inputs.map((i) => i.modelVersion))).toEqual(new Set(["yolo-v1-1d729fb0"]));
    const perRoll = new Map<string, number>();
    for (const i of inputs) perRoll.set(i.batchId, (perRoll.get(i.batchId) ?? 0) + 1);
    expect(Math.max(...perRoll.values())).toBe(10);
    for (const [, origin] of svc.ingestScan.mock.calls)
      expect(origin).toMatchObject({ kind: "website" });
    // The demo constructor may also capture (D-075).
    expect(setCameraOperator).toHaveBeenCalledWith("constructor@cpoint.local", true, {
      id: "manager@cpoint.local",
      role: "FLOOR_MANAGER",
      isActive: true,
    });
  });

  it("has the Floor Manager capture and enter the check-ins on the day the QI is absent (D-088)", async () => {
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
    const scans = calls.filter((c) => c.fn === "scan");
    for (const scan of scans)
      expect(scan.by).toBe(
        byDay(scan.now) === "2026-09-30" ? "manager@cpoint.local" : "inspector@cpoint.local",
      );
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

  it("starts and finishes each roll, and never moves a stage (D-082)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    const actions = svc.transitionBatchStage.mock.calls.map(
      (c) => (c[1] as unknown as { action: string }).action,
    );
    expect(new Set(actions)).toEqual(new Set(["start", "finish"]));
    expect(actions.filter((a) => a === "finish").length).toBeGreaterThan(5);
  });

  it("enters check-ins as the QI, with one late and one missed, and three short days that line up with the absences", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    expect(production.saveQuotas).toHaveBeenCalledTimes(1);
    const calls = production.saveCheckIn.mock.calls as unknown as [
      { slotAt: string; counts: { shoeTypeId: string; pairs: number }[]; notes?: string },
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
    // Pairs per past day against the quota for School Shoes (st1).
    const byDay = new Map<string, { school: number; slots: number }>();
    for (const [input] of calls) {
      const day = new Date(new Date(input.slotAt).getTime() + 8 * 3_600_000)
        .toISOString()
        .slice(0, 10);
      const d = byDay.get(day) ?? { school: 0, slots: 0 };
      d.school += input.counts.find((c) => c.shoeTypeId === "st1")!.pairs;
      d.slots += 1;
      byDay.set(day, d);
    }
    // Five past working days of three check-ins each, one of them missed: 14.
    const past = [...byDay].filter(([day]) => day < "2026-10-03");
    expect(past.reduce((t, [, d]) => t + d.slots, 0)).toBe(14);
    const below = past.filter(([, d]) => d.school < DEMO_QUOTA.school).map(([day]) => day);
    // 29 Sep (5 absent), 1 Oct (3 absent) and 2 Oct (2 absent).
    expect(below).toEqual(["2026-09-29", "2026-10-01", "2026-10-02"]);
  });

  it("records the week's two later deliveries as plain stock IN, and nothing else (D-091)", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    expect(Object.keys(result).sort()).toEqual([
      "attendanceDays",
      "batches",
      "checkIns",
      "ms",
      "scans",
      "seeded",
    ]);
    const movements = inventory.recordMovement.mock.calls as unknown as [
      string,
      { type: string; quantity: number; reason: string },
      { id: string },
      Date,
    ][];
    // This test has one supplier, named "Supplier"; the deliveries name it.
    const later = movements
      .filter(([, input]) => input.reason === "Delivery from Supplier")
      .map(([sku, input, actor, when]) => [sku, input.type, input.quantity, actor.id, when]);
    expect(later).toEqual([
      ["TH-001", "IN", 4, "manager@cpoint.local", new Date("2026-09-29T06:00:00.000Z")],
      ["NL-001", "IN", 5, "manager@cpoint.local", new Date("2026-09-29T06:00:00.000Z")],
      ["LR-001", "IN", 2, "manager@cpoint.local", new Date("2026-10-01T03:00:00.000Z")],
      ["NL-001", "IN", 5, "manager@cpoint.local", new Date("2026-10-01T03:00:00.000Z")],
    ]);
  });
});
