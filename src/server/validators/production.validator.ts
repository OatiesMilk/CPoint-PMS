import { z } from "zod";
import {
  INTERVAL_MINUTES,
  isTime,
  MAX_PAIRS_PER_CHECK_IN,
  minutesOf,
} from "@/lib/production-rules";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";
import { attendanceDaySchema } from "./attendance.validator";

// Production progression (Phase 23). Messages name the field and the fix (D-038). A count or a
// quota names its shoe type, so those fields are built per shoe type by the factories below and
// shared by the forms and the service.

export const MAX_QUOTA_PAIRS = 50_000;

const whole = (v: unknown) => (typeof v === "number" ? v : Number(String(v).trim()));

/** One shoe type's count at a check-in: "School Shoes finished since 10:00". */
export function pairsSchema(shoeType: string, since: string) {
  const message = `Enter the ${shoeType} finished since ${since} as a whole number, like 24. Enter 0 if none.`;
  return z.preprocess(
    blankToUndefined,
    z
      .unknown()
      .refine((v) => v !== undefined && v !== null, message)
      .transform(whole)
      .refine((n) => Number.isInteger(n) && n >= 0, message)
      .refine(
        (n) => n <= MAX_PAIRS_PER_CHECK_IN,
        `${shoeType} can't be more than ${MAX_PAIRS_PER_CHECK_IN.toLocaleString("en-PH")} pairs in one check-in. Check the number.`,
      ),
  );
}

/** One shoe type's daily quota. */
export function quotaPairsSchema(shoeType: string) {
  const message = `Enter the daily quota for ${shoeType} as a whole number of pairs, at least 1.`;
  return z.preprocess(
    blankToUndefined,
    z
      .unknown()
      .refine((v) => v !== undefined && v !== null, message)
      .transform(whole)
      .refine((n) => Number.isInteger(n) && n >= 1, message)
      .refine(
        (n) => n <= MAX_QUOTA_PAIRS,
        `The daily quota for ${shoeType} can't be more than ${MAX_QUOTA_PAIRS.toLocaleString("en-PH")} pairs. Check the number.`,
      ),
  );
}

export const CORRECTION_REASON_MESSAGE =
  "Say why you're correcting this check-in, at least 5 characters.";

export const correctionReasonSchema = z
  .string({ error: CORRECTION_REASON_MESSAGE })
  .trim()
  .min(5, CORRECTION_REASON_MESSAGE)
  .max(300, "Keep the reason under 300 characters.");

const countsSchema = z.array(
  z.object({ shoeTypeId: z.uuid({ error: OUT_OF_DATE }), pairs: z.unknown().optional() }),
  { error: OUT_OF_DATE },
);

/** POST /api/v1/production/check-ins. The counts are checked per shoe type by the service. */
export const checkInSchema = z.object({
  slotAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
  counts: countsSchema,
  notes: optionalText(500, "notes"),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

/** PATCH /api/v1/production/check-ins/{id}: a same-day correction, with a reason. */
export const correctionSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
  counts: countsSchema,
  reason: correctionReasonSchema,
});
export type CorrectionInput = z.infer<typeof correctionSchema>;

const timeField = (label: string, example: string) =>
  z
    .string({ error: `Enter the ${label} as a time, like ${example}.` })
    .trim()
    .refine(isTime, `Enter the ${label} as a time, like ${example}.`);

/** PUT /api/v1/production/schedule (D-083). Applies from tomorrow. */
export const scheduleSchema = z
  .object({
    shiftStart: timeField("shift start", "08:00"),
    shiftEnd: timeField("shift end", "17:00"),
    intervalMinutes: z.preprocess(
      (v) => (typeof v === "string" ? Number(v) : v),
      z
        .number({ error: "Pick an interval of 1, 2, 3 or 4 hours." })
        .refine(
          (n) => (INTERVAL_MINUTES as readonly number[]).includes(n),
          "Pick an interval of 1, 2, 3 or 4 hours.",
        ),
    ),
    workingDays: z
      .array(z.coerce.number().int().min(1).max(7), { error: "Pick at least one working day." })
      .min(1, "Pick at least one working day."),
  })
  .superRefine((v, ctx) => {
    if (
      isTime(v.shiftStart) &&
      isTime(v.shiftEnd) &&
      minutesOf(v.shiftEnd) <= minutesOf(v.shiftStart)
    )
      ctx.addIssue({
        code: "custom",
        path: ["shiftEnd"],
        message: "Shift end must be after shift start.",
      });
  });
export type ScheduleInput = z.infer<typeof scheduleSchema>;

/** PUT /api/v1/production/quotas: one row per shoe type whose quota changes. */
export const quotasSchema = z.object({
  quotas: z
    .array(
      z.object({
        shoeTypeId: z.uuid({ error: OUT_OF_DATE }),
        pairs: z.unknown().optional(),
        suggestedPairs: z.number().int().min(0).nullable().optional(),
      }),
      { error: OUT_OF_DATE },
    )
    .min(1, "Enter a daily quota for at least one shoe type."),
});
export type QuotasInput = z.infer<typeof quotasSchema>;

/** `?from=&to=` for GET /api/v1/production/days. */
export const daysQuerySchema = z.object({
  from: attendanceDaySchema.optional(),
  to: attendanceDaySchema.optional(),
});
