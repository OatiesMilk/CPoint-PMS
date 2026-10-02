"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { setActiveBatch } from "@/server/services/camera.service";

export async function setActiveBatchAction(batchId: string | null): Promise<ActionResult> {
  const user = await requirePermission("camera:manage");
  try {
    await setActiveBatch(batchId ? z.uuid().parse(batchId) : null, user);
    revalidatePath("/camera");
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Camera batch change");
  }
}
