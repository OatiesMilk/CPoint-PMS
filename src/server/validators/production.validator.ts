import { z } from "zod";
import {
  FACTORY_CLOSES,
  FACTORY_OPENS,
  INTERVAL_MINUTES,
  isMonth,
  isTime,
  MAX_PAIRS_PER_CHECK_IN,
  MAX_ROLLS_PLANNED,
  minutesOf,
} from "@/lib/production-rules";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";
import { attendanceDaySchema } from "./attendance.validator";
import { findingLinesSchema } from "./repair.validator";

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

/**
 * The pairs finished in a batch (C-27), named by its code (Phase 33): "Enter the pairs finished in
 * B-261116-2 as a whole number…".
 */
export function pairsSchema(batch: string) {
  return wholeNumber(
    `Enter the pairs finished in ${batch} as a whole number, like 24. Enter 0 if none.`,
    MAX_PAIRS_PER_CHECK_IN,
    `${batch} can't be more than ${MAX_PAIRS_PER_CHECK_IN.toLocaleString("en-PH")} pairs. Check the number.`,
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
  batch: string,
  raw: { pairs?: unknown; failedPairs?: unknown },
):
  | { ok: true; pairs: number; failedPairs: number }
  | { ok: false; errors: Partial<Record<"pairs" | "failedPairs", string>> } {
  const errors: Partial<Record<"pairs" | "failedPairs", string>> = {};
  const pairs = pairsSchema(batch).safeParse(raw.pairs);
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

/**
 * POST /api/v1/production/check-ins: finish a batch, named by its queued row (Phase 33) or, as
 * before, by its end. The counts are checked by the service.
 */
export const checkInSchema = z
  .object({
    batchId: z.uuid({ error: OUT_OF_DATE }).optional(),
    slotAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }).optional(),
    pairs: z.unknown().optional(),
    failedPairs: z.unknown().optional(),
    notes: optionalText(500, "notes"),
    /** What was wrong with the failed pairs (Phase 34); checked against the failed count. */
    findings: findingLinesSchema,
  })
  .refine((v) => v.batchId !== undefined || v.slotAt !== undefined, {
    message: OUT_OF_DATE,
    path: ["batchId"],
  });
export type CheckInInput = z.infer<typeof checkInSchema>;

// ───────────── the Inspection queue (Phase 33, D-129) ─────────────

export const PRIORITY_REASON_MESSAGE =
  'Say why this batch is urgent, at least 5 characters, like "Customer pick-up at 3 pm".';
export const VOID_REASON_MESSAGE =
  'Say why this batch won\'t be inspected, at least 5 characters, like "Line stopped, no pairs made".';

const reasonField = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(5, message)
    .max(200, "Keep the reason under 200 characters.");

/** POST /api/v1/production/batches/{id}/start: I'm inspecting this batch now. */
export const startInspectionSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
});
export type StartInspectionInput = z.infer<typeof startInspectionSchema>;

/** PUT /api/v1/production/batches/{id}/priority: Urgent needs a reason; Normal clears it (A-58). */
export const prioritySchema = z.discriminatedUnion(
  "priority",
  [
    z.object({
      priority: z.literal("URGENT"),
      reason: reasonField(PRIORITY_REASON_MESSAGE),
      expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
    }),
    z.object({
      priority: z.literal("NORMAL"),
      reason: z.unknown().optional(),
      expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
    }),
  ],
  { error: "Choose Urgent or Normal." },
);
export type PriorityInput = z.infer<typeof prioritySchema>;

/** POST /api/v1/production/batches/{id}/void: it won't be inspected, with a reason (A-59). */
export const voidBatchSchema = z.object({
  reason: reasonField(VOID_REASON_MESSAGE),
  expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
});
export type VoidBatchInput = z.infer<typeof voidBatchSchema>;

/** GET /api/v1/production/batches: the queue's filters; anything unknown is ignored. */
export const queueQuerySchema = z.object({
  day: attendanceDaySchema.optional().catch(undefined),
  status: z.enum(["WAITING", "LATE", "INSPECTING"]).optional().catch(undefined),
  priority: z.enum(["NORMAL", "URGENT"]).optional().catch(undefined),
  q: z.string().trim().max(20).optional().catch(undefined),
});
export type QueueQuery = z.infer<typeof queueQuerySchema>;

