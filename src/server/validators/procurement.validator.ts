import { z } from "zod";
import { InventoryCategory, PurchaseRequestStatus } from "@/lib/domain";
import { manilaToday } from "@/lib/format";
import { MAX_LINES, NEEDED_BY_MAX_DAYS, URGENCIES } from "@/lib/procurement-rules";
import { addDays } from "@/lib/report-rules";
import { quantity } from "./inventory.validator";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isoDay = z.string().regex(ISO_DAY);

/** Required. Urgency is worked out from it (D-037), so each rule says what to pick instead. */
const neededBy = z.preprocess(
  blankToUndefined,
  z
    .string({ error: "Choose the date you need the items by." })
    .regex(ISO_DAY, "Enter Needed by as a date, like 2026-10-31.")
    .refine(
      (day) => day >= manilaToday(),
      "Needed by can't be in the past. Pick today or a later date.",
    )
    .refine(
      (day) => day <= addDays(manilaToday(), NEEDED_BY_MAX_DAYS),
      `Needed by can be at most ${NEEDED_BY_MAX_DAYS} days ahead. Pick an earlier date.`,
    ),
);

/** One line: an inventory item, or a typed name and unit for something not in inventory yet. */
const lineSchema = z
  .object({
    inventoryItemId: z.preprocess(
      blankToUndefined,
      z.uuid("Choose an item from the list.").optional(),
    ),
    itemName: optionalText(80, "item name"),
    /** Typed items only: their category (leather rolls need the designation, D-031). */
    category: z.preprocess(
      blankToUndefined,
      z.enum(InventoryCategory, { error: "Choose what kind of item it is." }).optional(),
    ),
    unit: optionalText(20, "unit"),
    quantity: quantity({ min: 0, exclusiveMin: true, label: "quantity" }),
    note: optionalText(200, "note"),
  })
  .superRefine((line, ctx) => {
    if (line.inventoryItemId) return;
    if (!line.itemName || line.itemName.length < 2)
      ctx.addIssue({
        code: "custom",
        path: ["itemName"],
        message: "Choose an item, or type the name of one that isn't in inventory yet.",
      });
    if (!line.category)
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Choose what kind of item it is.",
      });
    if (!line.unit)
      ctx.addIssue({ code: "custom", path: ["unit"], message: "Enter the unit, e.g. box, roll." });
  });

/** The request form, shared by the page (client) and the API. */
export const purchaseRequestSchema = z
  .object({
    neededBy,
    /** Optional. Saved as the request's first remark (D-036). */
    remarks: optionalText(500, "remarks"),
    lines: z
      .array(lineSchema, { error: "Add at least one item to the request." })
      .min(1, "Add at least one item to the request.")
      .max(MAX_LINES, `A request can have up to ${MAX_LINES} items. Send another for the rest.`),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.lines.forEach((line, i) => {
      if (!line.inventoryItemId) return;
      if (seen.has(line.inventoryItemId))
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "inventoryItemId"],
          message: "This item is already on the request. Change that line's quantity instead.",
        });
      seen.add(line.inventoryItemId);
    });
  });

export type PurchaseRequestInput = z.input<typeof purchaseRequestSchema>;
export type PurchaseRequestValues = z.output<typeof purchaseRequestSchema>;

export const approveSchema = z.object({ note: optionalText(300, "note") });
export const rejectSchema = z.object({
  reason: z
    .string({ error: "Enter a reason, so the requester knows why it's rejected." })
    .trim()
    .min(3, "Enter a reason of at least 3 characters, so the requester knows why it's rejected.")
    .max(300, "Keep the reason under 300 characters."),
});
export const cancelSchema = z.object({ note: optionalText(300, "note") });
export const remarkSchema = z.object({
  body: z
    .string({ error: "Write a remark before you add it." })
    .trim()
    .min(1, "Write a remark before you add it.")
    .max(500, "Keep the remark under 500 characters."),
});
export const requesterSchema = z.object({
  canRequestLeatherRolls: z.boolean({ error: OUT_OF_DATE }),
});

/** List query (URL search params). Invalid values are dropped rather than erroring. */
export const requestListQuerySchema = z.object({
  status: z.enum(PurchaseRequestStatus).optional().catch(undefined),
  category: z.enum(InventoryCategory).optional().catch(undefined),
  urgency: z.enum(URGENCIES).optional().catch(undefined),
  item: z.uuid().optional().catch(undefined),
  from: isoDay.optional().catch(undefined),
  to: isoDay.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type RequestListQuery = z.infer<typeof requestListQuerySchema>;

export function isRequestId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
