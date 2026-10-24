"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { setCameraOperator } from "@/server/services/camera.service";
import { cameraOperatorSchema } from "@/server/validators/scan.validator";

/** Allow or stop a Shoe Constructor capturing (the System Admin only, D-075, D-095). */
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
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Camera access change");
  }
}
