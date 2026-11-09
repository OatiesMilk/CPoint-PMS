import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Detection } from "@/server/lib/leather-scan";

const calls: {
  fn: string;
  rollId?: string;
  now: Date;
  classKeys?: string[];
  by?: string;
  areaSqFt?: number;
  detections?: Detection[];
}[] = [];
/** The roll's share as the app works it out, set once the service is imported. */
let shareOf: (rollId: string) => number = () => 0;
let nextRoll = 0;
const svc = {
  addRolls: vi.fn(
    async (
      itemId: string,
      values: { rolls: { areaSqFt: number }[] },
      actor: { id: string },
      now: Date,
    ) => {
      const added = values.rolls.map((r) => {
        nextRoll += 1;
        const id = `r${nextRoll}`;
        calls.push({ fn: "addRoll", rollId: id, now, by: actor.id, areaSqFt: r.areaSqFt });
        return { id, code: `LR-${itemId}-${String(nextRoll).padStart(3, "0")}` };
      });
      return { added, quantityOnHand: added.length };
    },
  ),
  startRoll: vi.fn(async (id: string, actor: { id: string }, now: Date) => {
    calls.push({ fn: "startRoll", rollId: id, now, by: actor.id });
    return { id, code: id };
  }),
  finishRoll: vi.fn(async (rollId: string, actor: { id: string }, now: Date) => {
    calls.push({ fn: "finishRoll", rollId, now, by: actor.id });
    // Phase 30C: a roll over 10% of its area is marked (D-116).
    return { marked: shareOf(rollId) > 10 };
  }),
  removeRoll: vi.fn(async (rollId: string, _reason: string, actor: { id: string }, now: Date) => {
    calls.push({ fn: "removeRoll", rollId, now, by: actor.id });
  }),
  ingestScan: vi.fn(
    async (
      input: { rollId: string; detections: Detection[] },
      origin: { kind?: string; userId?: string },
      now: Date,
    ) => {
      calls.push({
        fn: "scan",
        by: origin.userId,
        rollId: input.rollId,
        now,
        classKeys: input.detections.map((d) => d.classKey),
        detections: input.detections,
      });
      return {
        scanId: `s${calls.length}`,
        rollId: input.rollId,
        verdict: "PASS",
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
    {
      id: "d2",
      key: "cut",
      label: "Cut",
      isActive: true,
      outcome: "NOT_ACCEPTED",
      notAcceptedFromIn: 3,
      flatSharePct: 1,
    },
    { id: "d4", key: "hole", label: "Hole", isActive: true, outcome: "NOT_ACCEPTED" },
    { id: "d5", key: "scratch", label: "Scratch", isActive: true, outcome: "USABLE" },
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
}));
vi.mock("@/server/services/supplier-code.service", () => ({
  ensureSupplierWithCode: vi.fn(async (s: { name: string }) => ({ id: `sup-${s.name}` })),
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
  saveDayPlan: vi.fn(async (day: string) => ({ saved: true, day })),
  markNonWorking: vi.fn(async (day: string) => ({ saved: true, day })),
  saveCheckIn: vi.fn(async () => ({ id: "ci", number: 1, time: "13:00" })),
};
vi.mock("@/server/services/production.service", () => production);
vi.mock("@/server/services/attendance.service", () => attendance);
vi.mock("@/server/services/scan-ingest.service", () => ({ ingestScan: svc.ingestScan }));

const {
  mulberry32,
  seedDemoWeek,
  preparationMs,
  sectionsFor,
  PREPARATION_MINUTES,
  DEMO_QUOTA,
  demoRollShare,
  damageRoll,
} = await import("@/server/services/demo-seed.service");

const CLASSES = [
  { key: "crease", outcome: "USABLE" as const, notAcceptedFromIn: null, flatSharePct: null },
  { key: "cut", outcome: "NOT_ACCEPTED" as const, notAcceptedFromIn: 3, flatSharePct: 1 },
  { key: "hole", outcome: "NOT_ACCEPTED" as const, notAcceptedFromIn: null, flatSharePct: null },
  { key: "scratch", outcome: "USABLE" as const, notAcceptedFromIn: null, flatSharePct: null },
];
const shotsOf = (rollId: string) =>
  calls.filter((c) => c.fn === "scan" && c.rollId === rollId).map((c) => c.detections ?? []);
const areaOf = (rollId: string) =>
  calls.find((c) => c.fn === "addRoll" && c.rollId === rollId)?.areaSqFt ?? 0;
shareOf = (rollId) => demoRollShare(shotsOf(rollId), areaOf(rollId), CLASSES);

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

describe("scanning times (D-082, D-123)", () => {
  it("stay between 1 and 3 minutes a roll", () => {
    const random = mulberry32(7);
    expect(PREPARATION_MINUTES).toEqual([1, 3]);
    const [lo, hi] = PREPARATION_MINUTES;
    for (let i = 0; i < 200; i++) {
      const ms = preparationMs(random);
      expect(ms).toBeGreaterThanOrEqual(lo * 60_000);
      expect(ms).toBeLessThanOrEqual(hi * 60_000);
    }
  });
});

describe("damageRoll (D-124)", () => {
  it("adds a random mix until the roll reaches its target, never above the range", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = mulberry32(seed);
      for (const [area, range] of [
        [4, [11, 16]],
        [7, [11, 16]],
        [5.5, [7, 9]],
      ] as [number, [number, number]][]) {
        const shots = Array.from({ length: sectionsFor(area) }, () => []);
        const out = damageRoll(random, shots, area, CLASSES, range);
        const share = demoRollShare(out, area, CLASSES);
        expect(share).toBeGreaterThanOrEqual(range[0]);
        expect(share).toBeLessThanOrEqual(range[1]);
        for (const d of out.flat()) {
          expect(d.box.x).toBeGreaterThanOrEqual(0);
          expect(d.box.x + d.box.width).toBeLessThanOrEqual(1);
          expect(d.box.y + d.box.height).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("shots per roll (D-123)", () => {
  it("cover the roll's area at 16 × 12 in a shot", () => {
    expect(sectionsFor(4)).toBe(3);
    expect(sectionsFor(4.75)).toBe(4);
    expect(sectionsFor(5.25)).toBe(4);
    expect(sectionsFor(7)).toBe(6);
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
  ])(
    "scans every roll fully, with no class outside the defect types (%s, D-108)",
    async (_label, at) => {
      await seedDemoWeek({ now: at, seed: 1 });
      const scans = calls.filter((c) => c.fn === "scan");
      // 3 to 6 shots a roll (D-123): small, but every finished roll has a full set.
      expect(scans.length).toBeGreaterThanOrEqual(30);
      for (const s of scans)
        for (const k of s.classKeys ?? [])
          expect(["crease", "cut", "hole", "scratch"]).toContain(k);
    },
  );

  it("captures every section on a constructor's phone with the real model, enough for its area (Phase 26, D-123)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    const inputs = svc.ingestScan.mock.calls.map(
      (c) => c[0] as unknown as { source: string; modelVersion: string; rollId: string },
    );
    expect(new Set(inputs.map((i) => i.source))).toEqual(new Set(["PHONE"]));
    expect(new Set(inputs.map((i) => i.modelVersion))).toEqual(new Set(["yolo-v1-1d729fb0"]));
    const perRoll = new Map<string, number>();
    for (const i of inputs) perRoll.set(i.rollId, (perRoll.get(i.rollId) ?? 0) + 1);
    // Each finished roll has the shots its area needs (3 for 4 sq ft, 6 for 7 sq ft).
    const areas = new Map(
      calls.filter((c) => c.fn === "addRoll").map((c) => [c.rollId!, c.areaSqFt!]),
    );
    const finished = new Set(calls.filter((c) => c.fn === "finishRoll").map((c) => c.rollId));
    expect(finished.size).toBeGreaterThan(5);
    for (const id of finished) expect(perRoll.get(id!)).toBe(sectionsFor(areas.get(id!)!));
    for (const n of perRoll.values()) expect(n).toBeLessThanOrEqual(6);
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
    expect([...keys].sort()).toEqual(["crease", "cut", "hole", "scratch"]);
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

  it("adds each leather roll in Inventory with its area, then picks, scans and finishes it (Phase 30A)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    // The Floor Manager adds the rolls, each with an area in range; never on the sheet.
    expect(svc.addRolls.mock.calls.length).toBeGreaterThanOrEqual(4);
    for (const [itemId, values, actor, when] of svc.addRolls.mock.calls as unknown as [
      string,
      { receivedOn: string; rolls: { areaSqFt: number }[] },
      { id: string },
      Date,
    ][]) {
      expect(itemId).toMatch(/^LR-00[123]$/);
      expect(actor.id).toBe("manager@cpoint.local");
      expect(when.getTime()).toBeLessThanOrEqual(now.getTime());
      for (const r of values.rolls) {
        expect(r.areaSqFt).toBeGreaterThanOrEqual(4);
        expect(r.areaSqFt).toBeLessThanOrEqual(7);
      }
    }
    const added = calls.filter((c) => c.fn === "addRoll");
    const started = calls.filter((c) => c.fn === "startRoll");
    const finished = calls.filter((c) => c.fn === "finishRoll");
    expect(finished.length).toBeGreaterThan(5);
    // A constructor picks only a roll already added, once, after it was added.
    expect(new Set(started.map((s) => s.rollId)).size).toBe(started.length);
    for (const s of started) {
      const a = added.find((x) => x.rollId === s.rollId)!;
      expect(a.now.getTime()).toBeLessThanOrEqual(s.now.getTime());
      expect(s.by).not.toBe("manager@cpoint.local");
    }
    // Whoever picked a roll finishes it; the newest roll with shots stays open.
    for (const f of finished) expect(f.by).toBe(started.find((s) => s.rollId === f.rollId)!.by);
    const closed = new Set(finished.map((f) => f.rollId));
    expect(started.filter((s) => !closed.has(s.rollId))).toHaveLength(1);
    // One roll on the shelf removed by the Floor Manager, with a reason; never scanned.
    expect(svc.removeRoll).toHaveBeenCalledTimes(1);
    const [removedId, reason, actor] = svc.removeRoll.mock.calls[0] as unknown as [
      string,
      string,
      { id: string },
    ];
    expect(reason).toMatch(/Water damage/);
    expect(actor.id).toBe("manager@cpoint.local");
    expect(started.some((s) => s.rollId === removedId)).toBe(false);
    // Leather is never on the Update stock sheet (its count follows its rolls).
    const sheetItems = (
      stockUpdates.saveStockUpdate.mock.calls as unknown as [{ lines: { itemId: string }[] }][]
    ).flatMap(([b]) => b.lines.map((l) => l.itemId));
    expect(sheetItems.some((id) => id.startsWith("LR-"))).toBe(false);
  });

  it("damages three rolls past 10% with a mix of defects, one just under, a few minutes each (D-110, D-123, D-124)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    const inputs = svc.ingestScan.mock.calls.map(
      (c) =>
        c[0] as unknown as {
          rollId: string;
          widthIn: number;
          detections: {
            classKey: string;
            confidence: number;
            box: { width: number; height: number };
          }[];
        },
    );
    expect(new Set(inputs.map((i) => i.widthIn))).toEqual(new Set([16]));
    // Three rolls over 10% (11% to 16%), one just under (7% to 9%), the rest well under.
    const finished = calls.filter((c) => c.fn === "finishRoll").map((c) => c.rollId!);
    const shares = finished.map((id) => shareOf(id));
    const over = finished.filter((id) => shareOf(id) > 10);
    expect(over).toHaveLength(3);
    for (const id of over) {
      expect(shareOf(id)).toBeGreaterThanOrEqual(11);
      expect(shareOf(id)).toBeLessThanOrEqual(16);
      // A mix, not just cuts: found holes and scratches outnumber the long cuts.
      const found = shotsOf(id)
        .flat()
        .filter((d) => d.confidence >= 0.5);
      const kinds = new Set(found.map((d) => d.classKey));
      expect(kinds.size).toBeGreaterThanOrEqual(3);
      const cuts = found.filter((d) => d.classKey === "cut").length;
      expect(found.length - cuts).toBeGreaterThan(cuts);
      expect(
        Math.max(...shotsOf(id).map((s) => s.filter((d) => d.confidence >= 0.5).length)),
      ).toBeLessThanOrEqual(6);
    }
    expect(shares.filter((p) => p >= 7 && p <= 9)).toHaveLength(1);
    expect(shares.filter((p) => p > 9 && p <= 10)).toHaveLength(0);
    // Start scanning to Finish roll: 1 to 3 minutes.
    for (const f of calls.filter((c) => c.fn === "finishRoll")) {
      const start = calls.find((c) => c.fn === "startRoll" && c.rollId === f.rollId)!;
      const minutes = (f.now.getTime() - start.now.getTime()) / 60_000;
      expect(minutes).toBeGreaterThanOrEqual(1);
      expect(minutes).toBeLessThanOrEqual(3);
    }
  });

  it("asks the QI for pairs only, never rolls (Phase 30E, D-111)", async () => {
    await seedDemoWeek({ now, seed: 1 });
    for (const [input] of production.saveCheckIn.mock.calls as unknown as [object][])
      expect(input).not.toHaveProperty("usedRollIds");
  });

  it("finishes the batches as the QI, with one late and one missed, and three short days that line up with the absences", async () => {
    const result = await seedDemoWeek({ now, seed: 1 });
    // The Floor Manager plans every working day that morning, with the one quota (D-114).
    const plans = production.saveDayPlan.mock.calls as unknown as [
      string,
      { rollsPlanned: number; quota: number; intervalMinutes: number },
      unknown,
      Date,
    ][];
    expect(plans.length).toBeGreaterThan(0);
    for (const [day, plan, , at] of plans) {
      expect(plan).toMatchObject({ quota: DEMO_QUOTA, intervalMinutes: 240 });
      expect(at.toISOString().slice(0, 10) <= day).toBe(true);
    }
    expect(plans.map(([, p]) => p.rollsPlanned).slice(0, 3)).toEqual([3, 1, 2]);
    expect(production.markNonWorking).toHaveBeenCalledTimes(1);
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
