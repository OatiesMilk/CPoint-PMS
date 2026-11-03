"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  correctCheckIn,
  saveCheckIn,
  saveQuota,
  saveSchedule,
} from "@/server/services/production.service";
import {
  checkInSchema,
  correctionSchema,
  quotaSchema,
  scheduleSchema,
} from "@/server/validators/production.validator";
import { z } from "zod";

function refresh() {
  revalidatePath("/batches");
  revalidatePath("/batches/plan");
  revalidatePath("/floor-manager");
  revalidatePath("/reports");
}

/** Finish a batch: the pairs finished and, of these, failed inspection (C-27). */
export async function finishBatchAction(
  input: unknown,
): Promise<ActionResult<{ number: number; time: string }>> {
  const user = await requirePermission("production:checkin");
  try {
    const result = await saveCheckIn(checkInSchema.parse(input), user);
    refresh();
    return { ok: true, number: result.number, time: result.time };
  } catch (error) {
    return toActionError(error, "Finishing the batch");
  }
}

/** A same-day correction with a reason. */
export async function correctBatchAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ number: number }>> {
  const user = await requirePermission("production:checkin");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "This batch doesn't exist." };
  try {
    const result = await correctCheckIn(id, correctionSchema.parse(input), user);
    refresh();
    return { ok: true, number: result.number };
  } catch (error) {
    return toActionError(error, "The correction");
  }
}

export async function saveScheduleAction(
  input: unknown,
): Promise<ActionResult<{ saved: boolean; effectiveFrom: string }>> {
  const user = await requirePermission("production:plan");
  try {
    const result = await saveSchedule(scheduleSchema.parse(input), user);
    refresh();
    return { ok: true, saved: result.saved, effectiveFrom: result.effectiveFrom };
  } catch (error) {
    return toActionError(error, "The schedule");
  }
}

export async function saveQuotaAction(
  input: unknown,
): Promise<ActionResult<{ saved: boolean; effectiveFrom: string }>> {
  const user = await requirePermission("production:plan");
  try {
    const result = await saveQuota(quotaSchema.parse(input), user);
    refresh();
    return { ok: true, saved: result.saved, effectiveFrom: result.effectiveFrom };
  } catch (error) {
    return toActionError(error, "The quota");
  }
}
