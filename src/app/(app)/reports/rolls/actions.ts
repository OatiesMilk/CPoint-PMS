"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { removeRoll, updateRoll } from "@/server/services/roll.service";
import { isRollId, removeRollSchema, updateRollSchema } from "@/server/validators/roll.validator";

/**
 * The Floor Manager removes a roll left open at Capture, with a reason (Phase 30E): nothing comes
 * off stock and nothing is deleted. Used by Reports → Rolls and by a leather item's Rolls.
 */
export async function removeRollAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("roll:manage");
  if (!isRollId(id)) return { ok: false, error: "This roll doesn't exist." };
  try {
    const { reason } = removeRollSchema.parse(input);
    await removeRoll(id, reason, user);
    revalidatePath("/reports/rolls");
    revalidatePath(`/reports/rolls/${id}`);
    revalidatePath("/inventory", "layout");
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Removing the roll");
  }
}

/**
 * The Floor Manager corrects a roll's tag number, received day, return note or area (before Finish
 * roll), with a reason (Phase 35B). Only what changed goes in the audit log.
 */
export async function updateRollAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("roll:manage");
  if (!isRollId(id)) return { ok: false, error: "This roll doesn't exist." };
  try {
    await updateRoll(id, updateRollSchema.parse(input), user);
    revalidatePath("/reports/rolls");
    revalidatePath(`/reports/rolls/${id}`);
    revalidatePath("/inventory", "layout");
    return { ok: true };
  } catch (error) {
    return toActionError(error, "The correction");
  }
}
