"use server";

import { revalidatePath } from "next/cache";
import type { Stage } from "@/lib/domain";
import type { TransitionAction } from "@/lib/stage-machine";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  cancelBatch,
  createBatch,
  transitionBatchStage,
  updateBatch,
} from "@/server/services/batch.service";
import {
  batchFormSchema,
  cancelSchema,
  isBatchId,
  transitionSchema,
} from "@/server/validators/batch.validator";

export type { ActionResult };

const toResult = (error: unknown) => toActionError(error, "Batch action");

function refresh(id?: string) {
  revalidatePath("/batches");
  revalidatePath("/floor-manager");
  if (id) revalidatePath(`/batches/${id}`);
}

export async function createBatchAction(
  input: unknown,
): Promise<ActionResult<{ id: string; code: string }>> {
  const user = await requirePermission("batch:manage");
  try {
    const batch = await createBatch(batchFormSchema.parse(input), user);
    refresh();
    return { ok: true, id: batch.id, code: batch.code };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateBatchAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("batch:manage");
  if (!isBatchId(id)) return { ok: false, error: "This batch doesn't exist." };
  try {
    await updateBatch(id, batchFormSchema.parse(input), user);
    refresh(id);
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function transitionBatchAction(
  id: string,
  input: { action: TransitionAction; expectedStage: Stage; reason?: string },
): Promise<ActionResult<{ currentStage: Stage; status: string }>> {
  const user = await requirePermission("batch:manage");
  if (!isBatchId(id)) return { ok: false, error: "This batch doesn't exist." };
  try {
    const result = await transitionBatchStage(id, transitionSchema.parse(input), user);
    refresh(id);
    return { ok: true, currentStage: result.currentStage, status: result.status };
  } catch (error) {
    return toResult(error);
  }
}

export async function cancelBatchAction(
  id: string,
  input: { reason: string; expectedStage?: Stage },
): Promise<ActionResult> {
  const user = await requirePermission("batch:manage");
  if (!isBatchId(id)) return { ok: false, error: "This batch doesn't exist." };
  try {
    await cancelBatch(id, cancelSchema.parse(input), user);
    refresh(id);
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}
