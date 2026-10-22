"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { setActiveBatch, setCameraOperator } from "@/server/services/camera.service";
import { cameraOperatorSchema } from "@/server/validators/scan.validator";

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

/** Allow or stop a Shoe Constructor capturing at the camera (Floor Manager or System Admin, D-075). */
export async function setCameraOperatorAction(
  userId: string,
  canCapture: boolean,
): Promise<ActionResult> {
  const user = await requirePermission("camera:operators");
  try {
    await setCameraOperator(
      z.uuid().parse(userId),
      cameraOperatorSchema.parse({ canCapture }).canCapture,
      user,
    );
    revalidatePath("/camera");
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Camera operator change");
  }
}
