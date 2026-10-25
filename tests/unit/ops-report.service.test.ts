import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRange } from "@/lib/report-rules";

const report = {
  dailyScanStats: vi.fn(),
  dailyProduction: vi.fn(),
  defectBreakdown: vi.fn(),
};
const ops = {
  stockPosition: vi.fn(),
  supplierQuality: vi.fn(),
  supplierDefects: vi.fn(),
  rollsWithMostRejects: vi.fn(),
  findClaimRoll: vi.fn(),
  countRollVerdicts: vi.fn(),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/report.model", () => report);
vi.mock("@/server/models/ops-report.model", () => ops);
const productionDay = (
  day: string,
  passed: number,
  quota: number | null,
  shortfall: string | null,
) => ({
  day,
  batches: 2,
  finishedBatches: 2,
  missed: 0,
  full: true,
  finished: passed + 2,
  failed: 2,
  passed,
  failedShare: 2 / (passed + 2),
  quota,
  share: quota ? passed / quota : null,
  attendanceTaken: true,
  constructorsPresent: 10,
  constructorsOnRoster: 12,
  pairsPerConstructor: (passed + 2) / 10,
  shortfall,
});
const production = {
  productionReport: vi.fn(),
  recentProductionDays: vi.fn(),
};
vi.mock("@/server/services/production.service", () => production);
vi.mock("@/server/models/roll.model", () => ({
  countOpenRolls: vi.fn(async () => 2),
}));

const svc = await import("@/server/services/ops-report.service");
const now = new Date("2026-10-08T04:00:00.000Z");
const range = parseRange({ from: "2026-10-02", to: "2026-10-08" }, now);

beforeEach(() => {
  vi.clearAllMocks();
  report.dailyScanStats.mockResolvedValue([
    {
      day: "2026-10-07",
      scanned: 50,
      pass: 30,
      reject: 20,
    },
  ]);
  report.defectBreakdown.mockResolvedValue([
    { key: "cut", label: "Cut", known: true, scans: 6, pass: 3, reject: 3 },
    { key: "hole", label: "Hole", known: true, scans: 2, pass: 1, reject: 1 },
  ]);
  report.dailyProduction.mockResolvedValue([{ day: "2026-10-06", started: 3, completed: 2 }]);
  production.productionReport.mockImplementation(async (r: { from: string }) =>
    r.from === "2026-10-02"
      ? {
          days: [
            productionDay(
              "2026-10-06",
              70,
              85,
              "Below quota by 15 pairs. 2 of 12 Shoe Constructors were absent.",
            ),
            productionDay("2026-10-07", 90, 85, null),
          ],
          totals: {
            finished: 164,
            failed: 4,
            passed: 160,
            failedShare: 4 / 164,
            share: 160 / 170,
            daysBelow: 1,
            daysWithQuota: 2,
          },
        }
      : {
          days: [],
          totals: {
            finished: 100,
            failed: 8,
            passed: 92,
            failedShare: 0.08,
            share: 0.5,
            daysBelow: 0,
            daysWithQuota: 0,
          },
        },
  );
  production.recentProductionDays.mockResolvedValue({
    days: [
      productionDay("2026-10-02", 70, 85, "x"),
      productionDay("2026-10-03", 70, 85, "x"),
      productionDay("2026-10-05", 90, 85, null),
      productionDay("2026-10-06", 70, 85, "x"),
      productionDay("2026-10-07", 90, 85, null),
    ],
  });
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
    },
  ]);
  ops.supplierQuality.mockResolvedValue([
    {
      id: "s2",
      name: "Tannery B",
      rolls: 1,
      scanned: 10,
      pass: 10,
      reject: 0,
    },
    {
      id: "s1",
      name: "Tannery A",
      rolls: 2,
      scanned: 40,
      pass: 20,
      reject: 20,
    },
  ]);
  ops.supplierDefects.mockResolvedValue([
    { groupId: "s1", label: "Hole", sections: 12 },
    { groupId: "s1", label: "Cut", sections: 8 },
  ]);
  ops.rollsWithMostRejects.mockResolvedValue([
    {
      rollId: "b9",
      rollCode: "B-2026-0009",
      tagCode: "R-0412",
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
  "actor",
];

describe("operationsReport", () => {
  it("puts the batches' pairs against the quota and the rolls together (Phase 27)", async () => {
    const r = await svc.operationsReport(range, now);
    expect(r.kpis.pairs).toMatchObject({ value: 164, previous: 100 });
    expect(r.kpis.pairs.change).toBeCloseTo(0.64);
    expect(r.kpis.failedPairs).toMatchObject({ value: 4, previous: 8 });
    expect(r.kpis.ofQuota.value).toBeCloseTo(160 / 170);
    expect(r.kpis.rollsFinished.value).toBe(2);
    expect(r.kpis.rollsOpen).toBe(2);
    expect(r.kpis.rejectRate.value).toBeCloseTo(0.4);
    expect(r.kpis).not.toHaveProperty("repairsOpen");
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
      passShare: 0.5,
      rejectShare: 0.5,
      topDefect: "Hole",
      high: true, // 50% rejected against 40% for the line, over 40 sections
    });
    expect(r.suppliers[1]).toMatchObject({ rejectShare: 0, topDefect: null, high: false });
    expect(r.lineRejectShare).toBeCloseTo(0.4); // 20 of 50 rejected
    expect(r.rejectedRolls[0]).toMatchObject({ tagCode: "R-0412", rejected: 6 });
    expect(ops.rollsWithMostRejects).toHaveBeenCalledWith(range, 5);
  });

  it("builds a claim sheet per roll, with no person on it (D-008)", async () => {
    ops.findClaimRoll.mockResolvedValue({
      id: "b9",
      code: "B-2026-0009",
      tagCode: "R-0412",
      receivedAt: null,
      startedAt: new Date("2026-10-01T00:30:00Z"),
      supplier: { name: "Tannery A", contactPerson: null, phone: null },
      scans: [
        {
          id: "sc1",
          sequence: 3,
          capturedAt: new Date("2026-10-02T01:00:00Z"),
          imagePath: "a.jpg",
          detections: [{ confidence: 0.94, rawClassKey: "hole", defectType: { label: "Hole" } }],
        },
      ],
    });
    ops.countRollVerdicts.mockResolvedValue([
      { finalVerdict: "PASS", _count: { _all: 30 } },
      { finalVerdict: "REJECT", _count: { _all: 6 } },
    ]);
    const sheet = await svc.claimSheet("b9");
    expect(sheet).toMatchObject({
      tagCode: "R-0412",
      receivedAt: null,
      startedAt: "2026-10-01T00:30:00.000Z",
      totals: { sections: 36, pass: 30, reject: 6 },
      rejected: [{ sequence: 3, hasImage: true, defects: [{ label: "Hole", confidence: 0.94 }] }],
    });
    const keys = keysDeep(sheet);
    for (const k of ["userId", "user", "email", "decidedBy", "decidedById", "createdBy"])
      expect(keys.has(k)).toBe(false);
    ops.findClaimRoll.mockResolvedValue(null);
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
    expect(ids).toEqual(expect.arrayContaining(["below-quota", "supplier"]));
    expect(ids).not.toContain("repairs-waiting");
    expect(ids).not.toContain("flagged");
  });

  it("answers with the floor's sections only (D-091)", async () => {
    const r = await svc.operationsReport(range, now);
    expect(Object.keys(r).sort()).toEqual([
      "asOf",
      "attention",
      "checkpoint",
      "days",
      "forSalvage",
      "kpis",
      "lineRejectShare",
      "previous",
      "production",
      "range",
      "rejectedRolls",
      "stock",
      "suppliers",
    ]);
  });

  it("keeps the checkpoint as a short summary with a Pareto", async () => {
    const { checkpoint } = await svc.operationsReport(range, now);
    expect(checkpoint.totals).toMatchObject({ scanned: 50, firstPassYield: 0.6 });
    expect(checkpoint.defects[0]).toMatchObject({ key: "cut", share: 0.75, cumulative: 0.75 });
  });

  it("reports rejected sections for salvage, by main defect (A-11)", async () => {
    const { forSalvage } = await svc.operationsReport(range, now);
    expect(forSalvage).toEqual({
      total: 20,
      byDefect: [
        { key: "cut", label: "Cut", known: true, sections: 3 },
        { key: "hole", label: "Hole", known: true, sections: 1 },
      ],
    });
  });

  it("never carries a person", async () => {
    const keys = keysDeep(await svc.operationsReport(range, now));
    for (const k of PERSON_KEYS) expect(keys.has(k)).toBe(false);
  });
});

describe("CSV", () => {
  it("operations CSV has one row per day", async () => {
    const lines = (await svc.operationsCsv(range)).trim().split("\r\n");
    expect(lines).toHaveLength(8);
    expect(lines[0]).toContain("Rolls started,Rolls finished");
    expect(lines.find((l) => l.startsWith("2026-10-06"))).toBe("2026-10-06,3,2,0,0,0");
  });

  it("stock CSV lists every item, riskiest first", async () => {
    const lines = (await svc.stockCsv(range)).trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      "SKU,Item,Category,Unit,On hand,Reorder level,Used in period,Received in period,Days of cover,Status",
    );
    expect(lines[1]).toContain("LR-001,Leather roll");
    expect(lines[1]).toContain("OUT");
  });

  it("suppliers CSV gives percentages", async () => {
    const csv = await svc.suppliersCsv(range);
    expect(csv).toContain("Tannery A,2,40,20,20,50.0,50.0,Hole,yes");
  });
});
