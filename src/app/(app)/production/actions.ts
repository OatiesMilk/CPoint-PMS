"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  correctCheckIn,
  saveCheckIn,
  saveQuotas,
  saveSchedule,
} from "@/server/services/production.service";
import {
  checkInSchema,
  correctionSchema,
  quotasSchema,
  scheduleSchema,
} from "@/server/validators/production.validator";
import { z } from "zod";

function refresh() {
  revalidatePath("/production");
  revalidatePath("/production/plan");
  revalidatePath("/floor-manager");
  revalidatePath("/quality-inspector");
  revalidatePath("/reports");
}

/** The QI's count at a check-in (D-084, Dylan 3B). */
export async function saveCheckInAction(input: unknown): Promise<ActionResult<{ time: string }>> {
  const user = await requirePermission("production:checkin");
  try {
    const result = await saveCheckIn(checkInSchema.parse(input), user);
    refresh();
    return { ok: true, time: result.time };
  } catch (error) {
    return toActionError(error, "The check-in");
  }
}

/** A same-day correction with a reason. */
export async function correctCheckInAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ time: string }>> {
  const user = await requirePermission("production:checkin");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "This check-in doesn't exist." };
  try {
    const result = await correctCheckIn(id, correctionSchema.parse(input), user);
    refresh();
    return { ok: true, time: result.time };
  } catch (error) {
    return toActionError(error, "The correction");
  }
}

export async function saveScheduleAction(
  input: unknown,
): Promise<ActionResult<{ effectiveFrom: string }>> {
  const user = await requirePermission("production:plan");
  try {
    const result = await saveSchedule(scheduleSchema.parse(input), user);
    refresh();
    return { ok: true, effectiveFrom: result.effectiveFrom };
  } catch (error) {
    return toActionError(error, "The schedule");
  }
}

export async function saveQuotasAction(input: unknown): Promise<ActionResult<{ saved: number }>> {
  const user = await requirePermission("production:plan");
  try {
    const result = await saveQuotas(quotasSchema.parse(input), user);
    refresh();
    return { ok: true, saved: result.saved };
  } catch (error) {
    return toActionError(error, "The quotas");
  }
}
