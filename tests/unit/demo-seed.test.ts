import { beforeEach, describe, expect, it, vi } from "vitest";
import { manilaToday } from "@/lib/format";

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
