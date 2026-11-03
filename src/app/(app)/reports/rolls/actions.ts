"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { decideReturn, removeRoll } from "@/server/services/roll.service";
import {
  isRollId,
  removeRollSchema,
  returnDecisionSchema,
} from "@/server/validators/roll.validator";

/**
 * The Floor Manager removes a roll with a reason (Phase 30A; the old Cancel): a roll from
 * Inventory that isn't fully used leaves stock, an old open roll is closed. Nothing is deleted.
 * Used by Reports → Rolls and by a leather item's Rolls in Inventory.
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
 * The Floor Manager's decision on a scanned roll (Phase 30C, C-36): Returned to supplier (it
 * leaves stock) or Keep (it can then be ticked Fully used).
 */
export async function decideReturnAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("roll:manage");
  if (!isRollId(id)) return { ok: false, error: "This roll doesn't exist." };
  try {
    await decideReturn(id, returnDecisionSchema.parse(input), user);
    revalidatePath("/reports/rolls");
    revalidatePath(`/reports/rolls/${id}`);
    revalidatePath("/inventory", "layout");
    revalidatePath("/floor-manager");
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Saving the decision");
  }
}
