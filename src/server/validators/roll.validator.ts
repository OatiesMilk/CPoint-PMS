import { z } from "zod";
import { RollStatus } from "@/lib/domain";
import {
  ADD_ROLLS_MAX,
  CANCEL_REASON_MAX,
  parseArea,
  ROLL_MESSAGES,
  ROLL_TAG_MAX,
} from "@/lib/roll-rules";
import { blankToUndefined } from "./shared";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inventory → a leather item → Add rolls (Phase 30A, D-103): the day they arrived (not after
 * today, checked by the service's caller with Manila's date) and one row per roll with its area
 * in square feet and the supplier's tag (optional). Each message names the roll and the fix.
 */
export const addRollsSchema = z
  .object({
    receivedOn: z
      .string({ error: ROLL_MESSAGES.receivedOn })
      .trim()
      .regex(DATE, ROLL_MESSAGES.receivedOn)
      .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()), ROLL_MESSAGES.receivedOn),
    rolls: z
      .array(
        z.object({
          areaSqFt: z.unknown().optional(),
          tagCode: z.unknown().optional(),
        }),
        { error: ROLL_MESSAGES.addAtLeastOne },
      )
      .min(1, ROLL_MESSAGES.addAtLeastOne)
      .max(ADD_ROLLS_MAX, ROLL_MESSAGES.tooMany),
  })
  .transform((value, ctx) => {
    const rolls = value.rolls.map((roll, i) => {
      const n = i + 1;
      const parsed = parseArea(roll.areaSqFt, n);
      if (!parsed.ok)
        ctx.addIssue({ code: "custom", path: ["rolls", i, "areaSqFt"], message: parsed.reason });
      const tag = typeof roll.tagCode === "string" ? roll.tagCode.trim() : "";
      if (roll.tagCode !== undefined && roll.tagCode !== null && typeof roll.tagCode !== "string")
        ctx.addIssue({
          code: "custom",
          path: ["rolls", i, "tagCode"],
          message: `Roll ${n}: ${ROLL_MESSAGES.tagTooLong}`,
        });
      else if (tag.length > ROLL_TAG_MAX)
        ctx.addIssue({
          code: "custom",
          path: ["rolls", i, "tagCode"],
          message: `Roll ${n}: ${ROLL_MESSAGES.tagTooLong}`,
        });
      return { areaSqFt: parsed.ok ? parsed.value : 0, tagCode: tag || undefined };
    });
    return { receivedOn: value.receivedOn, rolls };
  });

export type AddRollsInput = z.input<typeof addRollsSchema>;
export type AddRollsValues = z.output<typeof addRollsSchema>;

/** The Floor Manager removes a roll with a reason (Inventory or Reports → Rolls). */
export const removeRollSchema = z.object({
  reason: z
    .string({ error: ROLL_MESSAGES.removeReason })
    .trim()
    .min(1, ROLL_MESSAGES.removeReason)
    .max(CANCEL_REASON_MAX, ROLL_MESSAGES.removeReasonTooLong),
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

/** Inventory → a leather item's rolls (URL search params). */
export const itemRollsQuerySchema = z.object({
  rollStatus: z.enum(RollStatus).optional().catch(undefined),
  rollPage: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export const rollIdSchema = z.uuid();

/** True for a well-formed roll id. Anything else is a 404, never a database error. */
export function isRollId(value: string): boolean {
  return rollIdSchema.safeParse(value).success;
}

/** Finish batch's Rolls fully used: the ids ticked (none is fine). */
export const usedRollIdsSchema = z.preprocess(
  blankToUndefined,
  z
    .array(z.uuid({ error: "A ticked roll wasn’t found. Refresh the page." }))
    .max(50, "Tick at most 50 rolls at a time.")
    .optional(),
);