/** PATCH /api/v1/production/check-ins/{id}: a correction on the day it was inspected, with a reason. */
export const correctionSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true, error: OUT_OF_DATE }),
  pairs: z.unknown().optional(),
  failedPairs: z.unknown().optional(),
  /** Left out when the lines can't change (a repair is already back, A-93). */
  findings: findingLinesSchema,
  reason: correctionReasonSchema,
});
export type CorrectionInput = z.infer<typeof correctionSchema>;

const timeField = (label: string, example: string) =>
  z
    .string({ error: `Enter the ${label} as a time, like ${example}.` })
    .trim()
    .refine(isTime, `Enter the ${label} as a time, like ${example}.`);

export const INTERVAL_MESSAGE =
  "Choose the check-in interval: every 4 hours, or once at the end of the day.";

export const SHIFT_START_WINDOW_MESSAGE = `Shift start must be ${FACTORY_OPENS} or later.`;
export const SHIFT_END_WINDOW_MESSAGE = `Shift end must be ${FACTORY_CLOSES} or earlier.`;

export const ROLLS_PLANNED_MESSAGE =
  "Enter the rolls to be used as a whole number, like 5. Enter 0 if none.";

/** Rolls to be used on a day (D-114): an estimate, 0 to 200. */
export const rollsPlannedSchema = wholeNumber(
  ROLLS_PLANNED_MESSAGE,
  MAX_ROLLS_PLANNED,
  `Rolls to be used can't be more than ${MAX_ROLLS_PLANNED}. Check the number.`,
);

/** The plan's `updatedAt` the form loaded, or null for a day with nothing saved yet (STALE). */
const expectedUpdatedAt = z.iso
  .datetime({ offset: true, error: OUT_OF_DATE })
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/**
 * PUT /api/v1/production/plans/{day} (D-114, D-115, D-105): rolls to be used, the quota, the
 * check-in interval (every 4 hours or once at the end of the day) and the shift, inside the
 * factory's hours (08:00 to 17:00; a shorter shift is fine).
 */
export const dayPlanSchema = z
  .object({
    rollsPlanned: rollsPlannedSchema,
    quota: quotaPairsSchema,
    // Sent by the form from the suggestion it showed, never typed, so a bad value means a stale page.
    suggestedQuota: z
      .number({ error: OUT_OF_DATE })
      .int(OUT_OF_DATE)
      .min(0, OUT_OF_DATE)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    shiftStart: timeField("shift start", "08:00"),
    shiftEnd: timeField("shift end", "17:00"),
    // 240, or null (the form sends "end") for once at the end of the day.
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
    expectedUpdatedAt,
  })
  .superRefine((v, ctx) => {
    if (isTime(v.shiftStart) && minutesOf(v.shiftStart) < minutesOf(FACTORY_OPENS))
      ctx.addIssue({ code: "custom", path: ["shiftStart"], message: SHIFT_START_WINDOW_MESSAGE });
    if (isTime(v.shiftEnd) && minutesOf(v.shiftEnd) > minutesOf(FACTORY_CLOSES))
      ctx.addIssue({ code: "custom", path: ["shiftEnd"], message: SHIFT_END_WINDOW_MESSAGE });
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
export type DayPlanInput = z.infer<typeof dayPlanSchema>;

/** PUT and DELETE /api/v1/production/plans/{day}/non-working: only the STALE stamp. */
export const dayMarkSchema = z.object({ expectedUpdatedAt });
export type DayMarkInput = z.infer<typeof dayMarkSchema>;

/** The `{day}` of a plan route: "YYYY-MM-DD". */
export const planDaySchema = attendanceDaySchema;

/** `?month=2026-11` for GET /api/v1/production/plans. */
export const planMonthSchema = z.object({
  month: z
    .string({ error: "Give the month as YYYY-MM, like 2026-11." })
    .refine(isMonth, "Give the month as YYYY-MM, like 2026-11.")
    .optional(),
});

/**
 * PUT /api/v1/settings/lunch-break (C-3, A-4): a start and an end, or `{ none: true }` for no
 * lunch break. Whether it fits inside the factory's hours is checked by the service.
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
