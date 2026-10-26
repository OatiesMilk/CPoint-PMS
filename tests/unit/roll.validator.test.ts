import { describe, expect, it } from "vitest";
import {
  addRollsSchema,
  isRollId,
  itemRollsQuerySchema,
  removeRollSchema,
  rollListQuerySchema,
  usedRollIdsSchema,
} from "@/server/validators/roll.validator";

const SUPPLIER = "0199a000-0000-7000-8000-000000000001";

describe("addRollsSchema (Phase 30A, D-103)", () => {
  it("takes the day they arrived and one area per roll, with an optional tag", () => {
    expect(
      addRollsSchema.parse({
        receivedOn: " 2026-10-26 ",
        rolls: [
          { areaSqFt: "24.5", tagCode: " T-1 " },
          { areaSqFt: 30, tagCode: "  " },
        ],
      }),
    ).toEqual({
      receivedOn: "2026-10-26",
      rolls: [
        { areaSqFt: 24.5, tagCode: "T-1" },
        { areaSqFt: 30, tagCode: undefined },
      ],
    });
  });

  it("puts each message under its roll's field", () => {
    const r = addRollsSchema.safeParse({
      receivedOn: "2026-10-26",
      rolls: [{ areaSqFt: "24" }, { areaSqFt: "" }, { areaSqFt: "5", tagCode: "x".repeat(41) }],
    });
    expect(r.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["rolls.1.areaSqFt", "Roll 2: enter its area in square feet, like 24.5."],
      ["rolls.2.tagCode", "Roll 3: The supplier’s tag can be up to 40 characters."],
    ]);
  });

  it("needs a real date and one to fifty rolls", () => {
    expect(
      addRollsSchema.safeParse({ receivedOn: "26 Oct", rolls: [{ areaSqFt: "2" }] }).error
        ?.issues[0].message,
    ).toBe("Enter the day the rolls arrived, like 2026-10-26.");
    expect(
      addRollsSchema.safeParse({ receivedOn: "2026-10-26", rolls: [] }).error?.issues[0].message,
    ).toBe("Add at least one roll.");
    expect(
      addRollsSchema.safeParse({
        receivedOn: "2026-10-26",
        rolls: Array.from({ length: 51 }, () => ({ areaSqFt: "2" })),
      }).error?.issues[0].message,
    ).toBe("Add at most 50 rolls at a time.");
  });
});

describe("removeRollSchema", () => {
  it("needs a reason of up to 200 characters", () => {
    expect(removeRollSchema.parse({ reason: "  Water damage  " })).toEqual({
      reason: "Water damage",
    });
    expect(removeRollSchema.safeParse({ reason: " " }).error?.issues[0].message).toBe(
      "Write why this roll is removed.",
    );
    expect(removeRollSchema.safeParse({}).error?.issues[0].message).toBe(
      "Write why this roll is removed.",
    );
    expect(removeRollSchema.safeParse({ reason: "x".repeat(201) }).error?.issues[0].message).toBe(
      "The reason can be up to 200 characters.",
    );
  });
});

describe("usedRollIdsSchema (Finish batch, Phase 30A)", () => {
  it("takes no list, an empty list or roll ids", () => {
    expect(usedRollIdsSchema.parse(undefined)).toBeUndefined();
    expect(usedRollIdsSchema.parse([])).toEqual([]);
    expect(usedRollIdsSchema.parse([SUPPLIER])).toEqual([SUPPLIER]);
  });

  it("refuses something that isn't a roll", () => {
    expect(usedRollIdsSchema.safeParse(["LR-MLT-001"]).error?.issues[0].message).toBe(
      "A ticked roll wasn’t found. Refresh the page.",
    );
  });
});

describe("itemRollsQuerySchema", () => {
  it("keeps a valid status and page, drops the rest", () => {
    expect(itemRollsQuerySchema.parse({ rollStatus: "IN_STOCK", rollPage: "2" })).toEqual({
      rollStatus: "IN_STOCK",
      rollPage: 2,
    });
    expect(itemRollsQuerySchema.parse({ rollStatus: "NOPE", rollPage: "0" })).toEqual({
      rollStatus: undefined,
      rollPage: undefined,
    });
  });
});

describe("rollListQuerySchema", () => {
  it("keeps valid filters", () => {
    expect(
      rollListQuerySchema.parse({ status: "OPEN", supplierId: SUPPLIER, days: "30", q: " R-2 " }),
    ).toEqual({ status: "OPEN", supplierId: SUPPLIER, days: 30, q: "R-2", page: undefined });
  });

  it("drops invalid filter values instead of failing the page", () => {
    expect(
      rollListQuerySchema.parse({
        status: "IN_PROGRESS",
        supplierId: "x",
        days: "14",
        page: "-3",
        stage: "SOLEING",
        shoeTypeId: "x",
      }),
    ).toEqual({
      status: undefined,
      supplierId: undefined,
      days: undefined,
      q: undefined,
      page: undefined,
    });
  });
});

describe("isRollId", () => {
  it("accepts a UUID only", () => {
    expect(isRollId(SUPPLIER)).toBe(true);
    expect(isRollId("R-2026-0001")).toBe(false);
  });
});
