import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRange } from "@/lib/report-rules";

const model = {
  dailyScanStats: vi.fn(),
  dailyRepairsDone: vi.fn(),
  dailyProduction: vi.fn(),
  defectBreakdown: vi.fn(),
  verdictMatrix: vi.fn(),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/report.model", () => model);

const svc = await import("@/server/services/report.service");
const now = new Date("2026-10-03T04:00:00.000Z");
const range = parseRange({ from: "2026-10-01", to: "2026-10-03" }, now);

beforeEach(() => {
  vi.clearAllMocks();
  model.dailyScanStats.mockResolvedValue([
    {
      day: "2026-10-02",
      scanned: 10,
      pass: 5,
      rework: 2,
      reject: 2,
      pending: 1,
      overridden: 1,
      aiDecided: 8,
      agreed: 7,
      personResolved: 1,
    },
  ]);
  model.dailyRepairsDone.mockResolvedValue([{ day: "2026-10-03", done: 2 }]);
  model.defectBreakdown.mockResolvedValue([
    { key: "cut", label: "Cut", known: true, scans: 3, pass: 0, rework: 1, reject: 2, pending: 0 },
  ]);
  model.verdictMatrix.mockResolvedValue([
    { ai: "REJECT", final: "REWORK", count: 1 },
    { ai: "NEEDS_REVIEW", final: null, count: 1 },
  ]);
  model.dailyProduction.mockResolvedValue([{ day: "2026-10-01", started: 2, completed: 1 }]);
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

describe("qualityReport", () => {
  it("fills every day, merges repairs, and totals with agreement", async () => {
    const r = await svc.qualityReport(range);
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(r.days[1]).toMatchObject({ scanned: 10, agreement: 7 / 8 });
    expect(r.days[2]).toMatchObject({ scanned: 0, repairsDone: 2, agreement: null });
    expect(r.totals).toMatchObject({ scanned: 10, repairsDone: 2, agreement: 7 / 8 });
  });

  it("builds the AI × final matrix with pending as its own column", async () => {
    const r = await svc.qualityReport(range);
    expect(r.matrix.find((m) => m.ai === "REJECT")?.counts).toEqual({
      PASS: 0,
      REWORK: 1,
      REJECT: 0,
      PENDING: 0,
    });
    expect(r.matrix.find((m) => m.ai === "NEEDS_REVIEW")?.counts.PENDING).toBe(1);
  });

  it("never carries a person", async () => {
    const keys = keysDeep(await svc.qualityReport(range));
    for (const k of PERSON_KEYS) expect(keys.has(k)).toBe(false);
  });
});

describe("rollFlow (D-082)", () => {
  it("fills every day with rolls started and finished", async () => {
    const r = await svc.rollFlow(range);
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(r.totals).toEqual({ started: 2, completed: 1 });
  });
});

describe("CSV", () => {
  it("daily CSV has a BOM, a header and one row per day", async () => {
    const csv = await svc.dailyCsv(range);
    expect(csv.startsWith("﻿Date (Manila),Scanned,Pass")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[2]).toBe("2026-10-02,10,5,2,2,1,1,87.5,1,0");
  });
});
