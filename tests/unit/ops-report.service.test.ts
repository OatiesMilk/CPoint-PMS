import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRange } from "@/lib/report-rules";

const report = {
  dailyScanStats: vi.fn(),
  dailyRepairsDone: vi.fn(),
  dailyProduction: vi.fn(),
  defectBreakdown: vi.fn(),
  verdictMatrix: vi.fn(),
};
const ops = {
  procurementFlow: vi.fn(),
  repairQueue: vi.fn(),
  repairTurnaround: vi.fn(),
  stockPosition: vi.fn(),
  supplierQuality: vi.fn(),
  supplierDefects: vi.fn(),
  rollsWithMostRejects: vi.fn(),
  findClaimBatch: vi.fn(),
  countBatchVerdicts: vi.fn(),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/report.model", () => report);
vi.mock("@/server/models/ops-report.model", () => ops);
const productionDay = (
  day: string,
  pairs: number,
  quota: number | null,
  shortfall: string | null,
) => ({
  day,
  checkIns: 3,
  entered: 3,
  missed: 0,
  full: true,
  byType: [{ shoeTypeId: "st1", label: "School Shoe", pairs, quota }],
  pairs,
  quota,
  share: quota ? pairs / quota : null,
  attendanceTaken: true,
  constructorsPresent: 10,
  constructorsOnRoster: 12,
  pairsPerConstructor: pairs / 10,
  shortfall,
});
const production = {
  productionReport: vi.fn(),
  recentProductionDays: vi.fn(),
};
vi.mock("@/server/services/production.service", () => production);
vi.mock("@/server/models/batch.model", () => ({
  countRollsByStatus: vi.fn(async () => ({ atPreparation: 2, planned: 1 })),
}));

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
  report.dailyProduction.mockResolvedValue([{ day: "2026-10-06", started: 3, completed: 2 }]);
  production.productionReport.mockImplementation(async (r: { from: string }) =>
    r.from === "2026-10-02"
      ? {
          shoeTypes: [{ id: "st1", label: "School Shoe" }],
          days: [
            productionDay(
              "2026-10-06",
              70,
              85,
              "Below quota by 15 pairs. 2 of 12 Shoe Constructors were absent.",
            ),
            productionDay("2026-10-07", 90, 85, null),
          ],
          totals: { pairs: 160, share: 160 / 170, daysBelow: 1, daysWithQuota: 2 },
        }
      : {
          shoeTypes: [],
          days: [],
          totals: { pairs: 100, share: 0.5, daysBelow: 0, daysWithQuota: 0 },
        },
  );
  production.recentProductionDays.mockResolvedValue({
    shoeTypes: [{ id: "st1", label: "School Shoe" }],
    days: [
      productionDay("2026-10-02", 70, 85, "x"),
      productionDay("2026-10-03", 70, 85, "x"),
      productionDay("2026-10-05", 90, 85, null),
      productionDay("2026-10-06", 70, 85, "x"),
      productionDay("2026-10-07", 90, 85, null),
    ],
  });
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
    {
      id: "s2",
      name: "Tannery B",
      batches: 1,
      rolls: 1,
      scanned: 10,
      pass: 10,
      rework: 0,
      reject: 0,
    },
    {
      id: "s1",
      name: "Tannery A",
      batches: 2,
      rolls: 2,
      scanned: 40,
      pass: 20,
      rework: 10,
      reject: 10,
    },
  ]);
  ops.supplierDefects.mockResolvedValue([
    { groupId: "s1", label: "Hole", sections: 12 },
    { groupId: "s1", label: "Cut", sections: 8 },
  ]);
  ops.rollsWithMostRejects.mockResolvedValue([
    {
      batchId: "b9",
      batchCode: "B-2026-0009",
      rollCode: "R-0412",
      supplier: "Tannery A",
      sections: 40,
      rejected: 6,
      defects: [
        { label: "Hole", sections: 4 },
        { label: "Cut", sections: 2 },
      ],
    },
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
  it("puts production against the quota and the rolls together (Phase 23)", async () => {
    const r = await svc.operationsReport(range, now);
    expect(r.kpis.pairs).toMatchObject({ value: 160, previous: 100 });
    expect(r.kpis.pairs.change).toBeCloseTo(0.6);
    expect(r.kpis.ofQuota.value).toBeCloseTo(160 / 170);
    expect(r.kpis.rollsFinished.value).toBe(2);
    expect(r.kpis.rollsAtPreparation).toBe(2);
    expect(r.kpis.repairsOpen).toBe(2);
    expect(r.production.days).toHaveLength(2);
    expect(r.days).toHaveLength(7);
    expect(r.days.find((d) => d.day === "2026-10-06")).toMatchObject({ started: 3, completed: 2 });
    expect(r).not.toHaveProperty("flow");
  });

  it("works out stock level and days of cover", async () => {
    const { stock } = await svc.operationsReport(range, now);
    expect(stock).toMatchObject({ items: 3, out: 1, low: 0, shortCover: 0 });
    const thread = stock.all.find((i) => i.item === "Thread")!;
    expect(thread.coverDays).toBeCloseTo(3); // 6 on hand at 2 a day
    expect(stock.atRisk.map((i) => i.item)).toEqual(["Leather roll"]); // thread's 3 days is not under 3
    expect(stock.all.map((i) => i.level)).toEqual(["OUT", "OK", "OK"]);
  });

  it("rates suppliers worst first, with rolls, shares, top defect and the High flag", async () => {
    const r = await svc.operationsReport(range, now);
    expect(r.suppliers[0]).toMatchObject({
      supplier: "Tannery A",
      rolls: 2,
      problemShare: 0.5,
      cleanShare: 0.5,
      reworkShare: 0.25,
      rejectShare: 0.25,
      topDefect: "Hole",
      high: true, // 50% against 40% for the line, over 40 sections
    });
    expect(r.suppliers[1]).toMatchObject({ problemShare: 0, topDefect: null, high: false });
    expect(r.lineProblemShare).toBeCloseTo(0.4); // 20 of 50 decided
    expect(r.rejectedRolls[0]).toMatchObject({ rollCode: "R-0412", rejected: 6 });
    expect(ops.rollsWithMostRejects).toHaveBeenCalledWith(range, 5);
  });

  it("builds a claim sheet per roll, with no person on it (D-008)", async () => {
    ops.findClaimBatch.mockResolvedValue({
      id: "b9",
      code: "B-2026-0009",
      rollCode: "R-0412",
      receivedAt: new Date("2026-10-01T00:00:00Z"),
      shoeType: { name: "School Shoe" },
      supplier: { name: "Tannery A", contactPerson: null, phone: null },
      scans: [
        {
          id: "sc1",
          sequence: 3,
          capturedAt: new Date("2026-10-02T01:00:00Z"),
          imagePath: "a.jpg",
          isOverride: false,
          detections: [{ confidence: 0.94, rawClassKey: "hole", defectType: { label: "Hole" } }],
        },
      ],
    });
    ops.countBatchVerdicts.mockResolvedValue([
      { finalVerdict: "PASS", _count: { _all: 30 } },
      { finalVerdict: "REJECT", _count: { _all: 6 } },
      { finalVerdict: null, _count: { _all: 1 } },
    ]);
    const sheet = await svc.claimSheet("b9");
    expect(sheet).toMatchObject({
      rollCode: "R-0412",
      receivedAt: "2026-10-01",
      totals: { sections: 37, pass: 30, rework: 0, reject: 6, pending: 1 },
      rejected: [{ sequence: 3, hasImage: true, defects: [{ label: "Hole", confidence: 0.94 }] }],
    });
    const keys = keysDeep(sheet);
    for (const k of ["userId", "user", "email", "decidedBy", "decidedById", "createdBy"])
      expect(keys.has(k)).toBe(false);
    ops.findClaimBatch.mockResolvedValue(null);
    expect(await svc.claimSheet("nope")).toBeNull();
  });

  it("lists what needs attention, most urgent first", async () => {
    const r = await svc.operationsReport(range, now);
    const ids = r.attention.map((a) => a.id);
    expect(ids[0]).toBe("stock-out");
    expect(r.attention.find((a) => a.id === "below-quota")?.title).toBe(
      "3 of the last 5 working days were below quota",
    );
    expect(ids).not.toContain("bottleneck");
    expect(ids).toEqual(
      expect.arrayContaining([
        "below-quota",
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
    expect(lines[0]).toContain("Rolls started,Rolls finished");
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
    expect(csv).toContain("Tannery A,2,2,40,20,10,10,50.0,25.0,25.0,50.0,Hole,yes");
  });
});
