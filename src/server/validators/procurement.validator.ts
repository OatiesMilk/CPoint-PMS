import { z } from "zod";
import { InventoryCategory, PurchaseRequestStatus } from "@/lib/domain";
import { manilaToday } from "@/lib/format";
import {
  EXPECTED_DELIVERY_MAX_DAYS,
  MAX_LINES,
  NEEDED_BY_MAX_DAYS,
  URGENCIES,
} from "@/lib/procurement-rules";
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
    /** Set by "Copy to a new request" (D-044): the rejected or cancelled request it came from. */
    copiedFromId: z.preprocess(blankToUndefined, z.uuid(OUT_OF_DATE).optional()),
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
/** One item's decision (D-039). Rejecting an item needs a reason, as rejecting a request does. */
const lineDecisionSchema = z
  .object({
    lineId: z.uuid(OUT_OF_DATE),
    decision: z.enum(["APPROVED", "REJECTED"], {
      error: "Choose Approve or Reject for this item.",
    }),
    reason: optionalText(300, "reason"),
  })
  .superRefine((line, ctx) => {
    if (line.decision === "REJECTED" && (!line.reason || line.reason.length < 3))
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          "Enter a reason of at least 3 characters, so the requester knows why this item is rejected.",
      });
  });

/** The decision panel: every item of the request, each approved or rejected, saved together. */
export const decideSchema = z.object({
  note: optionalText(300, "note"),
  lines: z
    .array(lineDecisionSchema, { error: "Choose Approve or Reject for each item, then save." })
    .min(1, "Choose Approve or Reject for each item, then save.")
    .max(MAX_LINES, OUT_OF_DATE),
});

export type DecideValues = z.output<typeof decideSchema>;

/**
 * Cancel. The requester's own cancel of a pending request takes an optional note; the Floor
 * Manager's cancel after approval needs a reason, which the service checks (D-043).
 */
export const cancelSchema = z.object({
  note: optionalText(300, "note"),
  reason: optionalText(300, "reason"),
});

const CANCEL_REASON =
  "Enter a reason of at least 3 characters, so the requester knows why it's cancelled.";
/** The Floor Manager's cancel of an approved or ordered request (D-043). */
export const cancelAfterApprovalSchema = z.object({
  reason: z
    .string({ error: CANCEL_REASON })
    .trim()
    .min(3, CANCEL_REASON)
    .max(300, "Keep the reason under 300 characters."),
});

/** Mark as ordered (D-041): one supplier and one expected date for the whole request. */
export const orderSchema = z.object({
  supplierId: z.preprocess(
    blankToUndefined,
    z.uuid({ error: "Choose the supplier you ordered from." }),
  ),
  reference: optionalText(60, "reference number"),
  expectedDeliveryOn: z.preprocess(
    blankToUndefined,
    z
      .string({ error: "Choose the date the supplier expects to deliver." })
      .regex(ISO_DAY, "Enter Expected delivery as a date, like 2026-10-31.")
      .refine(
        (day) => day >= manilaToday(),
        "Expected delivery can't be in the past. Pick today or a later date.",
      )
      .refine(
        (day) => day <= addDays(manilaToday(), EXPECTED_DELIVERY_MAX_DAYS),
        `Expected delivery can be at most ${EXPECTED_DELIVERY_MAX_DAYS} days ahead. Pick an earlier date.`,
      ),
  ),
  note: optionalText(300, "note"),
});
export type OrderValues = z.output<typeof orderSchema>;

/**
 * Record delivery (D-042): what arrived of each approved item this time (0 if none of it did), and
 * the day it arrived. The proof files travel beside these fields and are checked from their bytes.
 */
export const deliverySchema = z.object({
  deliveredOn: z.preprocess(
    blankToUndefined,
    z
      .string({ error: "Choose the date the delivery arrived." })
      .regex(ISO_DAY, "Enter Delivered on as a date, like 2026-10-31.")
      .refine(
        (day) => day <= manilaToday(),
        "Delivered on can't be in the future. Pick today or the day it arrived.",
      ),
  ),
  note: optionalText(300, "note"),
  lines: z
    .array(
      z.object({
        lineId: z.uuid(OUT_OF_DATE),
        quantity: quantity({ min: 0, label: "received quantity" }),
      }),
      { error: "Enter what arrived for each item, then save." },
    )
    .min(1, "Enter what arrived for each item, then save.")
    .max(MAX_LINES, OUT_OF_DATE),
});
export type DeliveryValues = z.output<typeof deliverySchema>;

const SHORT_REASON =
  "Enter a reason of at least 3 characters for closing short, e.g. “The supplier is out of stock.”";
/** Close a partly received request: the rest won't come (D-042). */
export const closeShortSchema = z.object({
  reason: z
    .string({ error: SHORT_REASON })
    .trim()
    .min(3, SHORT_REASON)
    .max(300, "Keep the reason under 300 characters."),
});
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
  /** "1": ordered or partly received requests whose expected delivery date has passed. */
  late: z.literal("1").optional().catch(undefined),
  item: z.uuid().optional().catch(undefined),
  from: isoDay.optional().catch(undefined),
  to: isoDay.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type RequestListQuery = z.infer<typeof requestListQuerySchema>;

export function isRequestId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
