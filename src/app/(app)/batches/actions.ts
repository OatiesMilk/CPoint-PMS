"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { Stage } from "@/lib/domain";
import type { TransitionAction } from "@/lib/stage-machine";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
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

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

type Issue = { path: PropertyKey[]; message: string };

function fieldErrorsFrom(issues: Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Turns service errors into something the form or button can show; never leaks internals. */
function toResult(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: "Some fields need fixing.",
      fieldErrors: fieldErrorsFrom(error.issues),
    };
  }
  if (error instanceof AppError) {
    const fieldErrors = Array.isArray(error.details)
      ? fieldErrorsFrom(error.details as Issue[])
      : undefined;
    return { ok: false, error: error.message, code: error.code, fieldErrors };
  }
  logger.error({ err: error }, "Batch action failed");
  return { ok: false, error: "Something failed on our side. Nothing was changed. Try again." };
}

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
