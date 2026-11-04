import { beforeEach, describe, expect, it, vi } from "vitest";

const model = {
  listMaterialItems: vi.fn(),
  usedByDay: vi.fn(),
  pairsByDay: vi.fn(),
  rollsCheckedByDay: vi.fn(),
  rollsReturnedByDay: vi.fn(),
  usedBetween: vi.fn(),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/materials.model", () => model);
vi.mock("@/server/services/stock-update.service", () => ({
  reminderDays: vi.fn(async () => [3, 5]),
}));

const svc = await import("@/server/services/materials.service");
// Wednesday 28 Oct 2026 in Manila: today's week is Week 4 of October, Oct 22–28 (D-109).
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
  model.usedByDay.mockResolvedValue([
    { itemId: "lr", day: "2026-10-26", used: 6 }, // Week 4 of October
    { itemId: "lr", day: "2026-10-19", used: 4 }, // Week 3
    { itemId: "nl", day: "2026-10-20", used: 2 }, // Week 3
    { itemId: "nl", day: "2026-10-01", used: 5 }, // Week 1
  ]);
  model.pairsByDay.mockResolvedValue([
    { day: "2026-10-19", value: 400 },
    { day: "2026-10-26", value: 250 },
  ]);
  model.rollsCheckedByDay.mockResolvedValue([{ day: "2026-10-26", value: 7 }]);
  model.rollsReturnedByDay.mockResolvedValue([{ day: "2026-10-27", value: 2 }]);
  model.usedBetween.mockResolvedValue(
    new Map([
      ["lr", 28],
      ["nl", 2],
    ]),
  );
});

describe("materialsReport (Phase 29, D-102, D-109)", () => {
  it("shows each material's week against the last, the trend and its pace", async () => {
    const r = await svc.materialsReport({}, now);
    expect(r.selected.label).toBe("Week 4 · Oct 22–28");
    expect(r.previous.label).toBe("Week 3 · Oct 15–21");
    expect(r.weeks[0].label).toBe("Week 2 · Sep 8–14");
    expect(model.usedByDay).toHaveBeenCalledWith("2026-09-08", "2026-10-28");
    const leather = r.rows.find((x) => x.id === "lr")!;
    expect(leather).toMatchObject({
      thisWeek: 6,
      lastWeek: 4,
      diff: 2,
      change: 0.5,
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
    const r = await svc.materialsReport({}, now);
    expect(r.daysToNextReminder).toBe(2);
    expect(r.rows[0]).toMatchObject({ daysLeft: 1, mayRunOut: true });
  });

  it("puts leather rolls used beside the rolls checked and returned to supplier (D-116)", async () => {
    const r = await svc.materialsReport({}, now);
    expect(model.rollsReturnedByDay).toHaveBeenCalledWith("2026-09-08", "2026-10-28");
    expect(r.leather.at(-1)).toMatchObject({
      rollsUsed: 6,
      rollsChecked: 7,
      rollsReturned: 2,
      pairs: 250,
    });
    expect(r.leather.at(-1)!.week.label).toBe("Week 4 · Oct 22–28");
    expect(r.leather.at(-2)).toMatchObject({
      rollsUsed: 4,
      rollsChecked: 0,
      rollsReturned: 0,
      pairs: 400,
    });
  });

  it("writes one CSV row per item and week, without use per 100 pairs (D-116)", async () => {
    const { body, from, to } = await svc.materialsCsv({}, now);
    expect([from, to]).toEqual(["2026-09-08", "2026-10-28"]);
    const lines = body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Week,From,To,Item code,Item,Category,Supplier,Unit,Used,Pairs finished");
    expect(lines).toHaveLength(1 + 8 * 2);
    expect(lines).toContain(
      "Week 3 · Oct 15–21,2026-10-15,2026-10-21,LR-001,Black cowhide,Leather roll,Meycauayan Tannery,roll,4,400",
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
    const r = await svc.materialsReport({}, now);
    // 7 used over 7 days is 1 a day: 10 left lasts 10 days.
    expect(r.rows[0]).toMatchObject({ daysLeft: 10 });
    expect(r.rows[0]).not.toHaveProperty("perHundredPairs");
  });

  it("follows the picked week and keeps the 28-day pace (D-109)", async () => {
    const r = await svc.materialsReport({ year: "2026", month: "10", week: "1" }, now);
    expect(r.selected.label).toBe("Week 1 · Oct 1–7");
    // The week before Week 1 is September's last: Sep 29–30, two days.
    expect(r.previous.label).toBe("Week 5 · Sep 29–30");
    expect(r.days).toEqual({ selected: 7, previous: 2 });
    expect(model.usedByDay).toHaveBeenCalledWith("2026-08-22", "2026-10-07");
    const tacks = r.rows.find((x) => x.id === "nl")!;
    expect(tacks).toMatchObject({ thisWeek: 5, lastWeek: 0, change: null });
    // Days left still reads the last 28 days up to today.
    expect(r.pace).toMatchObject({ fromDay: "2026-10-01", toDay: "2026-10-28" });
    expect(r.rows.find((x) => x.id === "lr")).toMatchObject({ daysLeft: 3 });
  });

  it("falls back to today's week for a week that hasn't started", async () => {
    const r = await svc.materialsReport({ year: "2026", month: "11", week: "1" }, now);
    expect(r.selected.label).toBe("Week 4 · Oct 22–28");
  });

  it("finds materials by name or code, any case, trimmed, and keeps the warning for all", async () => {
    const byName = await svc.materialsReport({ q: "  COWHIDE " }, now);
    expect(byName.rows.map((x) => x.id)).toEqual(["lr"]);
    expect(byName.q).toBe("cowhide");
    expect(byName.itemCount).toBe(2);
    expect((await svc.materialsReport({ q: "nl-0" }, now)).rows.map((x) => x.id)).toEqual(["nl"]);
    const none = await svc.materialsReport({ q: "zipper" }, now);
    expect(none.rows).toEqual([]);
    expect((await svc.materialsReport({ q: "   " }, now)).rows).toHaveLength(2);
  });

  it("writes the CSV for the picked week and the search", async () => {
    const { body, from, to } = await svc.materialsCsv(
      { year: "2026", month: "10", week: "3", q: "tacks" },
      now,
    );
    expect([from, to]).toEqual(["2026-09-01", "2026-10-21"]);
    const lines = body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(1 + 8);
    expect(lines.at(-1)).toContain("Week 3 · Oct 15–21,2026-10-15,2026-10-21,NL-001,Tacks");
  });
});
