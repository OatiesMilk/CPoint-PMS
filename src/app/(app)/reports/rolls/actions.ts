"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { cancelRoll } from "@/server/services/roll.service";
import { isRollId, managerCancelSchema } from "@/server/validators/roll.validator";

/** The Floor Manager cancels an open roll with a reason (Phase 26). Nothing is deleted. */
export async function cancelRollAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("roll:manage");
  if (!isRollId(id)) return { ok: false, error: "This roll doesn't exist." };
  try {
    const { reason } = managerCancelSchema.parse(input);
    await cancelRoll(id, { by: "manager", reason }, user);
    revalidatePath("/reports/rolls");
    revalidatePath(`/reports/rolls/${id}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Cancelling the roll");
  }
}
