"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { decideScan } from "@/server/services/scan-decision.service";
import { decisionSchema, isScanId } from "@/server/validators/scan.validator";

export async function decideScanAction(
  id: string,
  input: { verdict: string; reason?: string; expectedFinalVerdict: string | null },
): Promise<ActionResult<{ finalVerdict: string }>> {
  const user = await requirePermission("scan:decide");
  if (!isScanId(id)) return { ok: false, error: "This scan doesn't exist." };
  try {
    const result = await decideScan(id, decisionSchema.parse(input), user);
    revalidatePath("/scans");
    revalidatePath(`/scans/${id}`);
    revalidatePath("/review");
    revalidatePath("/quality-inspector");
    return { ok: true, finalVerdict: result.finalVerdict };
  } catch (error) {
    return toActionError(error, "Scan decision");
  }
}
