import { z } from "zod";
import { blankToUndefined, optionalText, OUT_OF_DATE } from "./shared";

const sortOrder = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? 0 : v),
  z.coerce
    .number({ error: "Enter the sort order as a whole number, like 10." })
    .int("Enter the sort order as a whole number, like 10.")
    .min(0, "The sort order can't be below 0. Enter 0 or more.")
    .max(999, "The sort order can't be above 999. Enter 999 or less."),
);

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
  .transform(({ foundPercent, earlyModelNotice }) => ({ foundPercent, earlyModelNotice }));

/** The early-model notice on the Camera page (D-055). */
export const modelNoticeSchema = z.object({
  earlyModelNotice: z.boolean({ error: OUT_OF_DATE }),
});

export type ThresholdsInput = z.output<typeof thresholdsSchema>;
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

export const shoeTypeSchema = z.object({
  code: z
    .string({ error: "Enter a code for the shoe type, e.g. SCH." })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "The code must be 2 to 10 letters or numbers, e.g. SCH."),
  name: z
    .string({ error: "Enter the shoe type's name, e.g. School shoe." })
    .trim()
    .min(2, "Enter the shoe type's name (at least 2 characters), e.g. School shoe.")
    .max(40, "Keep the shoe type's name under 40 characters."),
  sortOrder,
});

export const supplierSchema = z.object({
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

export const REFERENCE_KINDS = ["defectType", "shoeType", "supplier"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const referenceSchemas = {
  defectType: { create: defectTypeCreateSchema, update: defectTypeUpdateSchema },
  shoeType: { create: shoeTypeSchema, update: shoeTypeSchema },
  supplier: { create: supplierSchema, update: supplierSchema },
} as const;

export const referenceActiveSchema = z.object({ isActive: z.boolean({ error: OUT_OF_DATE }) });

export function isReferenceKind(value: string): value is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(value);
}

export function isReferenceId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
