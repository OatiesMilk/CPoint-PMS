import { z } from "zod";
import {
  INTERVAL_MINUTES,
  isTime,
  MAX_PAIRS_PER_CHECK_IN,
  minutesOf,
} from "@/lib/production-rules";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";
import { attendanceDaySchema } from "./attendance.validator";

// Batches (Phase 27, D-097 to D-099). Messages name the field and the fix (D-038). The pairs
// fields name their batch, so they are built per batch by the factories below and shared by the
// Finish batch form and the service.

export const MAX_QUOTA_PAIRS = 50_000;

const whole = (v: unknown) => (typeof v === "number" ? v : Number(String(v).trim()));

const wholeNumber = (message: string, max: number, tooMany: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .unknown()
      .refine((v) => v !== undefined && v !== null, message)
      .transform(whole)
      .refine((n) => Number.isInteger(n) && n >= 0, message)
      .refine((n) => n <= max, tooMany),
  );

/** The pairs finished in a batch (C-27): "Enter the pairs finished in Batch 2 as a whole number…". */
export function pairsSchema(batchNumber: number) {
  return wholeNumber(
    `Enter the pairs finished in Batch ${batchNumber} as a whole number, like 24. Enter 0 if none.`,
    MAX_PAIRS_PER_CHECK_IN,
    `Batch ${batchNumber} can't be more than ${MAX_PAIRS_PER_CHECK_IN.toLocaleString("en-PH")} pairs. Check the number.`,
  );
}

/** Of the pairs finished, how many failed inspection (C-27); at most the pairs finished. */
export function failedPairsSchema() {
  return wholeNumber(
    "Enter the pairs that failed inspection as a whole number, like 2. Enter 0 if none.",
    MAX_PAIRS_PER_CHECK_IN,
    `Failed inspection can't be more than ${MAX_PAIRS_PER_CHECK_IN.toLocaleString("en-PH")} pairs. Check the number.`,
  );
}

export const failedAboveFinishedMessage = (finished: number) =>
  `Failed inspection can't be more than the pairs finished (${finished.toLocaleString("en-PH")}).`;

/**
 * Both counts of a finished batch, checked together. Errors are keyed `pairs` and `failedPairs`
 * so the form puts each under its own field.
 */
export function parseBatchCounts(
  batchNumber: number,
  raw: { pairs?: unknown; failedPairs?: unknown },
):
  | { ok: true; pairs: number; failedPairs: number }
  | { ok: false; errors: Partial<Record<"pairs" | "failedPairs", string>> } {
  const errors: Partial<Record<"pairs" | "failedPairs", string>> = {};
  const pairs = pairsSchema(batchNumber).safeParse(raw.pairs);
  const failed = failedPairsSchema().safeParse(raw.failedPairs ?? 0);
  if (!pairs.success) errors.pairs = pairs.error.issues[0].message;
  if (!failed.success) errors.failedPairs = failed.error.issues[0].message;
  if (pairs.success && failed.success && (failed.data as number) > (pairs.data as number))
    errors.failedPairs = failedAboveFinishedMessage(pairs.data as number);
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, pairs: pairs.data as number, failedPairs: failed.data as number };
}

const QUOTA_MESSAGE = "Enter the daily quota as a whole number of pairs, at least 1.";

/** The one daily quota for the whole line (C-30). */
export const quotaPairsSchema = z.preprocess(
  blankToUndefined,
  z
    .unknown()
    .refine((v) => v !== undefined && v !== null, QUOTA_MESSAGE)
    .transform(whole)
    .refine((n) => Number.isInteger(n) && n >= 1, QUOTA_MESSAGE)
    .refine(
      (n) => n <= MAX_QUOTA_PAIRS,
      `The daily quota can't be more than ${MAX_QUOTA_PAIRS.toLocaleString("en-PH")} pairs. Check the number.`,
    ),
);

export const CORRECTION_REASON_MESSAGE =
  "Say why you're correcting this batch, at least 5 characters.";

export const correctionReasonSchema = z
  .string({ error: CORRECTION_REASON_MESSAGE })
  .trim()
  .min(5, CORRECTION_REASON_MESSAGE)
  .max(300, "Keep the reason under 300 characters.");

/** POST /api/v1/production/check-ins: finish a batch. The counts are checked by the service. */
export const checkInSchema = z.object({
  slotAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
  pairs: z.unknown().optional(),
  failedPairs: z.unknown().optional(),
  notes: optionalText(500, "notes"),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

/** PATCH /api/v1/production/check-ins/{id}: a same-day correction, with a reason. */
export const correctionSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
  pairs: z.unknown().optional(),
  failedPairs: z.unknown().optional(),
  reason: correctionReasonSchema,
});
export type CorrectionInput = z.infer<typeof correctionSchema>;

const timeField = (label: string, example: string) =>
  z
    .string({ error: `Enter the ${label} as a time, like ${example}.` })
    .trim()
    .refine(isTime, `Enter the ${label} as a time, like ${example}.`);

export const INTERVAL_MESSAGE =
  "Choose how often: every 1, 2, 3 or 4 hours, or once at the end of the day.";

/** PUT /api/v1/production/schedule (D-083, D-097). Applies from tomorrow. */
export const scheduleSchema = z
  .object({
    shiftStart: timeField("shift start", "08:00"),
    shiftEnd: timeField("shift end", "17:00"),
    // A number of working minutes, or null (the form sends "end") for once at the end of the day.
    intervalMinutes: z.preprocess(
      (v) => (v === "end" ? null : typeof v === "string" && v.trim() !== "" ? Number(v) : v),
      z
        .number({ error: INTERVAL_MESSAGE })
        .nullable()
        .refine(
          (n) => n === null || (INTERVAL_MINUTES as readonly number[]).includes(n),
          INTERVAL_MESSAGE,
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

/** PUT /api/v1/production/quotas: the one daily quota for the whole line (C-30). */
export const quotaSchema = z.object({
  pairs: quotaPairsSchema,
  // Sent by the form from the suggestion it showed, never typed, so a bad value means a stale page.
  suggestedPairs: z
    .number({ error: OUT_OF_DATE })
    .int(OUT_OF_DATE)
    .min(0, OUT_OF_DATE)
    .nullable()
    .optional(),
});
export type QuotaInput = z.infer<typeof quotaSchema>;

/**
 * PUT /api/v1/settings/lunch-break (C-3, A-4): a start and an end, or `{ none: true }` for no
 * lunch break. Whether it fits inside the shift is checked by the service against tomorrow's
 * schedule.
 */
export const lunchBreakSchema = z
  .object({
    none: z.boolean({ error: OUT_OF_DATE }).optional(),
    startTime: z.string().trim().optional(),
    endTime: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.none) return;
    const start = v.startTime ?? "";
    const end = v.endTime ?? "";
    if (!isTime(start))
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Enter the lunch start as a time, like 11:00.",
      });
    if (!isTime(end))
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Enter the lunch end as a time, like 12:00.",
      });
    if (isTime(start) && isTime(end) && minutesOf(end) <= minutesOf(start))
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Lunch must end after it starts.",
      });
  })
  .transform((v) =>
    v.none
      ? { startTime: null, endTime: null }
      : { startTime: v.startTime as string, endTime: v.endTime as string },
  );
export type LunchBreakInput = z.infer<typeof lunchBreakSchema>;

/** `?from=&to=` for GET /api/v1/production/days. */
export const daysQuerySchema = z.object({
  from: attendanceDaySchema.optional(),
  to: attendanceDaySchema.optional(),
});
