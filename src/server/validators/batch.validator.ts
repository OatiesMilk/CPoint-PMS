import { z } from "zod";
import { BatchStatus, Stage } from "@/lib/domain";
import { manilaToday } from "@/lib/format";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Create/edit form. Shared by the batch form (client) and the API. */
export const batchFormSchema = z.object({
  rollCode: z
    .string()
    .trim()
    .min(1, "Enter the roll code from the leather roll's tag.")
    .max(50, "Keep the roll code under 50 characters."),
  shoeTypeId: z.uuid("Choose a shoe type."),
  supplierId: z.preprocess(blankToUndefined, z.uuid("Choose a supplier from the list.").optional()),
  receivedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the roll arrived.")
    .refine((d) => d <= manilaToday(), "The date can't be in the future."),
  targetQuotaPairs: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: "Enter a whole number of pairs." })
      .int("Enter a whole number of pairs.")
      .min(1, "The quota must be at least 1 pair.")
      .max(100_000, "That's more than 100,000 pairs. Check the number.")
      .optional(),
  ),
  notes: z.preprocess(
    blankToUndefined,
    z.string().trim().max(500, "Keep notes under 500 characters.").optional(),
  ),
  /** Create only (D-023): take one roll from this leather-roll inventory item. Ignored on edit. */
  rollItemId: z.preprocess(
    blankToUndefined,
    z.uuid("Choose a leather roll from the list.").optional(),
  ),
});

export type BatchFormInput = z.input<typeof batchFormSchema>;
export type BatchFormValues = z.output<typeof batchFormSchema>;

const reason = z
  .string()
  .trim()
  .min(3, "Give a short reason (at least 3 characters).")
  .max(300, "Keep the reason under 300 characters.");

export const transitionSchema = z
  .object({
    action: z.enum(["start", "advance", "complete", "move_back"]),
    expectedStage: z.enum(Stage),
    reason: z.preprocess(blankToUndefined, reason.optional()),
  })
  .superRefine((value, ctx) => {
    if (value.action === "move_back" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Say why the batch is moving back.",
      });
    }
  });

export type TransitionInput = z.infer<typeof transitionSchema>;

export const cancelSchema = z.object({ reason, expectedStage: z.enum(Stage).optional() });

/** List query (URL search params). Unknown or invalid values are dropped rather than erroring. */
export const batchListQuerySchema = z.object({
  status: z.enum(BatchStatus).optional().catch(undefined),
  stage: z.enum(Stage).optional().catch(undefined),
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
