"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  createReferenceRow,
  saveModelNotice,
  saveThresholds,
  setReferenceActive,
  updateReferenceRow,
} from "@/server/services/settings.service";
import {
  isReferenceId,
  isReferenceKind,
  modelNoticeSchema,
  thresholdsSchema,
} from "@/server/validators/settings.validator";

export type { ActionResult };

const toResult = (error: unknown) => toActionError(error, "Settings action");
const BAD = { ok: false as const, error: "This item doesn't exist." };
const refresh = () => {
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
};

export async function saveThresholdsAction(input: unknown): Promise<ActionResult> {
  const admin = await requirePermission("settings:manage");
  try {
    await saveThresholds(thresholdsSchema.parse(input), admin);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function saveModelNoticeAction(input: unknown): Promise<ActionResult> {
  const admin = await requirePermission("settings:manage");
  try {
    await saveModelNotice(modelNoticeSchema.parse(input), admin);
    refresh();
    revalidatePath("/camera");
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function createReferenceAction(kind: string, input: unknown): Promise<ActionResult> {
  const admin = await requirePermission("settings:manage");
  if (!isReferenceKind(kind)) return BAD;
  try {
    await createReferenceRow(kind, input, admin);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateReferenceAction(
  kind: string,
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const admin = await requirePermission("settings:manage");
  if (!isReferenceKind(kind) || !isReferenceId(id)) return BAD;
  try {
    await updateReferenceRow(kind, id, input, admin);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function setReferenceActiveAction(
  kind: string,
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requirePermission("settings:manage");
  if (!isReferenceKind(kind) || !isReferenceId(id)) return BAD;
  try {
    await setReferenceActive(kind, id, isActive, admin);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}
