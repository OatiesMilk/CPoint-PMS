import { describe, expect, it } from "vitest";
import {
  BEFORE_QUEUE_REASON,
  batchCode,
  batchRollsLine,
  batchesFor,
  compareQueue,
  isBatchCode,
  isQueued,
  queueState,
  syncBatches,
  waitingFor,
  type ExistingBatchRow,
} from "@/lib/production-rules";

// The Inspection queue's rules (Phase 33, D-129, A-57 to A-61, A-83). Manila is UTC+8.
const MON = "2026-11-16";
const manila = (hhmm: string, day = MON) => new Date(`${day}T${hhmm}:00+08:00`);
const every4h = { shiftStart: "08:00", shiftEnd: "17:00", intervalMinutes: 240 };
const LUNCH = [{ startTime: "11:00", endTime: "12:00" }];

describe("batchCode (A-57)", () => {
  it("is B-YYMMDD-N, the day and the batch number", () => {
    expect(batchCode("2026-11-16", 2)).toBe("B-261116-2");
    expect(batchCode("2027-01-05", 12)).toBe("B-270105-12");
  });

  it("is on every batch the plan gives, with the label", () => {
    const [b1, b2] = batchesFor(every4h, LUNCH, MON);
    expect(b1.code).toBe("B-261116-1");
    expect(b2.label).toBe("B-261116-2 · 13:00–17:00");
  });

  it("tells a batch code from a roll code", () => {
    expect(isBatchCode("b-261116-2")).toBe(true);
    expect(isBatchCode("B-2026-0003")).toBe(false);
    expect(isBatchCode("LR-MLT-004")).toBe(false);
  });
});

describe("queueState: only what people did is stored, the rest is the clock", () => {
  const open = {
    status: "OPEN" as const,
    startAt: manila("13:00"),
    slotAt: manila("17:00"),
  };

  it("runs Upcoming, In progress, Waiting, then Late 30 minutes after its end (D-084)", () => {
    expect(queueState(open, manila("12:59"))).toBe("UPCOMING");
    expect(queueState(open, manila("16:59"))).toBe("IN_PROGRESS");
    expect(queueState(open, manila("17:00"))).toBe("WAITING");
    expect(queueState(open, manila("17:30"))).toBe("WAITING");
    expect(queueState(open, manila("17:31"))).toBe("LATE");
  });

  it("never becomes Missed at midnight: it waits until inspected or voided", () => {
    expect(queueState(open, manila("09:00", "2026-11-18"))).toBe("LATE");
    expect(isQueued(queueState(open, manila("09:00", "2026-11-18")))).toBe(true);
  });

  it("follows the clock back too, as the demo clock moves (D-125)", () => {
    expect(queueState(open, manila("18:00"))).toBe("LATE");
    expect(queueState(open, manila("10:00"))).toBe("UPCOMING");
  });

  it("reads the stored status first", () => {
    expect(queueState({ ...open, status: "INSPECTING" }, manila("17:10"))).toBe("INSPECTING");
    expect(queueState({ ...open, status: "INSPECTED" }, manila("17:10"))).toBe("INSPECTED");
    expect(queueState({ ...open, status: "VOID" }, manila("17:10"))).toBe("VOID");
    expect(isQueued("INSPECTED")).toBe(false);
    expect(isQueued("VOID")).toBe(false);
    expect(isQueued("UPCOMING")).toBe(false);
  });
});

describe("compareQueue (A-58)", () => {
  const b = (code: string, slot: string, priority: "NORMAL" | "URGENT", number = 1) => ({
    code,
    slotAt: new Date(slot),
    priority,
    number,
  });

  it("puts Urgent first, then the one that has waited longest, then the number", () => {
    const list = [
      b("today-2", "2026-11-17T09:00:00Z", "NORMAL", 2),
      b("today-urgent", "2026-11-17T05:00:00Z", "URGENT"),
      b("yesterday", "2026-11-16T09:00:00Z", "NORMAL", 2),
      b("today-1", "2026-11-17T05:00:00Z", "NORMAL"),
      b("old-urgent", "2026-11-13T09:00:00Z", "URGENT"),
    ];
    expect(list.sort(compareQueue).map((x) => x.code)).toEqual([
      "old-urgent",
      "today-urgent",
      "yesterday",
      "today-1",
      "today-2",
    ]);
  });
});

