"use server";

import { headers } from "next/headers";
import { ROLE_HOME } from "@/lib/domain";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { signIn } from "@/server/lib/auth";
import { requireUser } from "@/server/policies/guard";
import { changeOwnPassword } from "@/server/services/auth.service";
import { passwordChangeSchema } from "@/server/validators/auth.validator";

/** Changes the password, then signs this browser in again (other sessions end, D-024). */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser({ allowPasswordChange: true });
  let email: string;
  let newPassword: string;
  try {
    const values = passwordChangeSchema.parse(input);
    const h = await headers();
    ({ email } = await changeOwnPassword(user.id, values, {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    }));
    newPassword = values.newPassword;
  } catch (error) {
    return toActionError(error, "Password change");
  }
  // Throws Next's redirect on success, so it stays outside the try.
  await signIn("credentials", { email, password: newPassword, redirectTo: ROLE_HOME[user.role] });
  return { ok: false, error: "Your password was changed. Sign in again with the new one." };
}
