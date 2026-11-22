import { z } from "zod";
import { periodQuerySchema, sortQuerySchema } from "./report.validator";
import { RollStatus } from "@/lib/domain";
import { LOCATION_MESSAGES } from "@/lib/location-rules";
import {
  ADD_ROLLS_MAX,
  CANCEL_REASON_MAX,
  parseArea,
  ROLL_MESSAGES,
  ROLL_REPORT_STATUSES,
  ROLL_TAG_MAX,
} from "@/lib/roll-rules";

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
    /** Where they are kept (Phase 32), optional: rolls can be placed later. */
    locationId: z.uuid({ error: LOCATION_MESSAGES.chooseLocation }).optional().nullable(),
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
    return { receivedOn: value.receivedOn, rolls, locationId: value.locationId ?? null };
  });

export type AddRollsInput = z.input<typeof addRollsSchema>;
export type AddRollsValues = z.output<typeof addRollsSchema>;

/**
 * PATCH /api/v1/rolls/{id}: the Floor Manager corrects a roll's tag number, received day, return note
 * or area (before Finish roll), with a reason (Phase 35B). A field left out is not changed; the values
 * are checked against the roll by planRollEdit.
 */
export const updateRollSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({
    offset: true,
    error: "This page is out of date. Refresh and try again.",
  }),
  tagCode: z.unknown().optional(),
  receivedOn: z.unknown().optional(),
  areaSqFt: z.unknown().optional(),
  returnNote: z.unknown().optional(),
  reason: z
    .string({ error: ROLL_MESSAGES.editReason })
    .trim()
    .min(5, ROLL_MESSAGES.editReason)
    .max(CANCEL_REASON_MAX, ROLL_MESSAGES.removeReasonTooLong),
});
export type UpdateRollInput = z.infer<typeof updateRollSchema>;

/** The Floor Manager removes a roll with a reason (Inventory or Reports → Rolls). */
export const removeRollSchema = z.object({
  reason: z
    .string({ error: ROLL_MESSAGES.removeReason })
    .trim()
    .min(1, ROLL_MESSAGES.removeReason)
    .max(CANCEL_REASON_MAX, ROLL_MESSAGES.removeReasonTooLong),
});

/**
 * Reports → Rolls filters (URL search params). Unknown or invalid values are dropped. Status is one
 * of Not yet scanned, Scanning passed or Returned to supplier (D-116).
 */
export const rollListQuerySchema = z.object({
  status: z.enum(ROLL_REPORT_STATUSES).optional().catch(undefined),
  supplierId: z.uuid().optional().catch(undefined),
  days: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
    .optional()
    .catch(undefined),
  q: z.string().trim().max(50).optional().catch(undefined),
  /** Phase 35: the leather item and where the roll is kept. */
  itemId: z.uuid().optional().catch(undefined),
  locationId: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  /** The printed list: every matching row, up to PRINT_MAX_ROLLS (A-102). */
  print: z.literal("1").optional().catch(undefined),
  ...periodQuerySchema.shape,
  ...sortQuerySchema.shape,
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
