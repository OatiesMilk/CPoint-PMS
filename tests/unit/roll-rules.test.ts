import { describe, expect, it } from "vitest";
import {
  defaultRollId,
  formatArea,
  formatRollCode,
  freeSupplierCode,
  oldestOpenRoll,
  openSinceLine,
  parseArea,
  planFinish,
  planPutBack,
  planRemove,
  planStart,
  rollClosedMessage,
  rollCodePrefix,
  SUPPLIER_CODE_PATTERN,
  supplierCodeFromName,
} from "@/lib/roll-rules";

describe("roll codes (Phase 30A)", () => {
  it("is LR-, the supplier's code and a three-digit number that can grow", () => {
    expect(rollCodePrefix("MLT")).toBe("LR-MLT");
    expect(formatRollCode("MLT", 7)).toBe("LR-MLT-007");
    expect(formatRollCode("JLS", 1000)).toBe("LR-JLS-1000");
  });

  it("makes a supplier code from the name's initials", () => {
    expect(supplierCodeFromName("Marikina Leather Trading")).toBe("MLT");
    expect(supplierCodeFromName("Meycauayan Tannery")).toBe("MT");
    expect(supplierCodeFromName("JM Leather Supply (Divisoria)")).toBe("JLS");
    expect(supplierCodeFromName("Tannery")).toBe("TAN");
    expect(supplierCodeFromName("A")).toBe("SUP");
    for (const name of ["Marikina Leather Trading", "Tannery", "A"])
      expect(supplierCodeFromName(name)).toMatch(SUPPLIER_CODE_PATTERN);
  });

  it("adds a number when the code is taken, ignoring case", () => {
    expect(freeSupplierCode("MT", [])).toBe("MT");
    expect(freeSupplierCode("MT", ["mt"])).toBe("MT2");
    expect(freeSupplierCode("MT", ["MT", "MT2"])).toBe("MT3");
    expect(freeSupplierCode("ABCDEF", ["ABCDEF"])).toBe("ABCDE2");
  });
});

describe("parseArea (D-103)", () => {
  it("takes 0.1 to 200 square feet with at most two decimals", () => {
    expect(parseArea("24.5", 1)).toEqual({ ok: true, value: 24.5 });
    expect(parseArea(" 0.1 ", 1)).toEqual({ ok: true, value: 0.1 });
    expect(parseArea(200, 1)).toEqual({ ok: true, value: 200 });
  });

  it("names the roll and the fix", () => {
    expect(parseArea("", 2)).toEqual({
      ok: false,
      reason: "Roll 2: enter its area in square feet, like 24.5.",
    });
    expect(parseArea("abc", 3)).toMatchObject({ reason: expect.stringMatching(/^Roll 3: enter/) });
    expect(parseArea("-4", 1)).toMatchObject({ ok: false });
    expect(parseArea("0", 1)).toMatchObject({
      reason: expect.stringContaining("between 0.1 and 200 sq ft"),
    });
    expect(parseArea("200.5", 1)).toMatchObject({ ok: false });
    expect(parseArea("24.125", 4)).toEqual({
      ok: false,
      reason: "Roll 4: use at most two decimals, like 24.75.",
    });
  });

  it("formats an area", () => {
    expect(formatArea(24.5)).toBe("24.5 sq ft");
    expect(formatArea(null)).toBe("—");
  });
});

describe("a roll's moves (Phase 30A)", () => {
  const inv = { fromInventory: true, code: "LR-MLT-001" };

  it("picks only a roll in stock, not scanned yet", () => {
    expect(planStart({ ...inv, status: "IN_STOCK" })).toEqual({ ok: true });
    expect(planStart({ ...inv, status: "OPEN" })).toEqual({
      ok: false,
      reason: "LR-MLT-001 is being scanned at Capture. Choose another roll.",
    });
    expect(planStart({ ...inv, status: "USED" })).toMatchObject({ ok: false });
  });

  it("finishes an open roll with at least one shot, else says put it back", () => {
    expect(planFinish({ status: "OPEN", shots: 1 })).toEqual({ ok: true });
    expect(planFinish({ status: "OPEN", shots: 0 })).toEqual({
      ok: false,
      reason: "A roll needs at least one shot to finish. Put it back instead.",
    });
    expect(planFinish({ status: "FINISHED", shots: 5 })).toMatchObject({
      reason: "This roll is already scanned.",
    });
  });

  it("puts back only an open roll with no shots", () => {
    expect(planPutBack({ status: "OPEN", shots: 0 })).toEqual({ ok: true });
    expect(planPutBack({ status: "OPEN", shots: 2 })).toMatchObject({
      reason: expect.stringMatching(/can’t be put back/),
    });
    expect(planPutBack({ status: "IN_STOCK", shots: 0 })).toMatchObject({ ok: false });
  });

  it("lets the Floor Manager remove a roll from Inventory while it is in stock or being scanned (Phase 30E)", () => {
    for (const status of ["IN_STOCK", "OPEN"] as const)
      expect(planRemove({ ...inv, status })).toEqual({ ok: true });
    // A scanned roll is already off stock (D-112).
    expect(planRemove({ ...inv, status: "FINISHED" })).toMatchObject({
      reason: "LR-MLT-001 is already scanned.",
    });
    expect(planRemove({ ...inv, status: "USED" })).toMatchObject({
      reason: "LR-MLT-001 was marked fully used.",
    });
    expect(planRemove({ ...inv, status: "CANCELLED" })).toMatchObject({ ok: false });
  });

  it("removes a roll from before Phase 30A only while it is open, as the old Cancel", () => {
    expect(planRemove({ status: "OPEN" })).toEqual({ ok: true });
    expect(planRemove({ status: "FINISHED" })).toMatchObject({ ok: false });
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
    expect(rollClosedMessage("LR-MLT-003")).toBe(
      "LR-MLT-003 isn’t being scanned any more, so this shot wasn’t saved. Choose another roll, or scan a new one.",
    );
  });
});
