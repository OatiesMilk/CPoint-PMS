import { describe, expect, it } from "vitest";
import {
  addLocationSchema,
  editLocationSchema,
  moveRollsSchema,
  putBackSchema,
} from "@/server/validators/location.validator";

const ID = "0192f000-0000-7000-8000-000000000001";

describe("location forms (Phase 32, D-128)", () => {
  it("upper-cases the code and treats empty optional boxes as none", () => {
    expect(
      addLocationSchema.parse({ code: " r1-b3 ", kind: "BIN", name: "  ", notes: "" }),
    ).toEqual({ code: "R1-B3", kind: "BIN", name: null, notes: null });
  });

  it("puts each message under its field", () => {
    const r = addLocationSchema.safeParse({ code: "R1 B3", kind: "SHELF" });
    expect(r.success).toBe(false);
    const byField = Object.fromEntries(r.error!.issues.map((i) => [i.path[0], i.message]));
    expect(byField.code).toBe("Location code: use 2 to 20 letters, numbers or dashes, like R1-B3.");
    expect(byField.kind).toBe("Choose what it is: a rack, a bin or an area.");
  });

  it("changes on Edit only what was sent; an emptied name clears it", () => {
    expect(editLocationSchema.parse({ isActive: false })).toEqual({
      isActive: false,
      name: undefined,
      notes: undefined,
    });
    expect(editLocationSchema.parse({ name: "" })).toMatchObject({ name: null });
  });

  it("moves 1 to 50 rolls, each once", () => {
    expect(moveRollsSchema.parse({ rollIds: [ID, ID], toLocationId: ID })).toEqual({
      rollIds: [ID],
      toLocationId: ID,
      note: null,
    });
  });

  it("lets Put back go without a place", () => {
    expect(putBackSchema.parse({})).toEqual({});
    expect(putBackSchema.parse({ locationId: null })).toEqual({ locationId: null });
  });
});
