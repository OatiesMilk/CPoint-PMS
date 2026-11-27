import { describe, expect, it } from "vitest";
import {
  addRollTagSchema,
  editRollTagSchema,
  isRollTagId,
} from "@/server/validators/roll-tag.validator";

const SUPPLIER = "0199a000-0000-7000-8000-000000000001";

describe("addRollTagSchema (Phase 42, D-139)", () => {
  it("takes the code in capitals, an optional supplier and an optional default", () => {
    expect(addRollTagSchema.parse({ code: " blc " })).toEqual({
      code: "BLC",
      supplierId: null,
      isDefault: false,
    });
    expect(addRollTagSchema.parse({ code: "BSA", supplierId: SUPPLIER, isDefault: true })).toEqual({
      code: "BSA",
      supplierId: SUPPLIER,
      isDefault: true,
    });
    expect(addRollTagSchema.parse({ code: "BSA", supplierId: "" }).supplierId).toBeNull();
    expect(addRollTagSchema.parse({ code: "BSA", supplierId: null }).supplierId).toBeNull();
  });

  it("names the code, the supplier and the default when they are wrong", () => {
    const r = addRollTagSchema.safeParse({ code: "1a", supplierId: "nope", isDefault: "yes" });
    expect(r.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      [
        "code",
        "Enter a tag code of 2 to 6 capital letters or digits, starting with a letter, like BLC.",
      ],
      ["supplierId", "Choose a supplier from the list, or leave it empty for any supplier."],
      ["isDefault", "Choose whether this is the supplier’s default tag."],
    ]);
    expect(addRollTagSchema.safeParse({}).error?.issues[0].path).toEqual(["code"]);
  });
});

describe("editRollTagSchema", () => {
  it("changes only the fields sent", () => {
    expect(editRollTagSchema.parse({})).toEqual({});
    expect(editRollTagSchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(editRollTagSchema.parse({ supplierId: "" })).toEqual({ supplierId: null });
    expect(editRollTagSchema.parse({ code: "mlt", isDefault: true })).toEqual({
      code: "MLT",
      isDefault: true,
    });
  });
});

describe("isRollTagId", () => {
  it("is true for a uuid only, so anything else is a 404", () => {
    expect(isRollTagId(SUPPLIER)).toBe(true);
    expect(isRollTagId("abc")).toBe(false);
  });
});
