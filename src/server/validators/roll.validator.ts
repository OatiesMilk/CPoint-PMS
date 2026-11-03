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
  /** Marked Return to supplier with no decision yet (Phase 30C). */
  toReturn: z
    .enum(["1", "true"])
    .optional()
    .transform((v) => (v ? true : undefined))
    .catch(undefined),
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

export type RollListQuery = Omit<z.infer<typeof rollListQuerySchema>, "toReturn"> & {
  toReturn?: boolean;
};

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

/**
 * POST /api/v1/rolls/{id}/return-decision (Phase 30C, C-36): Returned to supplier on a day (not
 * after today, checked by the service with Manila's date) with an optional note, or Keep with a
 * reason.
 */
export const returnDecisionSchema = z
  .object({
    decision: z.enum(["RETURNED", "KEPT"], { error: ROLL_MESSAGES.decision }),
    returnedOn: z.preprocess(blankToUndefined, z.string().trim().optional()),
    note: z.preprocess(
      blankToUndefined,
      z
        .string({ error: ROLL_MESSAGES.keepReason })
        .trim()
        .max(CANCEL_REASON_MAX, ROLL_MESSAGES.noteTooLong)
        .optional(),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "RETURNED") {
      const ok =
        !!v.returnedOn &&
        DATE.test(v.returnedOn) &&
        !Number.isNaN(new Date(`${v.returnedOn}T00:00:00Z`).getTime());
      if (!ok)
        ctx.addIssue({ code: "custom", path: ["returnedOn"], message: ROLL_MESSAGES.returnedOn });
    } else if (!v.note)
      ctx.addIssue({ code: "custom", path: ["note"], message: ROLL_MESSAGES.keepReason });
  })
  .transform((v) =>
    v.decision === "RETURNED"
      ? { decision: "RETURNED" as const, returnedOn: v.returnedOn!, note: v.note }
      : { decision: "KEPT" as const, note: v.note! },
  );

export type ReturnDecisionValues =
  { decision: "RETURNED"; returnedOn: string; note?: string } | { decision: "KEPT"; note: string };
