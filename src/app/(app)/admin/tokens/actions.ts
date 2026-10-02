"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { createDeviceToken, revokeDeviceToken } from "@/server/services/api-token.service";
import { createTokenSchema } from "@/server/validators/token.validator";

export async function createTokenAction(input: {
  name: string;
}): Promise<ActionResult<{ token: string; name: string }>> {
  const user = await requirePermission("token:manage");
  try {
    const { name } = createTokenSchema.parse(input);
    const created = await createDeviceToken({ name }, user);
    revalidatePath("/admin/tokens");
    return { ok: true, token: created.token, name: created.name };
  } catch (error) {
    return toActionError(error, "Token creation");
  }
}

export async function revokeTokenAction(id: string): Promise<ActionResult> {
  const user = await requirePermission("token:manage");
  try {
    await revokeDeviceToken(z.uuid().parse(id), user);
    revalidatePath("/admin/tokens");
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Token revoke");
  }
}
