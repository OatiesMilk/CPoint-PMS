import { z } from "zod";
import { InventoryCategory } from "@/lib/domain";
import { MAX_QUANTITY, hasAtMostTwoDecimals } from "@/lib/inventory-rules";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** A quantity from a form or JSON: a number ≥ min, at most 2 decimals. */
export const quantity = (opts: { min: number; label: string; exclusiveMin?: boolean }) =>
  z.coerce
    .number({ error: `Enter the ${opts.label} as a number.` })
    .refine((n) => Number.isFinite(n), `Enter the ${opts.label} as a number.`)
    .refine(
      (n) => (opts.exclusiveMin ? n > opts.min : n >= opts.min),
      opts.exclusiveMin
        ? `The ${opts.label} must be more than ${opts.min}.`
        : `The ${opts.label} can't be below ${opts.min}.`,
    )
    .refine(
      (n) => n <= MAX_QUANTITY,
      `That's more than ${MAX_QUANTITY.toLocaleString("en-PH")}. Check the number.`,
    )
    .refine(hasAtMostTwoDecimals, "Use at most 2 decimal places.");

/** Create/edit item form, shared by the page form (client) and the API. */
export const inventoryItemFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Enter a code of at least 2 characters, e.g. LR-001.")
    .max(20, "Keep the code under 20 characters.")
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, "Use letters, numbers and dashes only, e.g. LR-001."),
  name: z
    .string()
    .trim()
    .min(2, "Enter the item name, e.g. Black cowhide roll.")
    .max(80, "Keep the name under 80 characters."),
  category: z.enum(InventoryCategory, { error: "Choose a category." }),
  unit: z
    .string()
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

const note = z.preprocess(
  blankToUndefined,
  z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
);

export const movementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("IN"),
    quantity: quantity({ min: 0, exclusiveMin: true, label: "quantity" }),
    reason: note,
  }),
  z.object({
    type: z.literal("OUT"),
    quantity: quantity({ min: 0, exclusiveMin: true, label: "quantity" }),
    reason: note,
    batchId: z.preprocess(blankToUndefined, z.uuid("Choose a batch from the list.").optional()),
  }),
  z.object({
    type: z.literal("ADJUST"),
    counted: quantity({ min: 0, label: "counted quantity" }),
    expectedQuantity: z.coerce.number(),
    reason: z
      .string({ error: "Say why the count differs." })
      .trim()
      .min(3, "Say why the count differs (at least 3 characters).")
      .max(300, "Keep the reason under 300 characters."),
  }),
]);

export type MovementBody = z.output<typeof movementSchema>;

export const activeSchema = z.object({ isActive: z.boolean() });

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
