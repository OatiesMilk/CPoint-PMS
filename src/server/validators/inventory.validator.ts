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
export const inventoryItemFormSchema = z.object({
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
});

export type InventoryItemFormInput = z.input<typeof inventoryItemFormSchema>;
export type InventoryItemFormValues = z.output<typeof inventoryItemFormSchema>;

const note = optionalText(300, "note");

export const movementSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("IN"),
      quantity: quantity({ min: 0, exclusiveMin: true, label: "quantity" }),
      reason: note,
    }),
    z.object({
      type: z.literal("OUT"),
      quantity: quantity({ min: 0, exclusiveMin: true, label: "quantity" }),
      reason: note,
    }),
    z.object({
      type: z.literal("ADJUST"),
      counted: quantity({ min: 0, label: "counted quantity" }),
      expectedQuantity: z.coerce.number({ error: OUT_OF_DATE }),
      reason: z
        .string({
          error: "Enter a reason for the count difference, e.g. “Two boxes were damaged.”",
        })
        .trim()
        .min(3, "Enter a reason of at least 3 characters for the count difference.")
        .max(300, "Keep the reason under 300 characters."),
    }),
  ],
  { error: OUT_OF_DATE },
);

export type MovementBody = z.output<typeof movementSchema>;

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