describe("waitingFor and batchRollsLine", () => {
  it("says how long it has waited", () => {
    expect(waitingFor(manila("12:00"), manila("15:10"))).toBe("Waiting 3 hours 10 minutes");
  });

  it("lists the rolls by leather, most first (A-83)", () => {
    const rolls = [
      ...Array(4).fill({ item: "Full-grain black" }),
      { item: "Suede brown" },
      { item: "Suede brown" },
    ];
    expect(batchRollsLine(rolls)).toBe("6 rolls (Full-grain black ×4, Suede brown ×2)");
    expect(batchRollsLine([{ item: "Suede brown" }])).toBe("1 roll (Suede brown)");
    expect(batchRollsLine([])).toBe("No rolls scanned");
  });
});

describe("syncBatches: a day's rows follow its plan", () => {
  const batches = batchesFor(every4h, LUNCH, MON); // 08:00–13:00, 13:00–17:00
  const row = (number: number, over: Partial<ExistingBatchRow> = {}): ExistingBatchRow => ({
    id: `r${number}`,
    number,
    slotAt: batches[number - 1].at,
    status: "OPEN",
    priority: "NORMAL",
    inspected: false,
    ...over,
  });

  it("makes every missing row, open", () => {
    const s = syncBatches(MON, batches, [], null);
    expect(s.insert.map((b) => [b.code, b.void])).toEqual([
      ["B-261116-1", false],
      ["B-261116-2", false],
    ]);
    expect(s.remove).toEqual([]);
    expect(s.blocked).toEqual([]);
  });

  it("changes nothing when the rows match", () => {
    expect(syncBatches(MON, batches, [row(1), row(2)], null)).toEqual({
      insert: [],
      remove: [],
      blocked: [],
    });
  });

  it("remakes rows nobody acted on when the plan changes", () => {
    const once = batchesFor({ ...every4h, intervalMinutes: null }, LUNCH, MON); // 08:00–17:00
    // Row 2 ends at 17:00 like the new batch 1, but its number changes: both are remade.
    const s = syncBatches(MON, once, [row(1), row(2)], null);
    expect(s.remove).toEqual(["r1", "r2"]);
    expect(s.insert.map((b) => b.code)).toEqual(["B-261116-1"]);
    expect(s.blocked).toEqual([]);
  });

  it("blocks a change that would move a batch someone acted on, naming it", () => {
    const once = batchesFor({ ...every4h, intervalMinutes: null }, LUNCH, MON);
    expect(
      syncBatches(MON, once, [row(1, { status: "INSPECTING" }), row(2)], null).blocked,
    ).toEqual([{ code: "B-261116-1", reason: "is being inspected" }]);
    expect(syncBatches(MON, once, [row(1, { priority: "URGENT" })], null).blocked).toEqual([
      { code: "B-261116-1", reason: "is marked Urgent" },
    ]);
    expect(syncBatches(MON, [], [row(1, { status: "VOID" })], null).blocked).toEqual([
      { code: "B-261116-1", reason: "was voided" },
    ]);
  });

  it("makes a batch that ended before the queue began Void (A-61)", () => {
    const s = syncBatches(MON, batches, [], manila("15:00"));
    expect(s.insert.map((b) => [b.code, b.void])).toEqual([
      ["B-261116-1", true],
      ["B-261116-2", false],
    ]);
    expect(BEFORE_QUEUE_REASON).toBe("Not inspected, from before the queue");
  });
});
