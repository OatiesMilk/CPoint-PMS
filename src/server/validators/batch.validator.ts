import { z } from "zod";
import { BatchStatus, Stage } from "@/lib/domain";
import { manilaToday } from "@/lib/format";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";

/** Create/edit form. Shared by the batch form (client) and the API. */
export const batchFormSchema = z.object({
  rollCode: z
    .string({ error: "Enter the roll code from the leather roll's tag." })
    .trim()
    .min(1, "Enter the roll code from the leather roll's tag.")
    .max(50, "Keep the roll code under 50 characters."),
  shoeTypeId: z.uuid("Choose a shoe type from the list."),
  supplierId: z.preprocess(blankToUndefined, z.uuid("Choose a supplier from the list.").optional()),
  receivedAt: z
    .string({ error: "Enter the date the roll arrived." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the roll arrived, like 2026-10-31.")
    .refine(
      (d) => d <= manilaToday(),
      "The arrival date can't be in the future. Pick today or an earlier date.",
    ),
  notes: optionalText(500, "notes"),
  /** Create only (D-023): take one roll from this leather-roll inventory item. Ignored on edit. */
  rollItemId: z.preprocess(
    blankToUndefined,
    z.uuid("Choose a leather roll from the list.").optional(),
  ),
});

export type BatchFormInput = z.input<typeof batchFormSchema>;
export type BatchFormValues = z.output<typeof batchFormSchema>;

const reason = z
  .string({ error: "Enter a reason, so the change makes sense in the batch's history." })
  .trim()
  .min(3, "Enter a reason of at least 3 characters, so it makes sense in the batch's history.")
  .max(300, "Keep the reason under 300 characters.");

/** A roll is started or finished (D-082). The old stage moves are refused with this message. */
export const transitionSchema = z.object({
  action: z.enum(["start", "finish"], {
    error: "Choose start or finish. A roll no longer moves through stages.",
  }),
  expectedStage: z.enum(Stage, { error: OUT_OF_DATE }),
});

export type TransitionInput = z.infer<typeof transitionSchema>;

export const cancelSchema = z.object({
  reason,
  expectedStage: z.enum(Stage, { error: OUT_OF_DATE }).optional(),
});

/** List query (URL search params). Unknown or invalid values are dropped rather than erroring. */
export const batchListQuerySchema = z.object({
  status: z.enum(BatchStatus).optional().catch(undefined),
  shoeTypeId: z.uuid().optional().catch(undefined),
  q: z.string().trim().max(50).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type BatchListQuery = z.infer<typeof batchListQuerySchema>;

export const batchIdSchema = z.uuid();

/** True for a well-formed batch id. Anything else is a 404, never a database error. */
export function isBatchId(value: string): boolean {
  return batchIdSchema.safeParse(value).success;
}
