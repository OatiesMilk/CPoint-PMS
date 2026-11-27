import { describe, expect, it } from "vitest";
import {
  defaultRollId,
  formatArea,
  formatRollCode,
  freeSupplierCode,
  oldestOpenRoll,
  openSinceLine,
  parseArea,
  areaEditable,
  planFinish,
  planRollEdit,
  type RollEditCurrent,
  planPutBack,
  planRemove,
  planStart,
  rollClosedMessage,
  highestRollNumber,
  parseRollNumber,
  previewRollCodes,
  rollCodePrefix,
  rollCodeTakenMessage,
  SUPPLIER_CODE_PATTERN,
  supplierCodeFromName,
} from "@/lib/roll-rules";

describe("roll codes (Phase 30A; the roll tag starts them since Phase 42)", () => {
  it("is LR-, the roll tag's code and a three-digit number that can grow", () => {
    expect(rollCodePrefix("MLT")).toBe("LR-MLT");
    expect(formatRollCode("MLT", 7)).toBe("LR-MLT-007");
    expect(formatRollCode("BLC", 1)).toBe("LR-BLC-001");
    expect(formatRollCode("JLS", 1000)).toBe("LR-JLS-1000");
  });

  it("reads the digits typed after a tag: 1 to 6 digits, 1 or more; empty means next free", () => {
    expect(parseRollNumber("001", 1)).toEqual({ ok: true, value: 1 });
    expect(parseRollNumber(" 12 ", 1)).toEqual({ ok: true, value: 12 });
    expect(parseRollNumber(7, 1)).toEqual({ ok: true, value: 7 });
    expect(parseRollNumber("999999", 1)).toEqual({ ok: true, value: 999999 });
    for (const empty of ["", "  ", undefined, null])
      expect(parseRollNumber(empty, 1)).toEqual({ ok: true, value: null });
    for (const bad of ["0", "000", "1234567", "12a", "-1", "1.5", "abc"]) {
      expect(parseRollNumber(bad, 3)).toEqual({
        ok: false,
        reason:
          "Roll 3: type the digits after the tag, like 001 (up to 6 digits). Leave them empty for the next free number.",
      });
    }
  });

  it("finds the highest number under a prefix and ignores codes that aren't LR-<tag>-digits", () => {
    const codes = [
      "LR-BLC-001",
      "LR-BLC-1234",
      "LR-BLC-X-009",
      "LR-BLCD-050",
      "B-261116-2",
      "LR-BLC-",
    ];
    expect(highestRollNumber(codes, "LR-BLC")).toBe(1234);
    expect(highestRollNumber(codes, "LR-BLCD")).toBe(50);
    expect(highestRollNumber(codes, "LR-NEW")).toBe(0);
    expect(highestRollNumber([], "LR-BLC")).toBe(0);
  });

  it("previews each row's code the way the server will give it", () => {
    expect(
      previewRollCodes(
        [
          { tagCode: "BLC", number: null },
          { tagCode: "BLC", number: null },
          { tagCode: "BLC", number: 20 },
          { tagCode: "BLC", number: null },
          { tagCode: "MLT", number: null },
          { tagCode: null, number: 5 },
        ],
        { BLC: 3, MLT: 0 },
      ),
    ).toEqual(["LR-BLC-004", "LR-BLC-005", "LR-BLC-020", "LR-BLC-021", "LR-MLT-001", null]);
  });

  it("says which number is next free when a typed one is taken", () => {
    expect(rollCodeTakenMessage(2, "LR-BLC-001", "LR-BLC-004")).toBe(
      "Roll 2: LR-BLC-001 is already a roll. Next free: LR-BLC-004.",
    );
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

describe("planRollEdit: the Floor Manager's corrections (Phase 35B, A-104)", () => {
  const roll = (over: Partial<RollEditCurrent> = {}): RollEditCurrent => ({
    status: "IN_STOCK",
    fromInventory: true,
    tagCode: "T-1",
    receivedOn: "2026-10-20",
    areaSqFt: 24.5,
    returnDecision: null,
    returnNote: null,
    ...over,
  });
  const TODAY = "2026-10-26";

  it("returns just what changes, with the old values", () => {
    expect(
      planRollEdit(roll(), { tagCode: " T-9 ", receivedOn: "2026-10-20", areaSqFt: "30" }, TODAY),
    ).toEqual({
      ok: true,
      changes: { tagCode: "T-9", areaSqFt: 30 },
      before: { tagCode: "T-1", areaSqFt: 24.5 },
    });
    // An empty tag clears it; a field left out is untouched.
    expect(planRollEdit(roll(), { tagCode: "  " }, TODAY)).toEqual({
      ok: true,
      changes: { tagCode: null },
      before: { tagCode: "T-1" },
    });
  });

  it("says nothing changed rather than saving an empty correction", () => {
    expect(planRollEdit(roll(), {}, TODAY)).toEqual({
      ok: false,
      errors: { form: "Nothing changed. Change a field, or close this window." },
    });
    expect(planRollEdit(roll(), { tagCode: "T-1", areaSqFt: 24.5 }, TODAY)).toMatchObject({
      ok: false,
    });
  });

  it("checks the tag, the day and the area, each naming its field and the fix", () => {
    const r = planRollEdit(
      roll(),
      { tagCode: "x".repeat(41), receivedOn: "2026-10-27", areaSqFt: "abc" },
      TODAY,
    );
    expect(r).toEqual({
      ok: false,
      errors: {
        tagCode: "The supplier’s tag can be up to 40 characters.",
        receivedOn: "The day the rolls arrived can’t be after today.",
        areaSqFt: "Enter the area as a number of square feet, like 24.5.",
      },
    });
    expect(planRollEdit(roll(), { receivedOn: "yesterday" }, TODAY)).toMatchObject({
      errors: { receivedOn: "Enter the day the rolls arrived, like 2026-10-26." },
    });
    expect(planRollEdit(roll(), { areaSqFt: "500" }, TODAY)).toMatchObject({
      errors: {
        areaSqFt: "The area must be between 0.1 and 200 sq ft. Check the stamp or the receipt.",
      },
    });
  });

  it("allows the area only before Finish roll, and only for a roll from Inventory (A-104)", () => {
    expect(areaEditable({ status: "IN_STOCK", fromInventory: true })).toBe(true);
    expect(areaEditable({ status: "OPEN", fromInventory: true })).toBe(true);
    for (const status of ["FINISHED", "USED", "RETURNED", "CANCELLED"] as const)
      expect(areaEditable({ status, fromInventory: true })).toBe(false);
    expect(areaEditable({ status: "IN_STOCK", fromInventory: false })).toBe(false);
    expect(planRollEdit(roll({ status: "FINISHED" }), { areaSqFt: "30" }, TODAY)).toEqual({
      ok: false,
      errors: {
        areaSqFt:
          "The area can't change after Finish roll: the defect share and the return mark were worked out from it.",
      },
    });
    // Sending the area it already has is not a change, so it is not refused.
    expect(
      planRollEdit(roll({ status: "FINISHED" }), { areaSqFt: "24.5", tagCode: "T-2" }, TODAY),
    ).toMatchObject({ ok: true, changes: { tagCode: "T-2" } });
    expect(
      planRollEdit(roll({ fromInventory: false, areaSqFt: null }), { areaSqFt: "10" }, TODAY),
    ).toMatchObject({ errors: { areaSqFt: "Only a roll from Inventory has an area to correct." } });
  });

  it("changes the return note only after a decision, and a kept roll keeps its reason", () => {
    expect(planRollEdit(roll(), { returnNote: "Sent" }, TODAY)).toMatchObject({
      errors: { returnNote: expect.stringContaining("no return decision") },
    });
    const returned = roll({ returnDecision: "RETURNED", returnNote: "Sent Monday" });
    expect(planRollEdit(returned, { returnNote: "" }, TODAY)).toEqual({
      ok: true,
      changes: { returnNote: null },
      before: { returnNote: "Sent Monday" },
    });
    const kept = roll({ returnDecision: "KEPT", returnNote: "Within tolerance" });
    expect(planRollEdit(kept, { returnNote: "  " }, TODAY)).toMatchObject({
      errors: { returnNote: expect.stringContaining("needs the reason") },
    });
    expect(planRollEdit(kept, { returnNote: "x".repeat(201) }, TODAY)).toMatchObject({
      errors: { returnNote: "Keep the note under 200 characters." },
    });
  });
});
