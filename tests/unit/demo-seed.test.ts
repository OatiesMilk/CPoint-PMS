import { beforeEach, describe, expect, it, vi } from "vitest";
import { manilaToday } from "@/lib/format";

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
      // The unknown class is flagged, as the real decision engine does (D-011).
      const flagged = input.detections.some((d) => d.classKey === "sim-unknown");
      return {
        scanId: `s${calls.length}`,
        batchId: input.batchId,
        verdict: flagged ? "NEEDS_REVIEW" : "PASS",
      };
    },
  ),
};
const mocks = {
  countBatches: vi.fn(async () => 0),
  listOpenBatches: vi.fn(async () => []),
  findInventoryItemBySku: vi.fn(async () => ({ id: "item" })),
  findLiveOutcomes: vi.fn(async () => ({ rework: null, salvage: null })),
  listActiveShoeTypes: vi.fn(async () => [
    { id: "st1", name: "School Shoe" },
    { id: "st2", name: "Topsider" },
  ]),
  listActiveSuppliers: vi.fn(async () => [{ id: "sp1", name: "Supplier" }]),
  listDefectTypes: vi.fn(async () => [
    { id: "d1", key: "crease", label: "Crease", isActive: true, action: "REWORK" },
    { id: "d2", key: "cut", label: "Cut", isActive: true, action: "REJECT" },
    { id: "d3", key: "dirt", label: "Dirt", isActive: false, action: null },
  ]),
  findUserByEmail: vi.fn(async (email: string) => ({
    id: email,
    role: email.startsWith("inspector") ? "QUALITY_INSPECTOR" : "FLOOR_MANAGER",
    isActive: true,
    canRequestLeatherRolls: true,
  })),
};

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/lib/leather-scan", async (orig) => ({
  ...(await orig<typeof import("@/server/lib/leather-scan")>()),
  renderLeatherImage: vi.fn(async () => Buffer.from([0xff, 0xd8, 0xff])),
}));
vi.mock("@/server/models/batch.model", () => ({
  countBatches: mocks.countBatches,
  listOpenBatches: mocks.listOpenBatches,
}));
vi.mock("@/server/models/inventory.model", () => ({
  findInventoryItemBySku: mocks.findInventoryItemBySku,
}));
vi.mock("@/server/models/outcome.model", () => ({ findLiveOutcomes: mocks.findLiveOutcomes }));
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
vi.mock("@/server/services/inventory.service", () => ({
  createItem: vi.fn(async () => ({ id: "item" })),
  recordMovement: vi.fn(),
}));
vi.mock("@/server/services/rework.service", () => ({ moveReworkTicket: vi.fn() }));
vi.mock("@/server/services/salvage.service", () => ({
  assignSalvage: vi.fn(),
  discardSalvage: vi.fn(),
}));
const decideScan = vi.fn();
vi.mock("@/server/services/scan-decision.service", () => ({ decideScan }));
const procurement = {
  createRequest: vi.fn(async (_values: unknown, _actor: unknown, now: Date) => {
    calls.push({ fn: "request", batchId: "procurement", now });
    return { id: `pr${calls.length}`, code: "PR", alreadyRequested: [] };
  }),
  actOnRequest: vi.fn(async (_id: string, _input: unknown, _actor: unknown, now: Date) => {
    calls.push({ fn: "request", batchId: "procurement", now });
  }),
  decideRequest: vi.fn(async (_id: string, _input: unknown, _actor: unknown, now: Date) => {
    calls.push({ fn: "request", batchId: "procurement", now });
  }),
  orderRequest: vi.fn(async (_id: string, _input: unknown, _actor: unknown, now: Date) => {
    calls.push({ fn: "request", batchId: "procurement", now });
  }),
  recordDelivery: vi.fn(
    async (_id: string, _input: unknown, _files: unknown, _actor: unknown, now: Date) => {
      calls.push({ fn: "request", batchId: "procurement", now });
    },
  ),
  // The request decided item by item: two lines, the second one for an item that isn't the thread.
  getRequest: vi.fn(async () => ({
    code: "MR-2026-0001",
    lines: [
      {
        id: "line-a",
        inventoryItemId: "not-the-thread",
        decision: "APPROVED",
        itemName: "Black cowhide (school shoes)",
        unit: "roll",
      },
      {
        id: "line-b",
        inventoryItemId: "also-not-the-thread",
        decision: "APPROVED",
        itemName: "Shoe tacks, 12 mm",
        unit: "box",
      },
    ],
  })),
  addRemark: vi.fn(),
  setRequester: vi.fn(),
};
// Generated proof files: the real ones are drawn with sharp, which this test doesn't need.
vi.mock("@/server/lib/receipt-sample", () => ({
  renderReceiptImage: vi.fn(async () => Buffer.from([0xff, 0xd8, 0xff])),
  renderReceiptPdf: vi.fn(() => Buffer.from("%PDF-1.4")),
}));
vi.mock("@/server/services/procurement.service", () => procurement);
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
  ])("leaves the newest batch's last two sections for review (%s)", async (_label, at) => {
    await seedDemoWeek({ now: at, seed: 1 });
    const scans = calls.filter((c) => c.fn === "scan");
    // Ten sections a roll (D-082): small, but every roll has a full set.
    expect(scans.length).toBeGreaterThanOrEqual(80);
    expect(scans.slice(-2).map((c) => c.classKeys)).toEqual([[UNKNOWN_CLASS], [UNKNOWN_CLASS]]);
    expect(new Set(scans.slice(-2).map((c) => c.batchId)).size).toBe(1);
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
    // The constructor who orders leather may also capture (D-075).
    expect(setCameraOperator).toHaveBeenCalledWith("constructor@cpoint.local", true, {
      id: "manager@cpoint.local",
      role: "FLOOR_MANAGER",
      isActive: true,
      canRequestLeatherRolls: true,
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
    // Nobody decides a flagged scan that day: the QI does it the next morning (D-028).
    for (const [, , actor, when] of decideScan.mock.calls as unknown as [
      string,
      { expectedFinalVerdict: string | null },
      { id: string },
      Date,
    ][])
      if (actor.id === "inspector@cpoint.local") expect(byDay(when)).not.toBe("2026-09-30");
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

  it("decides flagged scans as the Quality Inspector only, never by override (D-028)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    // ingestScan's mock names each scan s<n>, where n counts every recorded call so far.
    const flaggedIds = new Set(
      calls.flatMap((c, i) =>
        c.fn === "scan" && c.classKeys?.includes("sim-unknown") ? [`s${i + 1}`] : [],
      ),
    );
    const onFlagged = decideScan.mock.calls.filter(([scanId]) => flaggedIds.has(scanId as string));
    expect(onFlagged.length).toBeGreaterThan(0);
    for (const [, input, actor] of onFlagged) {
      expect((actor as { id: string }).id).toBe("inspector@cpoint.local");
      expect(input).toMatchObject({ expectedFinalVerdict: null }); // a review, not an override
    }
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

  it("sends purchase requests through the services, forward in time and never past now", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    expect(result).toMatchObject({ seeded: true, requests: 9 });
    const times = calls.filter((c) => c.fn === "request").map((c) => c.now.getTime());
    expect(times.length).toBeGreaterThan(5);
    expect(Math.max(...times)).toBeLessThanOrEqual(now.getTime());
    expect(
      procurement.actOnRequest.mock.calls.map((c) => (c[1] as { action: string }).action),
    ).toEqual(expect.arrayContaining(["approve", "reject", "cancel"]));
    // Ordering and deliveries (D-041, D-042): every order names an active supplier and a date on
    // or after the day it was placed; every delivery carries at least one proof file.
    expect(procurement.orderRequest.mock.calls.length).toBeGreaterThanOrEqual(5);
    for (const [, input, , when] of procurement.orderRequest.mock.calls as unknown as [
      string,
      { supplierId: string; expectedDeliveryOn: string },
      unknown,
      Date,
    ][]) {
      expect(input.supplierId).toBeTruthy();
      expect(input.expectedDeliveryOn >= manilaToday(when)).toBe(true);
    }
    expect(procurement.recordDelivery).toHaveBeenCalledTimes(2);
    const deliveries = procurement.recordDelivery.mock.calls as unknown as [
      string,
      { lines: { quantity: number }[]; note?: string },
      { name: string }[],
    ][];
    expect(deliveries.map((d) => d[2].map((f) => f.name.split(".").pop()))).toEqual([
      ["jpg"],
      ["jpg", "pdf"],
    ]);
    // The second one is short: two of the four rolls came.
    expect(deliveries[1][1].lines.map((l) => l.quantity)).toEqual([2, 5]);
    // One request is cancelled by the Floor Manager after it was ordered, with a reason (D-043),
    // and one is raised by the Floor Manager (D-045).
    expect(
      procurement.actOnRequest.mock.calls.some(
        (c) =>
          (c[1] as { action: string; reason?: string }).action === "cancel" &&
          !!(c[1] as { reason?: string }).reason,
      ),
    ).toBe(true);
    expect(
      procurement.createRequest.mock.calls.some(
        (c) => (c[1] as { id: string }).id === "manager@cpoint.local",
      ),
    ).toBe(true);
    // One request is decided item by item (D-039): every line gets a decision, with a note.
    expect(procurement.decideRequest).toHaveBeenCalledTimes(1);
    const decided = procurement.decideRequest.mock.calls[0][1] as {
      note: string;
      lines: { lineId: string; decision: string }[];
    };
    expect(decided.lines.map((l) => l.lineId)).toEqual(["line-a", "line-b"]);
    expect(decided.lines.every((l) => l.decision === "APPROVED" || l.decision === "REJECTED")).toBe(
      true,
    );
    expect(decided.note).toMatch(/order/i);
  });
});
