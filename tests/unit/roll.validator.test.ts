import { describe, expect, it } from "vitest";
import {
  isRollId,
  managerCancelSchema,
  rollListQuerySchema,
  startRollSchema,
} from "@/server/validators/roll.validator";

const SUPPLIER = "0199a000-0000-7000-8000-000000000001";

describe("startRollSchema (Phase 26)", () => {
  it("needs the supplier and trims the optional tag number", () => {
    expect(startRollSchema.parse({ supplierId: SUPPLIER, tagCode: " LR-0412 " })).toEqual({
      supplierId: SUPPLIER,
      tagCode: "LR-0412",
    });
    expect(startRollSchema.parse({ supplierId: SUPPLIER, tagCode: "  " })).toEqual({
      supplierId: SUPPLIER,
      tagCode: undefined,
    });
  });

  it("names the supplier field when it is missing or not a supplier", () => {
    for (const supplierId of [undefined, "", "nope"]) {
      const r = startRollSchema.safeParse({ supplierId });
      expect(r.error?.issues).toEqual([
        expect.objectContaining({
          path: ["supplierId"],
          message: "Choose the supplier this roll came from.",
        }),
      ]);
    }
  });

  it("limits the tag number to 40 characters", () => {
    const r = startRollSchema.safeParse({ supplierId: SUPPLIER, tagCode: "x".repeat(41) });
    expect(r.error?.issues[0].message).toBe("Roll code can be up to 40 characters.");
  });

  it("ignores the old roll fields (shoe type, received date, notes)", () => {
    const parsed = startRollSchema.parse({
      supplierId: SUPPLIER,
      shoeTypeId: SUPPLIER,
      receivedAt: "2026-10-01",
      notes: "x",
    });
    expect(Object.keys(parsed)).toEqual(["supplierId"]);
  });
});

describe("managerCancelSchema", () => {
  it("needs a reason of up to 200 characters", () => {
    expect(managerCancelSchema.parse({ reason: "  Wrong supplier  " })).toEqual({
      reason: "Wrong supplier",
    });
    expect(managerCancelSchema.safeParse({ reason: " " }).error?.issues[0].message).toBe(
      "Write why this roll is cancelled.",
    );
    expect(managerCancelSchema.safeParse({}).error?.issues[0].message).toBe(
      "Write why this roll is cancelled.",
    );
    expect(
      managerCancelSchema.safeParse({ reason: "x".repeat(201) }).error?.issues[0].message,
    ).toBe("The reason can be up to 200 characters.");
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
