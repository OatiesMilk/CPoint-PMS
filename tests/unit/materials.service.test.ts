import { beforeEach, describe, expect, it, vi } from "vitest";

const model = {
  listMaterialItems: vi.fn(),
  usedByWeek: vi.fn(),
  pairsByWeek: vi.fn(),
  rollsCheckedByWeek: vi.fn(),
  usedBetween: vi.fn(),
  pairsBetween: vi.fn(),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/materials.model", () => model);
vi.mock("@/server/services/stock-update.service", () => ({
  reminderDays: vi.fn(async () => [3, 5]),
}));

const svc = await import("@/server/services/materials.service");
// Wednesday 28 Oct 2026 in Manila: this week is the week of Monday 26 Oct.
const now = new Date("2026-10-28T08:30:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  model.listMaterialItems.mockResolvedValue([
    {
      id: "lr",
      sku: "LR-001",
      name: "Black cowhide",
      category: "LEATHER_ROLL",
      unit: "roll",
      onHand: 3,
      since: new Date("2026-01-05T00:00:00.000Z"),
      supplier: "Meycauayan Tannery",
    },
    {
      id: "nl",
      sku: "NL-001",
      name: "Tacks",
      category: "NAILS",
      unit: "box",
      onHand: 20,
      since: new Date("2026-01-05T00:00:00.000Z"),
      supplier: null,
    },
  ]);
  model.usedByWeek.mockResolvedValue([
    { itemId: "lr", week: "2026-10-26", used: 6 },
    { itemId: "lr", week: "2026-10-19", used: 4 },
    { itemId: "nl", week: "2026-10-19", used: 2 },
  ]);
  model.pairsByWeek.mockResolvedValue(
    new Map([
      ["2026-10-19", 400],
      ["2026-10-26", 250],
    ]),
  );
  model.rollsCheckedByWeek.mockResolvedValue(new Map([["2026-10-26", 7]]));
  model.usedBetween.mockResolvedValue(
    new Map([
      ["lr", 28],
      ["nl", 2],
    ]),
  );
  model.pairsBetween.mockResolvedValue(1400);
});

describe("materialsReport (Phase 29, D-102)", () => {
  it("shows each material's week against the last, the trend and its pace", async () => {
    const r = await svc.materialsReport(now);
    expect(r.weeks.at(-1)).toBe("2026-10-26");
    const leather = r.rows.find((x) => x.id === "lr")!;
    expect(leather).toMatchObject({
      thisWeek: 6,
      lastWeek: 4,
      diff: 2,
      change: 0.5,
      perHundredPairs: 2,
      daysLeft: 3,
      mayRunOut: false,
    });
    expect(leather.trend).toEqual([0, 0, 0, 0, 0, 0, 4, 6]);
    expect(r.rows.find((x) => x.id === "nl")).toMatchObject({
      thisWeek: 0,
      lastWeek: 2,
      change: -1,
    });
  });

  it("warns when a material lasts fewer days than to the next update (Friday)", async () => {
    model.listMaterialItems.mockResolvedValueOnce([
      {
        id: "lr",
        sku: "LR-001",
        name: "Black cowhide",
        category: "LEATHER_ROLL",
        unit: "roll",
        onHand: 1,
        since: new Date("2026-01-05T00:00:00.000Z"),
        supplier: null,
      },
    ]);
    const r = await svc.materialsReport(now);
    expect(r.daysToNextReminder).toBe(2);
    expect(r.rows[0]).toMatchObject({ daysLeft: 1, mayRunOut: true });
  });

  it("puts leather rolls used beside the rolls the camera checked", async () => {
    const r = await svc.materialsReport(now);
    expect(r.leather.at(-1)).toEqual({
      week: "2026-10-26",
      rollsUsed: 6,
      rollsChecked: 7,
      pairs: 250,
    });
    expect(r.leather.at(-2)).toEqual({
      week: "2026-10-19",
      rollsUsed: 4,
      rollsChecked: 0,
      pairs: 400,
    });
  });

  it("writes one CSV row per item and week, with use per 100 pairs", async () => {
    const { body, from, to } = await svc.materialsCsv(now);
    expect([from, to]).toEqual(["2026-09-07", "2026-10-28"]);
    const lines = body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "Week (Monday),Item code,Item,Category,Supplier,Unit,Used,Pairs finished,Used per 100 pairs",
    );
    expect(lines).toHaveLength(1 + 8 * 2);
    expect(lines).toContain(
      "2026-10-19,LR-001,Black cowhide,Leather roll,Meycauayan Tannery,roll,4,400,1",
    );
  });

  it("paces an item whose history starts less than 4 weeks ago from that day", async () => {
    model.listMaterialItems.mockResolvedValue([
      {
        id: "lr",
        sku: "LR-009",
        name: "New cowhide",
        category: "LEATHER_ROLL",
        unit: "roll",
        onHand: 10,
        supplier: null,
        // Added Thursday 22 Oct (Manila): 7 days to Wednesday 28 Oct.
        since: new Date("2026-10-22T02:00:00.000Z"),
      },
    ]);
    model.usedBetween.mockResolvedValue(new Map([["lr", 7]]));
    model.pairsBetween.mockImplementation(async (from: string) =>
      from === "2026-10-22" ? 350 : 700,
    );
    const r = await svc.materialsReport(now);
    expect(model.pairsBetween).toHaveBeenCalledWith("2026-10-22", "2026-10-28");
    // 7 used over 7 days is 1 a day: 10 left lasts 10 days; 7 per 350 pairs is 2 per 100.
    expect(r.rows[0]).toMatchObject({ daysLeft: 10, perHundredPairs: 2 });
    expect(r.pace.pairs).toBe(700);
  });
});
