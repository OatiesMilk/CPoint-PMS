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

/** Thresholds as percentages in the form; the service stores fractions (D-011). */
const percent = (label: string) =>
  z.coerce
    .number({ error: `Enter the ${label} as a percentage, like 90.` })
    .refine(
      (n) => Number.isFinite(n) && n > 0 && n <= 100,
      `The ${label} must be above 0 and at most 100.`,
    )
    .refine(
      (n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6,
      `The ${label} can have at most one decimal place, like 87.5.`,
    );

export const thresholdsSchema = z.object({
  rejectPercent: percent("reject threshold"),
  reworkPercent: percent("rework threshold"),
  /** Optional, so API callers from before D-053 keep working; left out = unchanged. */
  foundPercent: percent("found-at value").optional(),
});

/** The early-model notice on the Camera page (D-055). */
export const modelNoticeSchema = z.object({
  earlyModelNotice: z.boolean({ error: OUT_OF_DATE }),
});

export type ThresholdsInput = z.output<typeof thresholdsSchema>;
export type ModelNoticeInput = z.output<typeof modelNoticeSchema>;

export const defectTypeCreateSchema = z.object({
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
  /** What a found defect of this type means (D-053); blank = by confidence (D-011). */
  action: z.preprocess(
    blankToUndefined,
    z
      .enum(["REWORK", "REJECT"], {
        error: "Choose what a found defect means: By confidence, Rework or Reject.",
      })
      .optional(),
  ),
  sortOrder,
});
/** The key is fixed after creation: the camera sends it, and past detections reference it. */
export const defectTypeUpdateSchema = defectTypeCreateSchema.omit({ key: true });

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

export const componentTypeSchema = z.object({
  name: z
    .string({ error: "Enter the component's name, e.g. Vamp." })
    .trim()
    .min(2, "Enter the component's name (at least 2 characters), e.g. Vamp.")
    .max(60, "Keep the component's name under 60 characters."),
  shoeTypeId: z.preprocess(
    blankToUndefined,
    z.uuid("Choose a shoe type from the list.").optional(),
  ),
  sortOrder,
});

export const REFERENCE_KINDS = ["defectType", "shoeType", "supplier", "componentType"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const referenceSchemas = {
  defectType: { create: defectTypeCreateSchema, update: defectTypeUpdateSchema },
  shoeType: { create: shoeTypeSchema, update: shoeTypeSchema },
  supplier: { create: supplierSchema, update: supplierSchema },
  componentType: { create: componentTypeSchema, update: componentTypeSchema },
} as const;

export const referenceActiveSchema = z.object({ isActive: z.boolean({ error: OUT_OF_DATE }) });

export function isReferenceKind(value: string): value is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(value);
}

export function isReferenceId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
