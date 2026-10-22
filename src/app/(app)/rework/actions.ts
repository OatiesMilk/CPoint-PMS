"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { moveReworkTicket } from "@/server/services/rework.service";
import { isOutcomeId, reworkMoveSchema } from "@/server/validators/outcome.validator";

export async function moveReworkAction(
  id: string,
  input: { move: string; expectedStatus: string; note?: string },
): Promise<ActionResult<{ status: string }>> {
  const user = await requirePermission("rework:manage");
  if (!isOutcomeId(id)) return { ok: false, error: "This section isn't on the board." };
  try {
    const result = await moveReworkTicket(id, reworkMoveSchema.parse(input), user);
    revalidatePath("/rework");
    revalidatePath("/floor-manager");
    revalidatePath("/batches", "layout");
    revalidatePath("/scans", "layout");
    return { ok: true, status: result.status };
  } catch (error) {
    return toActionError(error, "Board move");
  }
}
