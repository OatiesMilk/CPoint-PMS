/**
 * Roll tags (Phase 42, D-139): the list whose codes start every roll code, LR-<tag>-001. The Floor
 * Manager keeps it under Inventory → Roll tags; Add rolls picks one per roll, the supplier's default
 * first. CPoint hasn't confirmed its real tag codes (A-119): BLC is a placeholder. Pure, so every
 * rule and refusal is unit-tested.
 */
import { SUPPLIER_CODE_PATTERN } from "./roll-rules";

/** The same shape as a supplier's short code: 2 to 6 capital letters or digits, starting with a letter. */
export const ROLL_TAG_CODE_PATTERN = SUPPLIER_CODE_PATTERN;

export const ROLL_TAG_MESSAGES = {
  code: "Enter a tag code of 2 to 6 capital letters or digits, starting with a letter, like BLC.",
  chooseSupplier: "Choose a supplier from the list, or leave it empty for any supplier.",
  chooseTag: "Choose a tag from the list.",
  isDefault: "Choose whether this is the supplier’s default tag.",
  defaultNeedsSupplier:
    "A default tag belongs to one supplier. Choose the supplier, or untick Default for this supplier.",
  inactiveDefault: "A deactivated tag can’t be a supplier’s default. Reactivate it first.",
} as const;

/** What is typed in the code box: trimmed and upper-cased. */
export function normalizeTagCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isTagCode(code: string): boolean {
  return ROLL_TAG_CODE_PATTERN.test(code);
}

/** The line for a code that is another tag already. */
export function tagCodeTakenMessage(code: string): string {
  return `${code} is already a roll tag. Choose another code.`;
}

export type TagPlan = { ok: true } | { ok: false; reason: string };

/**
 * A tag's code is on printed labels once a roll was made from it (A-122), so it can't change then;
 * change the supplier or deactivate it instead.
 */
export function planTagCodeChange(code: string, rollsUsing: number): TagPlan {
  if (rollsUsing === 0) return { ok: true };
  return {
    ok: false,
    reason: `${rollsUsing === 1 ? "A roll was" : `${rollsUsing} rolls were`} made from ${code}, so its code is on printed labels and stays. Add a new tag instead, and deactivate this one if it shouldn’t be used again.`,
  };
}

/** Remove only a tag no roll was ever made from (A-122); otherwise it is deactivated. */
export function planTagRemove(code: string, rollsUsing: number): TagPlan {
  if (rollsUsing === 0) return { ok: true };
  return {
    ok: false,
    reason: `${rollsUsing === 1 ? "A roll was" : `${rollsUsing} rolls were`} made from ${code}, so it can’t be removed. Deactivate it instead: its rolls keep their codes and it leaves the list in Add rolls.`,
  };
}

/** A tag as the Add rolls dropdown needs it. */
export type RollTagOption = {
  id: string;
  code: string;
  supplierId: string | null;
  /** The supplier's name, "Any supplier" when none. */
  supplierName: string | null;
  isDefault: boolean;
};

/**
 * The dropdown's two groups (A-123): the item's supplier's tags first, then every other active
 * tag. `defaultId` is the supplier's default tag, "" when it has none (the box starts on
 * "Choose a tag").
 */
export function groupTagsForSupplier(
  tags: readonly RollTagOption[],
  supplierId: string | null,
): { mine: RollTagOption[]; other: RollTagOption[]; defaultId: string } {
  const sorted = [...tags].sort((a, b) => a.code.localeCompare(b.code));
  const mine = sorted.filter((t) => supplierId !== null && t.supplierId === supplierId);
  const other = sorted.filter((t) => !mine.includes(t));
  const defaultTag = mine.find((t) => t.isDefault);
  return { mine, other, defaultId: defaultTag?.id ?? "" };
}

/** "BLC · Bulacan Supplier A", or just the code for a tag for any supplier. */
export function tagLabel(tag: Pick<RollTagOption, "code" | "supplierName">): string {
  return tag.supplierName ? `${tag.code} · ${tag.supplierName}` : tag.code;
}
