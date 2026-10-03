"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  createAccount,
  resetAccountPassword,
  setAccountActive,
  unlockAccount,
  updateAccount,
} from "@/server/services/user-admin.service";
import { isUserId, userFormSchema } from "@/server/validators/user.validator";

export type { ActionResult };

const toResult = (error: unknown) => toActionError(error, "User admin action");
const NOT_FOUND = { ok: false as const, error: "This account doesn't exist." };
const refresh = () => {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
};

export async function createUserAction(
  input: unknown,
): Promise<ActionResult<{ name: string; temporaryPassword: string }>> {
  const admin = await requirePermission("user:manage");
  try {
    const result = await createAccount(userFormSchema.parse(input), admin);
    refresh();
    return { ok: true, name: result.name, temporaryPassword: result.temporaryPassword };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateUserAction(id: string, input: unknown): Promise<ActionResult> {
  const admin = await requirePermission("user:manage");
  if (!isUserId(id)) return NOT_FOUND;
  try {
    await updateAccount(id, userFormSchema.parse(input), admin);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function setUserActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requirePermission("user:manage");
  if (!isUserId(id)) return NOT_FOUND;
  try {
    await setAccountActive(id, isActive, admin);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function resetPasswordAction(
  id: string,
): Promise<ActionResult<{ name: string; temporaryPassword: string }>> {
  const admin = await requirePermission("user:manage");
  if (!isUserId(id)) return NOT_FOUND;
  try {
    const result = await resetAccountPassword(id, admin);
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return toResult(error);
  }
}

export async function unlockUserAction(id: string): Promise<ActionResult> {
  const admin = await requirePermission("user:manage");
  if (!isUserId(id)) return NOT_FOUND;
  try {
    await unlockAccount(id, admin);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}
