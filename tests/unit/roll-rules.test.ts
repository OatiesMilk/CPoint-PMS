import { describe, expect, it } from "vitest";
import {
  defaultRollId,
  formatRollCode,
  oldestOpenRoll,
  openSinceLine,
  planCancel,
  planFinish,
  rollClosedMessage,
} from "@/lib/roll-rules";

describe("formatRollCode (Phase 26)", () => {
  it("pads the yearly number to four digits with an R- prefix", () => {
    expect(formatRollCode(2026, 7)).toBe("R-2026-0007");
    expect(formatRollCode(2026, 12345)).toBe("R-2026-12345");
  });
});

describe("planFinish", () => {
  it("finishes an open roll with at least one shot", () => {
    expect(planFinish({ status: "OPEN", shots: 1 })).toEqual({ ok: true });
  });

  it("refuses an empty roll and points to Cancel", () => {
    expect(planFinish({ status: "OPEN", shots: 0 })).toEqual({
      ok: false,
      reason: "A roll needs at least one shot to finish. Cancel it instead.",
    });
  });

  it("refuses a roll that is already closed, saying how", () => {
    expect(planFinish({ status: "FINISHED", shots: 5 })).toMatchObject({
      reason: "This roll is already finished.",
    });
    expect(planFinish({ status: "CANCELLED", shots: 0 })).toMatchObject({
      reason: "This roll is already cancelled.",
    });
  });
});

describe("planCancel", () => {
  it("cancels an empty roll at Capture, but not one with shots", () => {
    expect(planCancel({ status: "OPEN", shots: 0 }, "capture")).toEqual({ ok: true });
    expect(planCancel({ status: "OPEN", shots: 3 }, "capture")).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/can’t be cancelled here.*ask the Floor Manager/),
    });
  });

  it("lets the Floor Manager cancel any open roll", () => {
    expect(planCancel({ status: "OPEN", shots: 3 }, "manager")).toEqual({ ok: true });
    expect(planCancel({ status: "FINISHED", shots: 3 }, "manager")).toMatchObject({ ok: false });
  });
});

describe("defaultRollId: where the Roll dropdown starts", () => {
  const open = [
    { id: "a", startedAt: "2026-10-24T01:00:00Z", mine: false },
    { id: "b", startedAt: "2026-10-24T02:00:00Z", mine: true },
    { id: "c", startedAt: "2026-10-24T03:00:00Z", mine: true },
  ];

  it("keeps the roll this browser last used while it is open", () => {
    expect(defaultRollId(open, { lastUsedId: "a" })).toBe("a");
  });

  it("else takes this person's newest roll", () => {
    expect(defaultRollId(open, { lastUsedId: "gone" })).toBe("c");
    expect(defaultRollId(open, {})).toBe("c");
  });

  it("else the only open roll, else nothing: the person chooses", () => {
    expect(defaultRollId([open[0]], {})).toBe("a");
    expect(defaultRollId([open[0], { ...open[1], mine: false }], {})).toBeNull();
    expect(defaultRollId([], { lastUsedId: "a" })).toBeNull();
  });
});

describe("oldestOpenRoll (a device token's fallback)", () => {
  it("takes the roll open the longest", () => {
    expect(
      oldestOpenRoll([
        { id: "new", startedAt: new Date("2026-10-24T03:00:00Z") },
        { id: "old", startedAt: new Date("2026-10-23T03:00:00Z") },
      ])?.id,
    ).toBe("old");
    expect(oldestOpenRoll([])).toBeNull();
  });
});

describe("messages", () => {
  it("says a roll from an earlier day is still open", () => {
    expect(openSinceLine("2026-10-22", "2026-10-24", "Thu, 22 Oct")).toBe(
      "Open since Thu, 22 Oct. Finish it or keep capturing.",
    );
    expect(openSinceLine("2026-10-24", "2026-10-24", "Sat, 24 Oct")).toBeNull();
  });

  it("names the closed roll when a shot couldn't be saved", () => {
    expect(rollClosedMessage("R-2026-0003")).toBe(
      "R-2026-0003 was finished or cancelled, so this shot wasn’t saved. Choose another roll, or start one.",
    );
  });
});
