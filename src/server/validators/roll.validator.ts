import { z } from "zod";
import { RollStatus } from "@/lib/domain";
import { CANCEL_REASON_MAX, ROLL_MESSAGES, ROLL_TAG_MAX } from "@/lib/roll-rules";
import { blankToUndefined } from "./shared";

/** Start a roll at Capture (Phase 26): the supplier is required, the tag's number optional. */
export const startRollSchema = z.object({
  supplierId: z.preprocess(blankToUndefined, z.uuid({ error: ROLL_MESSAGES.chooseSupplier })),
  tagCode: z.preprocess(
    blankToUndefined,
    z
      .string({ error: ROLL_MESSAGES.tagTooLong })
      .trim()
      .max(ROLL_TAG_MAX, ROLL_MESSAGES.tagTooLong)
      .optional(),
  ),
});

export type StartRollInput = z.input<typeof startRollSchema>;
export type StartRollValues = { supplierId: string; tagCode?: string };

/** The Floor Manager cancels an open roll with a reason (Reports → Rolls). */
export const managerCancelSchema = z.object({
  reason: z
    .string({ error: ROLL_MESSAGES.cancelReason })
    .trim()
    .min(1, ROLL_MESSAGES.cancelReason)
    .max(CANCEL_REASON_MAX, ROLL_MESSAGES.cancelReasonTooLong),
});

/** Reports → Rolls filters (URL search params). Unknown or invalid values are dropped. */
export const rollListQuerySchema = z.object({
  status: z.enum(RollStatus).optional().catch(undefined),
  supplierId: z.uuid().optional().catch(undefined),
  days: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
    .optional()
    .catch(undefined),
  q: z.string().trim().max(50).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type RollListQuery = z.infer<typeof rollListQuerySchema>;

export const rollIdSchema = z.uuid();

/** True for a well-formed roll id. Anything else is a 404, never a database error. */
export function isRollId(value: string): boolean {
  return rollIdSchema.safeParse(value).success;
}
