import { z } from "zod";
import { isTagCode, normalizeTagCode, ROLL_TAG_MESSAGES } from "@/lib/roll-tag-rules";

const code = z
  .string({ error: ROLL_TAG_MESSAGES.code })
  .transform(normalizeTagCode)
  .refine(isTagCode, ROLL_TAG_MESSAGES.code);

/** The supplier box: a supplier's id, or empty for a tag any supplier can use. */
const supplierId = z
  .union([z.uuid({ error: ROLL_TAG_MESSAGES.chooseSupplier }), z.literal("")])
  .nullable()
  .transform((v) => (v ? v : null));

const isDefault = z.boolean({ error: ROLL_TAG_MESSAGES.isDefault });

/** Inventory → Roll tags → Add tag (Phase 42, D-139). */
export const addRollTagSchema = z.object({
  code,
  supplierId: supplierId.optional().transform((v) => v ?? null),
  isDefault: isDefault.optional().transform((v) => v ?? false),
});
export type AddRollTagValues = z.output<typeof addRollTagSchema>;

/** Edit a tag, or deactivate / reactivate it. Only the fields sent change. */
export const editRollTagSchema = z.object({
  code: code.optional(),
  supplierId: supplierId.optional(),
  isDefault: isDefault.optional(),
  isActive: z.boolean({ error: "Choose whether the tag is active." }).optional(),
});
export type EditRollTagValues = z.output<typeof editRollTagSchema>;

const idSchema = z.uuid();

/** True for a well-formed tag id. Anything else is a 404, never a database error. */
export function isRollTagId(value: string): boolean {
  return idSchema.safeParse(value).success;
}
