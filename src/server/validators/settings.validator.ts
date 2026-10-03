import { z } from "zod";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, `Keep the ${label} under ${max} characters.`).optional(),
  );
const sortOrder = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? 0 : v),
  z.coerce
    .number({ error: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(0, "Use 0 or more.")
    .max(999, "Use 999 or less."),
);

/** Thresholds as percentages in the form; the service stores fractions (D-011). */
const percent = (label: string) =>
  z.coerce
    .number({ error: `Enter the ${label} as a percentage.` })
    .refine((n) => Number.isFinite(n) && n > 0 && n <= 100, `Use a value above 0 and up to 100.`)
    .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6, "Use at most one decimal place.");

export const thresholdsSchema = z.object({
  rejectPercent: percent("Reject threshold"),
  reworkPercent: percent("Rework threshold"),
});

export type ThresholdsInput = z.output<typeof thresholdsSchema>;

export const defectTypeCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9_-]{0,39}$/,
      "Use the class name exactly as the camera model sends it: lower-case letters, numbers, - or _.",
    ),
  label: z.string().trim().min(1, "Enter a label people will read, e.g. Scratch.").max(40),
  description: optionalText(200, "description"),
  sortOrder,
});
/** The key is fixed after creation: the camera sends it, and past detections reference it. */
export const defectTypeUpdateSchema = defectTypeCreateSchema.omit({ key: true });

export const shoeTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Use 2–10 letters or numbers, e.g. SCH."),
  name: z.string().trim().min(2, "Enter the shoe type's name.").max(40),
  sortOrder,
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier's name.").max(80),
  contactPerson: optionalText(80, "contact person"),
  phone: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(30, "Keep the phone under 30 characters.")
      .regex(/^[0-9+()\- ]+$/, "Use digits, spaces, +, - or brackets only.")
      .optional(),
  ),
  notes: optionalText(300, "notes"),
});

export const componentTypeSchema = z.object({
  name: z.string().trim().min(2, "Enter the component's name, e.g. Vamp.").max(60),
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

export const referenceActiveSchema = z.object({ isActive: z.boolean() });

export function isReferenceKind(value: string): value is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(value);
}

export function isReferenceId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
