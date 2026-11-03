import { z } from "zod";
import {
  FLAT_SHARE_MESSAGE,
  LENGTH_LIMIT_MESSAGE,
  RETURN_LIMIT_MESSAGE,
  validateReturnLimit,
} from "@/lib/admin-rules";
import { SUPPLIER_CODE_MESSAGE, SUPPLIER_CODE_PATTERN } from "@/lib/roll-rules";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";

const sortOrder = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? 0 : v),
  z.coerce
    .number({ error: "Enter the sort order as a whole number, like 10." })
    .int("Enter the sort order as a whole number, like 10.")
    .min(0, "The sort order can't be below 0. Enter 0 or more.")
    .max(999, "The sort order can't be above 999. Enter 999 or less."),
);

/** Left out: unchanged. A blank box: null (cleared). Otherwise a number within the bounds, two decimals. */
function optionalNumber(min: number, max: number, message: string) {
  return z.preprocess(
    (v) => {
      // Left out: unchanged (undefined). Blank or null: cleared (null).
      if (v === undefined) return undefined;
      if (v === null || (typeof v === "string" && v.trim() === "")) return null;
      return typeof v === "number" ? v : Number(v);
    },
    z
      .number({ error: message })
      .refine(
        (n) =>
          Number.isFinite(n) &&
          n >= min &&
          n <= max &&
          Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
        message,
      )
      .nullable()
      .optional(),
  );
}

const FOUND_AT = "Enter the found-at value as a percentage from 1 to 100, like 50.";

/**
 * "A defect counts as found at" as a percentage (the service stores a fraction, D-053), and the
 * early-model notice when the API sends it (D-055). The two old thresholds are refused by name
 * (Phase 25, D-093), so an old caller learns why instead of being silently ignored.
 */
export const thresholdsSchema = z
  .object({
    foundPercent: z.coerce
      .number({ error: FOUND_AT })
      .refine((n) => Number.isFinite(n) && n >= 1 && n <= 100, FOUND_AT)
      .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6, FOUND_AT),
    earlyModelNotice: z.boolean({ error: OUT_OF_DATE }).optional(),
    /** The supplier limit (Phase 30C, C-9); left out keeps the one saved. */
    returnPercent: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce
        .number({ error: RETURN_LIMIT_MESSAGE })
        .refine((n) => validateReturnLimit(n).length === 0, RETURN_LIMIT_MESSAGE)
        .optional(),
    ),
    rejectPercent: z.unknown().optional(),
    reworkPercent: z.unknown().optional(),
  })
  .superRefine((v, ctx) => {
    for (const key of ["rejectPercent", "reworkPercent"] as const)
      if (v[key] !== undefined)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message:
            "The two confidence thresholds were removed: a section is Pass or Reject from each defect type's outcome. Send foundPercent only, like 50.",
        });
  })
  .transform(({ foundPercent, earlyModelNotice, returnPercent }) => ({
    foundPercent,
    earlyModelNotice,
    returnPercent,
  }));

/** The early-model notice on the Camera page (D-055). */
export const modelNoticeSchema = z.object({
  earlyModelNotice: z.boolean({ error: OUT_OF_DATE }),
});

export type ThresholdsInput = {
  foundPercent: number;
  earlyModelNotice?: boolean;
  returnPercent?: number;
};
export type ModelNoticeInput = z.output<typeof modelNoticeSchema>;

const defectTypeCreateFields = z.object({
  key: z
    .string({ error: "Enter the class key exactly as the camera model sends it, e.g. scratch." })
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9_-]{0,39}$/,
      "Enter the class key exactly as the camera model sends it: up to 40 lower-case letters, numbers, - or _.",
    ),
  label: z
    .string({ error: "Enter a label people will read, e.g. Scratch." })
    .trim()
    .min(1, "Enter a label people will read, e.g. Scratch.")
    .max(40, "Keep the label under 40 characters."),
  description: optionalText(200, "description"),
  /** Usable or Not accepted once found (D-093). Required; the message names the type. */
  outcome: z.preprocess(
    blankToUndefined,
    z
      .enum(["USABLE", "NOT_ACCEPTED"], {
        error: "Choose Usable or Not accepted for When found; nothing else is allowed.",
      })
      .optional(),
  ),
  /** Not accepted from this length in inches, Usable below (Phase 30C, C-37); blank: none. */
  notAcceptedFromIn: optionalNumber(0.1, 100, LENGTH_LIMIT_MESSAGE),
  /** Counts as this flat share of the roll instead of its box area (D-110); blank: box area. */
  flatSharePct: optionalNumber(0.1, 100, FLAT_SHARE_MESSAGE),
  sortOrder,
});
/** "Choose whether a found Crease is Usable or Not accepted." with the type's own label. */
function requireOutcome<T extends { label: string; outcome?: "USABLE" | "NOT_ACCEPTED" }>(
  schema: z.ZodType<T>,
) {
  return schema.superRefine((v, ctx) => {
    if (!v.outcome)
      ctx.addIssue({
        code: "custom",
        path: ["outcome"],
        message: `Choose whether a found ${v.label} is Usable or Not accepted.`,
      });
  });
}

const defectTypeBase = defectTypeCreateFields;
export const defectTypeCreateSchema = requireOutcome(defectTypeBase);
/** The key is fixed after creation: the camera sends it, and past detections reference it. */
export const defectTypeUpdateSchema = requireOutcome(defectTypeBase.omit({ key: true }));

/**
 * A supplier's short code for roll codes, LR-MLT-001 (Phase 30A, D-104). Optional: left blank, a new
 * supplier gets one from its name's initials and an edit keeps the old one.
 */
const supplierCode = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v),
  z
    .string({ error: SUPPLIER_CODE_MESSAGE })
    .regex(SUPPLIER_CODE_PATTERN, SUPPLIER_CODE_MESSAGE)
    .optional(),
);

export const supplierSchema = z.object({
  code: supplierCode,
  name: z
    .string({ error: "Enter the supplier's name." })
    .trim()
    .min(2, "Enter the supplier's name (at least 2 characters).")
    .max(80, "Keep the supplier's name under 80 characters."),
  contactPerson: optionalText(80, "contact person"),
  phone: z.preprocess(
    blankToUndefined,
    z
      .string({ error: "Enter the phone number using digits, like 0917 123 4567." })
      .trim()
      .max(30, "Keep the phone number under 30 characters.")
      .regex(
        /^[0-9+()\- ]+$/,
        "The phone number can only have digits, spaces, +, - or brackets, like 0917 123 4567.",
      )
      .optional(),
  ),
  notes: optionalText(300, "notes"),
});

export const REFERENCE_KINDS = ["defectType", "supplier"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const referenceSchemas = {
  defectType: { create: defectTypeCreateSchema, update: defectTypeUpdateSchema },
  supplier: { create: supplierSchema, update: supplierSchema },
} as const;

export const referenceActiveSchema = z.object({ isActive: z.boolean({ error: OUT_OF_DATE }) });

export function isReferenceKind(value: string): value is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(value);
}

export function isReferenceId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
