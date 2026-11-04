"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  clearNonWorking,
  correctCheckIn,
  markNonWorking,
  saveCheckIn,
  saveDayPlan,
} from "@/server/services/production.service";
import {
  checkInSchema,
  correctionSchema,
  dayMarkSchema,
  dayPlanSchema,
  planDaySchema,
} from "@/server/validators/production.validator";
import { z } from "zod";

function refresh() {
  revalidatePath("/batches");
  revalidatePath("/batches/plan");
  revalidatePath("/floor-manager");
  revalidatePath("/reports");
}

/** A day plan changes the notice on every page (the banner and the bell, A-37). */
function refreshAll() {
  revalidatePath("/", "layout");
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

type PlanResult = ActionResult<{ saved: boolean; day: string }>;

const NO_DAY = "This day doesn't exist. Refresh the page.";

/** Plan a day on the calendar (D-114). */
export async function saveDayPlanAction(day: string, input: unknown): Promise<PlanResult> {
  const user = await requirePermission("production:plan");
  if (!planDaySchema.safeParse(day).success) return { ok: false, error: NO_DAY };
  try {
    const result = await saveDayPlan(day, dayPlanSchema.parse(input), user);
    refreshAll();
    return { ok: true, saved: result.saved, day: result.day };
  } catch (error) {
    return toActionError(error, "The plan");
  }
}

/** Mark a weekday Non-working / Holiday, or undo the mark (D-114). */
export async function markDayAction(
  day: string,
  nonWorking: boolean,
  input: unknown,
): Promise<PlanResult> {
  const user = await requirePermission("production:plan");
  if (!planDaySchema.safeParse(day).success) return { ok: false, error: NO_DAY };
  try {
    const mark = dayMarkSchema.parse(input);
    const result = nonWorking
      ? await markNonWorking(day, mark, user)
      : await clearNonWorking(day, mark, user);
    refreshAll();
    return { ok: true, saved: result.saved, day: result.day };
  } catch (error) {
    return toActionError(error, nonWorking ? "The Non-working mark" : "Undoing the mark");
  }
}
