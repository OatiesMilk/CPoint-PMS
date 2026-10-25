import { z } from "zod";
import { InventoryCategory } from "@/lib/domain";
import { MAX_QUANTITY, hasAtMostTwoDecimals } from "@/lib/inventory-rules";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A quantity from a form or JSON: a number ≥ min, at most 2 decimals. `label` is the field's name
 * in lower case ("quantity", "reorder level"); every message names it (D-038).
 */
export const quantity = (opts: { min: number; label: string; exclusiveMin?: boolean }) =>
  z.coerce
    .number({ error: `Enter the ${opts.label} as a number, like 2 or 2.5.` })
    .refine((n) => Number.isFinite(n), `Enter the ${opts.label} as a number, like 2 or 2.5.`)
    .refine(
      (n) => (opts.exclusiveMin ? n > opts.min : n >= opts.min),
      opts.exclusiveMin
        ? `Enter a ${opts.label} greater than ${opts.min}.`
        : `${capitalize(opts.label)} can't be below ${opts.min}. Enter ${opts.min} or more.`,
    )
    .refine(
      (n) => n <= MAX_QUANTITY,
      `${capitalize(opts.label)} can't be more than ${MAX_QUANTITY.toLocaleString("en-PH")}. Check the number.`,
    )
    .refine(hasAtMostTwoDecimals, `${capitalize(opts.label)} can have at most 2 decimal places.`);

/** Create/edit item form, shared by the page form (client) and the API. */
export const inventoryItemFormSchema = z
  .object({
    sku: z
      .string({ error: "Enter an item code of at least 2 characters, e.g. LR-001." })
      .trim()
      .toUpperCase()
      .min(2, "Enter an item code of at least 2 characters, e.g. LR-001.")
      .max(20, "Keep the item code under 20 characters.")
      .regex(
        /^[A-Z0-9][A-Z0-9-]*$/,
        "The item code can only have letters, numbers and dashes, e.g. LR-001.",
      ),
    name: z
      .string({ error: "Enter the item name, e.g. Black cowhide roll." })
      .trim()
      .min(2, "Enter the item name, e.g. Black cowhide roll.")
      .max(80, "Keep the item name under 80 characters."),
    category: z.enum(InventoryCategory, { error: "Choose a category for the item." }),
    unit: z
      .string({ error: "Enter the unit you count it in, e.g. roll, box, kg." })
      .trim()
      .min(1, "Enter the unit you count it in, e.g. roll, box, kg.")
      .max(20, "Keep the unit under 20 characters."),
    reorderLevel: quantity({ min: 0, label: "reorder level" }),
    /** Create only: recorded as an IN movement "Opening stock". */
    openingStock: z.preprocess(
      blankToUndefined,
      quantity({ min: 0, label: "opening stock" }).optional(),
    ),
    /** A leather roll's supplier (Phase 29, D-102); ignored for other categories. */
    // Null too: the form sends the already-parsed values, where a non-leather item's supplier is
    // null (QA Phase 29 run 1, F1 to F3).
    supplierId: z.preprocess(
      (v) => (v === null ? undefined : blankToUndefined(v)),
      z.uuid({ error: "Choose the supplier of this leather roll." }).optional(),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.category === "LEATHER_ROLL" && !v.supplierId)
      ctx.addIssue({
        code: "custom",
        path: ["supplierId"],
        message: "Choose the supplier of this leather roll.",
      });
  })
  .transform((v) => ({
    ...v,
    supplierId: v.category === "LEATHER_ROLL" ? (v.supplierId ?? null) : null,
  }));

export type InventoryItemFormInput = z.input<typeof inventoryItemFormSchema>;
export type InventoryItemFormValues = z.output<typeof inventoryItemFormSchema>;

/** "6", "+6", "-3", "−2.5" (a true minus sign works too); blank is no change. */
const normalise = (v: unknown) =>
  typeof v === "string" ? v.trim().replace(/^[−–]/, "-").replace(/^\+/, "") : v;

/**
 * A number on the Update stock sheet, at most 2 decimals. `what` names the field and the item in
 * the message: "what was added to Nails". Used may be typed with or without a minus.
 */
const sheetNumber = (what: string, example: string, opts: { unsigned?: boolean } = {}) =>
  z.preprocess(
    (v) => {
      const n = blankToUndefined(normalise(v));
      return opts.unsigned && typeof n === "string" ? n.replace(/^-/, "") : n;
    },
    z.coerce
      .number({ error: `Enter ${what} as a number, like ${example}.` })
      .refine((n) => Number.isFinite(n), `Enter ${what} as a number, like ${example}.`)
      .refine(
        hasAtMostTwoDecimals,
        `Enter ${what} as a number with at most 2 decimals, like ${example}.`,
      )
      .refine(
        (n) => Math.abs(n) <= MAX_QUANTITY,
        `${what.charAt(0).toUpperCase()}${what.slice(1)} can't be more than ${MAX_QUANTITY.toLocaleString("en-PH")}. Check the number.`,
      )
      .optional(),
  );

/** One line of the sheet. `name` only shapes the messages; the server checks the item itself. */
export const stockLineSchema = (name = "this item") =>
  z.object({
    itemId: z.uuid({ error: OUT_OF_DATE }),
    seenQuantity: z.coerce.number({ error: OUT_OF_DATE }),
    added: sheetNumber(`what was added to ${name}`, "6"),
    used: sheetNumber(`what was used of ${name}`, "3", { unsigned: true }),
    correction: sheetNumber(`the correction for ${name}`, "−2 or 1.5"),
    reason: optionalText(300, "reason"),
  });

export const stockUpdateSchema = z.object({
  lines: z
    .array(stockLineSchema(), { error: "Enter a change for at least one item." })
    .min(1, "Enter a change for at least one item.")
    .max(1000, OUT_OF_DATE)
    .refine((lines) => new Set(lines.map((l) => l.itemId)).size === lines.length, OUT_OF_DATE),
  note: optionalText(300, "note"),
});

export type StockUpdateBody = z.output<typeof stockUpdateSchema>;
export type StockLineBody = StockUpdateBody["lines"][number];

/** The reminder days, as ISO weekdays (1 Monday … 7 Sunday). */
export const inventorySettingsSchema = z.object({
  reminderDays: z
    .array(z.coerce.number().int().min(1).max(7), { error: "Pick at least one reminder day." })
    .min(1, "Pick at least one reminder day.")
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
});

export const activeSchema = z.object({ isActive: z.boolean({ error: OUT_OF_DATE }) });

/** List query (URL search params). Unknown or invalid values are dropped rather than erroring. */
export const inventoryListQuerySchema = z.object({
  category: z.enum(InventoryCategory).optional().catch(undefined),
  stock: z.enum(["low", "out"]).optional().catch(undefined),
  q: z.string().trim().max(50).optional().catch(undefined),
  inactive: z.literal("1").optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;

export function isInventoryId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
