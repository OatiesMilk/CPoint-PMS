import { z } from "zod";
import { InventoryCategory, PurchasePriority, PurchaseRequestStatus } from "@/lib/domain";
import { MAX_LINES } from "@/lib/procurement-rules";
import { quantity } from "./inventory.validator";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, `Keep the ${label} under ${max} characters.`).optional(),
  );
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-31.");

/** One line: an inventory item, or a typed name and unit for something not in inventory yet. */
const lineSchema = z
  .object({
    inventoryItemId: z.preprocess(blankToUndefined, z.uuid("Choose an item.").optional()),
    itemName: optionalText(80, "item name"),
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
    if (!line.unit)
      ctx.addIssue({ code: "custom", path: ["unit"], message: "Enter the unit, e.g. box, roll." });
  });

/** The request form, shared by the page (client) and the API. */
export const purchaseRequestSchema = z
  .object({
    priority: z.enum(PurchasePriority, { error: "Choose a priority." }).default("NORMAL"),
    neededBy: z.preprocess(blankToUndefined, isoDay.optional()),
    justification: z
      .string({ error: "Say why it's needed." })
      .trim()
      .min(3, "Say why it's needed, e.g. “Nails for Friday’s topsider batch.”")
      .max(500, "Keep it under 500 characters."),
    lines: z
      .array(lineSchema)
      .min(1, "Add at least one item.")
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
    .string({ error: "Say why it's rejected." })
    .trim()
    .min(3, "Say why it's rejected (at least 3 characters).")
    .max(300, "Keep the reason under 300 characters."),
});
export const cancelSchema = z.object({ note: optionalText(300, "note") });
export const remarkSchema = z.object({
  body: z
    .string({ error: "Write a remark." })
    .trim()
    .min(1, "Write a remark.")
    .max(500, "Keep the remark under 500 characters."),
});
export const requesterSchema = z.object({ canRequestMaterials: z.boolean() });

/** List query (URL search params). Invalid values are dropped rather than erroring. */
export const requestListQuerySchema = z.object({
  status: z.enum(PurchaseRequestStatus).optional().catch(undefined),
  category: z.enum(InventoryCategory).optional().catch(undefined),
  item: z.uuid().optional().catch(undefined),
  from: isoDay.optional().catch(undefined),
  to: isoDay.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type RequestListQuery = z.infer<typeof requestListQuerySchema>;

export function isRequestId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
