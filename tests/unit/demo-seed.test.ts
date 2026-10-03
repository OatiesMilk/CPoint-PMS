import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { fn: string; batchId?: string; now: Date; classKeys?: string[] }[] = [];
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
      _d: unknown,
      now: Date,
    ) => {
      calls.push({
        fn: "scan",
        batchId: input.batchId,
        now,
        classKeys: input.detections.map((d) => d.classKey),
      });
      return { scanId: `s${calls.length}`, batchId: input.batchId, verdict: "PASS" };
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
  findUserByEmail: vi.fn(async (email: string) => ({ id: email })),
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
}));
vi.mock("@/server/models/user.model", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/server/services/api-token.service", () => ({
  createDeviceToken: vi.fn(async () => ({ id: "tok" })),
}));
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
vi.mock("@/server/services/scan-decision.service", () => ({ decideScan: vi.fn() }));
vi.mock("@/server/services/scan-ingest.service", () => ({ ingestScan: svc.ingestScan }));

const { mulberry32, seedDemoWeek, stageDurationMs, STAGE_HOURS } =
  await import("@/server/services/demo-seed.service");
const { UNKNOWN_CLASS } = await import("@/server/lib/leather-scan");

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  nextBatch = 0;
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

describe("stage times", () => {
  it("stay in range, and Upper Making is the slowest stage on average (survey)", () => {
    const random = mulberry32(7);
    const avg = (stage: keyof typeof STAGE_HOURS) => {
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const ms = stageDurationMs(stage, random);
        const [lo, hi] = STAGE_HOURS[stage];
        expect(ms).toBeGreaterThanOrEqual(lo * 3_600_000);
        expect(ms).toBeLessThanOrEqual(hi * 3_600_000);
        total += ms;
      }
      return total / 200;
    };
    const um = avg("UPPER_MAKING");
    for (const s of ["PREPARATION", "SOLEING", "FINISHING"] as const)
      expect(um).toBeGreaterThan(avg(s));
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
    expect(scans.length).toBeGreaterThan(100);
    expect(scans.slice(-2).map((c) => c.classKeys)).toEqual([[UNKNOWN_CLASS], [UNKNOWN_CLASS]]);
    expect(new Set(scans.slice(-2).map((c) => c.batchId)).size).toBe(1);
  });
});
