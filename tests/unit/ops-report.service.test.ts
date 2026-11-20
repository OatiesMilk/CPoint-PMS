import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRange } from "@/lib/report-rules";

const report = {
  dailyRollStats: vi.fn(),
  dailyProduction: vi.fn(),
  defectBreakdown: vi.fn(),
};
const ops = {
  stockPosition: vi.fn(),
  supplierRolls: vi.fn(),
  supplierDefects: vi.fn(),
  rollsWithMostDefects: vi.fn(),
  findClaimRoll: vi.fn(),
  countRollVerdicts: vi.fn(),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/report.model", () => report);
vi.mock("@/server/models/ops-report.model", () => ops);
// Phase 34: the final defect, repair and work in progress sections have their own tests.
vi.mock("@/server/services/repair.service", () => ({
  repairReport: vi.fn(async () => ({
    finalDefects: { rows: [], notRecorded: 0, totalFailed: 0 },
    origins: { stages: [], rows: [] },
    repairs: {
      sent: 0,
      back: 0,
      passed: 0,
      scrapped: 0,
      sentAgain: 0,
      stillOpen: 0,
      averageHours: null,
    },
  })),
}));
vi.mock("@/server/services/stage.service", () => ({
  wipReport: vi.fn(async () => ({ stages: [], perDay: [], counted: 0 })),
}));
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
const rolls = { countDefectsForRolls: vi.fn() };
vi.mock("@/server/models/roll.model", () => rolls);
vi.mock("@/server/models/cv-settings.model", () => ({
  getCvSettings: vi.fn(async () => ({ foundAtOrAbove: 0.6 })),
}));

const svc = await import("@/server/services/ops-report.service");
const now = new Date("2026-10-08T04:00:00.000Z");
const range = parseRange({ from: "2026-10-02", to: "2026-10-08" }, now);

beforeEach(() => {
  vi.clearAllMocks();
  // 15 rolls finished on 7 Oct, 6 of them returned to supplier: 40% for the line (D-117).
  report.dailyRollStats.mockImplementation(async (r: { start: Date }) =>
    r.start.toISOString().startsWith("2026-10-01")
      ? [{ day: "2026-10-07", rolls: 15, passed: 9, returned: 6 }]
      : [{ day: "2026-09-30", rolls: 10, passed: 8, returned: 2 }],
  );
  report.defectBreakdown.mockResolvedValue([
    { key: "cut", label: "Cut", rolls: 6, returned: 3 },
    { key: "hole", label: "Hole", rolls: 2, returned: 1 },
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
  ops.supplierRolls.mockResolvedValue([
    { id: "s2", name: "Tannery B", rolls: 5, returned: 0 },
    { id: "s1", name: "Tannery A", rolls: 10, returned: 6 },
  ]);
  ops.supplierDefects.mockResolvedValue([
    { groupId: "s1", label: "Hole", rolls: 5 },
    { groupId: "s1", label: "Cut", rolls: 3 },
  ]);
  ops.rollsWithMostDefects.mockResolvedValue([
    {
      rollId: "b9",
      rollCode: "LR-MLT-009",
      tagCode: "R-0412",
      supplier: "Tannery A",
      defectSharePct: 16.7,
      returned: true,
    },
  ]);
  rolls.countDefectsForRolls.mockResolvedValue([
    { rollId: "b9", label: "Hole", detections: BigInt(4) },
    { rollId: "b9", label: "Cut", detections: BigInt(2) },
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
  it("puts the batches' pairs against the quota and the rolls together (Phase 27, D-117)", async () => {
    const r = await svc.operationsReport(range, now);
    expect(r.kpis.pairs).toMatchObject({ value: 164, previous: 100 });
    expect(r.kpis.pairs.change).toBeCloseTo(0.64);
    expect(r.kpis.failedPairs).toMatchObject({ value: 4, previous: 8 });
    expect(r.kpis.ofQuota.value).toBeCloseTo(160 / 170);
    // Whole rolls: 9 of 15 passed, 6 returned; before, 8 of 10 and 2 of 10.
    expect(r.kpis.rollsPassed).toMatchObject({ value: 0.6, previous: 0.8 });
    expect(r.kpis.rollsReturned).toMatchObject({ value: 0.4, previous: 0.2 });
    expect(Object.keys(r.kpis).sort()).toEqual([
      "failedPairs",
      "ofQuota",
      "pairs",
      "rollsPassed",
      "rollsReturned",
    ]);
    expect(r.production.days).toHaveLength(2);
    expect(r.days).toHaveLength(7);
    expect(r.days.find((d) => d.day === "2026-10-06")).toEqual({
      day: "2026-10-06",
      started: 3,
      rolls: 0,
      passed: 0,
      returned: 0,
    });
    expect(r.days.find((d) => d.day === "2026-10-07")).toMatchObject({
      rolls: 15,
      passed: 9,
      returned: 6,
    });
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

  it("rates suppliers by rolls returned, worst first, with the top defect and High (D-117)", async () => {
    const r = await svc.operationsReport(range, now);
    expect(r.suppliers[0]).toEqual({
      id: "s1",
      supplier: "Tannery A",
      rolls: 10,
      passed: 4,
      returned: 6,
      returnedShare: 0.6,
      topDefect: "Hole",
      high: true, // 60% returned against 40% for the line, over 10 rolls
    });
    expect(r.suppliers[1]).toMatchObject({ returnedShare: 0, topDefect: null, high: false });
    expect(r.lineReturnedShare).toBeCloseTo(0.4);
    expect(ops.supplierDefects).toHaveBeenCalledWith(range, 0.6);
  });

  it("lists the rolls with the most defects, with what was found on them", async () => {
    const r = await svc.operationsReport(range, now);
    expect(ops.rollsWithMostDefects).toHaveBeenCalledWith(range, 5);
    expect(rolls.countDefectsForRolls).toHaveBeenCalledWith(["b9"], 0.6);
    expect(r.mostDefects).toEqual([
      {
        rollId: "b9",
        rollCode: "LR-MLT-009",
        tagCode: "R-0412",
        supplier: "Tannery A",
        defectSharePct: 16.7,
        returned: true,
        defects: [
          { label: "Hole", detections: 4 },
          { label: "Cut", detections: 2 },
        ],
      },
    ]);
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
      "finalDefects",
      "kpis",
      "lineReturnedShare",
      "mostDefects",
      "origins",
      "previous",
      "production",
      "range",
      "repairs",
      "stock",
      "suppliers",
      "wip",
    ]);
  });

  it("keeps the checkpoint as a short summary of rolls with a Pareto (D-117)", async () => {
    const { checkpoint } = await svc.operationsReport(range, now);
    expect(checkpoint.totals).toEqual({ rolls: 15, passed: 9, returned: 6 });
    expect(checkpoint.defects[0]).toMatchObject({ key: "cut", share: 0.75, cumulative: 0.75 });
  });

  it("never carries a person", async () => {
    const keys = keysDeep(await svc.operationsReport(range, now));
    for (const k of PERSON_KEYS) expect(keys.has(k)).toBe(false);
  });
});

describe("CSV", () => {
  it("operations CSV has one row per day, in rolls (D-117)", async () => {
    const lines = (await svc.operationsCsv(range))
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe(
      "Date (Manila),Rolls started,Rolls scanned,Scanning passed,Returned to supplier",
    );
    expect(lines.find((l) => l.startsWith("2026-10-06"))).toBe("2026-10-06,3,0,0,0");
    expect(lines.find((l) => l.startsWith("2026-10-07"))).toBe("2026-10-07,0,15,9,6");
  });

  it("stock CSV lists every item, riskiest first", async () => {
    const lines = (await svc.stockCsv(range)).trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      "SKU,Item,Category,Unit,On hand,Reorder level,Used in period,Added in period,Days of cover,Status",
    );
    expect(lines[1]).toContain("LR-001,Leather roll");
    expect(lines[1]).toContain("OUT");
  });

  it("suppliers CSV gives rolls passed and returned", async () => {
    const lines = (await svc.suppliersCsv(range))
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(lines[0]).toBe(
      "Supplier,Rolls,Scanning passed,Returned to supplier,Returned %,Top defect,High",
    );
    expect(lines[1]).toBe("Tannery A,10,4,6,60.0,Hole,yes");
  });

  it("supplier-rolls CSV lists the rolls with the most defects", async () => {
    const lines = (await svc.supplierRollsCsv(range))
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(lines[0]).toBe("Roll,Tag number,Supplier,Defect %,Status,Defects");
    expect(lines[1]).toBe("LR-MLT-009,R-0412,Tannery A,16.7,Returned to supplier,Hole 4 · Cut 2");
    expect(ops.rollsWithMostDefects).toHaveBeenCalledWith(range, 100);
  });
});
