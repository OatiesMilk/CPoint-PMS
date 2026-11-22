import { z } from "zod";
import { MAX_REASON, STAGES } from "@/lib/repair-rules";

const OUT_OF_DATE = "This page is out of date. Refresh and try again.";
const STAGE_MESSAGE = "Choose a stage: Preparation, Construction, Sole-ing or Finishing.";
const REASON_MESSAGE = "Say why, at least 5 characters.";

const stage = z.enum(STAGES, { error: STAGE_MESSAGE });
const reason = z
  .string({ error: REASON_MESSAGE })
  .trim()
  .min(5, REASON_MESSAGE)
  .max(MAX_REASON, `Keep the reason under ${MAX_REASON} characters.`);

/** A change's reason, checked the same in the form and on the server. */
export const repairReasonSchema = reason;

/** One line of "what was wrong" (checked for sums and messages by parseFindings). */
export const findingLinesSchema = z.array(z.unknown()).optional();

/** PATCH /api/v1/production/repairs/{id}: back for inspection, move, or Not fixable after all. */
export const repairActionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("back") }),
    z.object({ action: z.literal("move"), stage, reason }),
    z.object({ action: z.literal("notFixable"), reason }),
  ],
  { error: OUT_OF_DATE },
);
export type RepairActionInput = z.infer<typeof repairActionSchema>;
export type RepairChangeInput = Exclude<RepairActionInput, { action: "back" }>;

/** POST /api/v1/production/repairs/{id}/inspect (the numbers are checked by parseRepairResult). */
export const repairInspectSchema = z.object({
  passedPairs: z.unknown().optional(),
  scrappedPairs: z.unknown().optional(),
  resend: z.array(z.unknown()).optional(),
});
export type RepairInspectInput = z.infer<typeof repairInspectSchema>;

/**
 * PATCH /api/v1/production/repairs/{id}/inspect (the Floor Manager, Phase 35B): the same result as an
 * inspection, plus why and the `updatedAt` the person saw.
 */
export const repairCorrectionSchema = repairInspectSchema.extend({
  expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
  reason,
});
export type RepairCorrectionInput = z.infer<typeof repairCorrectionSchema>;

/** PUT /api/v1/production/stages/{day}: who works at each stage. */
export const stageAssignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        stage,
        userIds: z.array(z.uuid({ error: OUT_OF_DATE })),
      }),
    )
    .max(STAGES.length, OUT_OF_DATE),
});
export type StageAssignmentsInput = z.infer<typeof stageAssignmentsSchema>;

/** POST /api/v1/production/stage-counts: the pairs at a stage now (checked by parseCount). */
export const stageCountSchema = z.object({ stage, pairs: z.unknown().optional() });
export type StageCountInput = z.infer<typeof stageCountSchema>;
