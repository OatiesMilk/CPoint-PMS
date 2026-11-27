import { describe, expect, it } from "vitest";
import {
  groupTagsForSupplier,
  isTagCode,
  normalizeTagCode,
  planTagCodeChange,
  planTagRemove,
  tagCodeTakenMessage,
  tagLabel,
  type RollTagOption,
} from "@/lib/roll-tag-rules";

describe("roll tag codes (Phase 42, D-139)", () => {
  it("are 2 to 6 capital letters or digits, starting with a letter, after trimming and upper-casing", () => {
    expect(normalizeTagCode("  blc ")).toBe("BLC");
    for (const ok of ["BLC", "BSA2", "AB", "ABCDEF", "B12345"]) expect(isTagCode(ok)).toBe(true);
    for (const bad of ["", "B", "ABCDEFG", "1AB", "AB-1", "ab", "A B"])
      expect(isTagCode(bad)).toBe(false);
  });

  it("names the tag that already has the code", () => {
    expect(tagCodeTakenMessage("BLC")).toBe("BLC is already a roll tag. Choose another code.");
  });
});

describe("what changes once rolls were made from a tag (A-122)", () => {
  it("lets the code change and the tag go while no roll used it", () => {
    expect(planTagCodeChange("BLC", 0)).toEqual({ ok: true });
    expect(planTagRemove("BLC", 0)).toEqual({ ok: true });
  });

  it("locks the code and the removal once a roll did, and says what to do instead", () => {
    const code = planTagCodeChange("BLC", 3);
    expect(code).toMatchObject({ ok: false });
    expect(code.ok === false && code.reason).toContain("3 rolls were made from BLC");
    expect(code.ok === false && code.reason).toContain("Add a new tag instead");
    const one = planTagRemove("BLC", 1);
    expect(one.ok === false && one.reason).toBe(
      "A roll was made from BLC, so it can’t be removed. Deactivate it instead: its rolls keep their codes and it leaves the list in Add rolls.",
    );
  });
});

describe("the Add rolls dropdown", () => {
  const tag = (code: string, supplierId: string | null, isDefault = false): RollTagOption => ({
    id: `t-${code}`,
    code,
    supplierId,
    supplierName: supplierId ? `Supplier ${supplierId}` : null,
    isDefault,
  });
  const tags = [tag("ZZZ", null), tag("BSA", "a", true), tag("BLC", "a"), tag("MLT", "b", true)];

  it("lists the supplier's tags first and every other tag after, each by code", () => {
    const g = groupTagsForSupplier(tags, "a");
    expect(g.mine.map((t) => t.code)).toEqual(["BLC", "BSA"]);
    expect(g.other.map((t) => t.code)).toEqual(["MLT", "ZZZ"]);
  });

  it("preselects the supplier's default tag", () => {
    expect(groupTagsForSupplier(tags, "a").defaultId).toBe("t-BSA");
    expect(groupTagsForSupplier(tags, "b").defaultId).toBe("t-MLT");
  });

  it("starts on 'Choose a tag' when the supplier has no default, or the item has no supplier", () => {
    expect(groupTagsForSupplier(tags, "c").defaultId).toBe("");
    expect(groupTagsForSupplier(tags, null)).toMatchObject({ defaultId: "", mine: [] });
    expect(groupTagsForSupplier([tag("BLC", "a")], "a").defaultId).toBe("");
  });

  it("labels a tag with its supplier, or just the code for any supplier", () => {
    expect(tagLabel(tag("BLC", "a"))).toBe("BLC · Supplier a");
    expect(tagLabel(tag("ZZZ", null))).toBe("ZZZ");
  });
});
