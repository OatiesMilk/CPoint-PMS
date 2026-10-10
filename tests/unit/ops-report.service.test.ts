import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRange } from "@/lib/report-rules";

const report = {
  dailyScanStats: vi.fn(),
  dailyRepairsDone: vi.fn(),
  dailyProduction: vi.fn(),
  defectBreakdown: vi.fn(),
  verdictMatrix: vi.fn(),
  stageDurations: vi.fn(),
  openStageWaits: vi.fn(),
};
const ops = {
  leadTimes: vi.fn(),
  openBatches: vi.fn(),
  procurementFlow: vi.fn(),
  repairQueue: vi.fn(),
  repairTurnaround: vi.fn(),
  stockPosition: vi.fn(),
  supplierQuality: vi.fn(),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/report.model", () => report);
vi.mock("@/server/models/ops-report.model", () => ops);

const svc = await import("@/server/services/ops-report.service");
const now = new Date("2026-10-08T04:00:00.000Z");
const range = parseRange({ from: "2026-10-02", to: "2026-10-08" }, now);
const H = 3_600_000;

beforeEach(() => {
  vi.clearAllMocks();
  report.dailyScanStats.mockResolvedValue([
    {
      day: "2026-10-07",
      scanned: 50,
      pass: 30,
      rework: 10,
      reject: 10,
      pending: 2,
      overridden: 1,
      aiDecided: 48,
      agreed: 47,
      personResolved: 0,
    },
  ]);
  report.dailyRepairsDone.mockResolvedValue([]);
  report.defectBreakdown.mockResolvedValue([
    { key: "cut", label: "Cut", known: true, scans: 6, pass: 0, rework: 3, reject: 3, pending: 0 },
    {
      key: "hole",
      label: "Hole",
      known: true,
      scans: 2,
      pass: 0,
      rework: 1,
      reject: 1,
      pending: 0,
    },
  ]);
  report.verdictMatrix.mockResolvedValue([]);
  report.stageDurations.mockResolvedValue([
    { stage: "UPPER_MAKING", visits: 6, medianMs: 4 * H, p90Ms: 8 * H, avgMs: 5 * H },
    { stage: "SOLEING", visits: 6, medianMs: 2 * H, p90Ms: 3 * H, avgMs: 2 * H },
  ]);
  report.openStageWaits.mockResolvedValue([
    { stage: "UPPER_MAKING", batches: 2, longestMs: 9 * H },
  ]);
  report.dailyProduction.mockResolvedValue([{ day: "2026-10-06", started: 3, completed: 2 }]);
  ops.leadTimes.mockResolvedValue({ batches: 2, medianMs: 20 * H, avgMs: 21 * H });
  ops.openBatches.mockResolvedValue([
    {
      id: "b1",
      code: "B-1",
      shoeType: "School Shoe",
      stage: "UPPER_MAKING",
      inStageMs: 9 * H,
      openRepairs: 1,
    },
    {
      id: "b2",
      code: "B-2",
      shoeType: "Topsider",
      stage: "UPPER_MAKING",
      inStageMs: 2 * H,
      openRepairs: 0,
    },
  ]);
  ops.repairQueue.mockResolvedValue([
    {
      id: "r1",
      status: "OPEN",
      batchId: "b1",
      batchCode: "B-1",
      sequence: 4,
      defect: "Cut",
      openedAt: new Date(now.getTime() - 30 * H),
      startedAt: null,
    },
    {
      id: "r2",
      status: "IN_PROGRESS",
      batchId: "b1",
      batchCode: "B-1",
      sequence: 7,
      defect: "Hole",
      openedAt: new Date(now.getTime() - 5 * H),
      startedAt: new Date(now.getTime() - 1 * H),
    },
  ]);
  ops.repairTurnaround.mockResolvedValue({ done: 4, medianMs: 6 * H });
  ops.stockPosition.mockResolvedValue([
    {
      id: "i1",
      sku: "LR-001",
      name: "Leather roll",
      category: "LEATHER_ROLL",
      unit: "roll",
      onHand: 0,
      reorderLevel: 2,
      used: 5,
      received: 0,
      requested: true,
    },
    {
      id: "i2",
      sku: "TH-001",
      name: "Thread",
      category: "THREAD",
      unit: "spool",
      onHand: 6,
      reorderLevel: 2,
      used: 14,
      received: 0,
      requested: false,
    },
    {
      id: "i3",
      sku: "AD-001",
      name: "Adhesive",
      category: "ADHESIVE",
      unit: "kg",
      onHand: 50,
      reorderLevel: 5,
      used: 7,
      received: 0,
      requested: false,
    },
  ]);
  ops.procurementFlow.mockResolvedValue({
    pending: 2,
    highPending: 1,
    oldestPendingMs: 10 * H,
    awaitingDelivery: 1,
    lateAwaitingDelivery: 0,
    byStatus: { PENDING: 2, RECEIVED: 1 },
    medianDecideMs: 3 * H,
    medianReceiveMs: 48 * H,
  });
  ops.supplierQuality.mockResolvedValue([
    { id: "s1", name: "Tannery A", batches: 2, scanned: 40, pass: 20, rework: 10, reject: 10 },
    { id: "s2", name: "Tannery B", batches: 1, scanned: 10, pass: 10, rework: 0, reject: 0 },
  ]);
});

/** Every key at any depth, to prove reports never carry a person (D-008). */
function keysDeep(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  return out;
}
const PERSON_KEYS = [
  "userId",
  "name",
  "email",
  "decidedBy",
  "decidedById",
  "createdBy",
  "completedBy",
  "requestedBy",
  "requestedById",
  "actor",
];

describe("repairStation", () => {
  it("shows how far each section has got and how long it has been there", async () => {
    const r = await svc.repairStation(range, now);
    expect(r).toMatchObject({
      waiting: 1,
      beingRepaired: 1,
      total: 2,
      waitingOverDay: 1,
      doneInRange: 4,
      medianTurnaroundMs: 6 * H,
    });
    expect(r.oldestWaitingMs).toBe(30 * H);
    expect(r.rows[0]).toMatchObject({
      status: "OPEN",
      sequence: 4,
      waitingMs: 30 * H,
      repairingMs: null,
    });
    expect(r.rows[1]).toMatchObject({ status: "IN_PROGRESS", repairingMs: 1 * H });
  });
});

describe("operationsReport", () => {
  it("puts the flow, bottleneck and late batches together", async () => {
    const r = await svc.operationsReport(range, now);
    expect(r.flow.bottleneck).toBe("UPPER_MAKING");
    const upper = r.flow.lanes.find((l) => l.stage === "UPPER_MAKING")!;
    expect(upper.batches.map((b) => [b.code, b.stuck])).toEqual([
      ["B-1", true],
      ["B-2", false],
    ]);
    expect(upper.p90Ms).toBe(8 * H);
    expect(r.kpis.wip).toBe(2);
    expect(r.kpis.repairsOpen).toBe(2);
    expect(r.kpis.completed.value).toBe(2);
    expect(r.days).toHaveLength(7);
  });

  it("works out stock level and days of cover", async () => {
    const { stock } = await svc.operationsReport(range, now);
    expect(stock).toMatchObject({ items: 3, out: 1, low: 0, shortCover: 0 });
    const thread = stock.all.find((i) => i.item === "Thread")!;
    expect(thread.coverDays).toBeCloseTo(3); // 6 on hand at 2 a day
    expect(stock.atRisk.map((i) => i.item)).toEqual(["Leather roll"]); // thread's 3 days is not under 3
    expect(stock.all.map((i) => i.level)).toEqual(["OUT", "OK", "OK"]);
  });

  it("rates suppliers by the share that needed work", async () => {
    const r = await svc.operationsReport(range, now);
    expect(r.suppliers[0]).toMatchObject({
      supplier: "Tannery A",
      problemShare: 0.5,
      cleanShare: 0.5,
    });
    expect(r.suppliers[1].problemShare).toBe(0);
    expect(r.lineProblemShare).toBeCloseTo(0.4); // 20 of 50 decided
  });

  it("lists what needs attention, most urgent first", async () => {
    const r = await svc.operationsReport(range, now);
    const ids = r.attention.map((a) => a.id);
    expect(ids[0]).toBe("stock-out");
    expect(ids).toEqual(
      expect.arrayContaining([
        "bottleneck",
        "stuck",
        "repairs-waiting",
        "requests-high",
        "supplier",
        "flagged",
      ]),
    );
  });

  it("keeps the checkpoint as a short summary with a Pareto", async () => {
    const { checkpoint } = await svc.operationsReport(range, now);
    expect(checkpoint.totals).toMatchObject({ scanned: 50, firstPassYield: 0.6 });
    expect(checkpoint.defects[0]).toMatchObject({ key: "cut", share: 0.75, cumulative: 0.75 });
  });

  it("never carries a person", async () => {
    const keys = keysDeep(await svc.operationsReport(range, now));
    for (const k of PERSON_KEYS) expect(keys.has(k)).toBe(false);
    const repairKeys = keysDeep(await svc.repairStation(range, now));
    for (const k of PERSON_KEYS) expect(repairKeys.has(k)).toBe(false);
  });
});

describe("CSV", () => {
  it("operations CSV has one row per day", async () => {
    const lines = (await svc.operationsCsv(range)).trim().split("\r\n");
    expect(lines).toHaveLength(8);
    expect(lines[0]).toContain("Batches started,Batches completed");
    expect(lines.find((l) => l.startsWith("2026-10-06"))).toBe("2026-10-06,3,2,0,0,0,0,0");
  });

  it("stock CSV lists every item, riskiest first", async () => {
    const lines = (await svc.stockCsv(range)).trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("LR-001,Leather roll");
    expect(lines[1]).toContain("OUT");
  });

  it("suppliers CSV gives percentages", async () => {
    const csv = await svc.suppliersCsv(range);
    expect(csv).toContain("Tannery A,2,40,20,10,10,50.0,50.0");
  });
});
