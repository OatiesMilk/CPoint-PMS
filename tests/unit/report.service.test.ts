import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRange } from "@/lib/report-rules";

const model = {
  dailyScanStats: vi.fn(),
  dailyProduction: vi.fn(),
  defectBreakdown: vi.fn(),
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
      pass: 7,
      reject: 3,
    },
  ]);
  model.defectBreakdown.mockResolvedValue([
    { key: "cut", label: "Cut", known: true, scans: 3, pass: 1, reject: 2 },
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
  it("fills every day and totals Pass and Reject (D-093)", async () => {
    const r = await svc.qualityReport(range);
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(r.days[1]).toEqual({ day: "2026-10-02", scanned: 10, pass: 7, reject: 3 });
    expect(r.days[2]).toEqual({ day: "2026-10-03", scanned: 0, pass: 0, reject: 0 });
    expect(r.totals).toEqual({ scanned: 10, pass: 7, reject: 3 });
    expect(r).not.toHaveProperty("matrix");
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
    expect(lines[0]).toBe("Date (Manila),Scanned,Pass,Reject (for salvage)");
    expect(lines[2]).toBe("2026-10-02,10,7,3");
  });

  it("defects CSV has Pass and Reject (for salvage) per type", async () => {
    const lines = (await svc.defectsCsv(range)).trim().split("\r\n");
    expect(lines[0]).toContain("Scans,Pass,Reject (for salvage)");
    expect(lines[1]).toBe("Cut,cut,yes,3,1,2");
  });
});
