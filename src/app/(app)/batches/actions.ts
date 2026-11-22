"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import {
  correctRepairInspection,
  inspectRepair,
  setBatchPriority,
  startInspection,
  voidBatch,
} from "@/server/services/batch-queue.service";
import { changeRepair, markRepairBack } from "@/server/services/repair.service";
import { saveStageAssignments, saveStageCount } from "@/server/services/stage.service";
import {
  repairActionSchema,
  repairCorrectionSchema,
  repairInspectSchema,
  stageAssignmentsSchema,
  stageCountSchema,
} from "@/server/validators/repair.validator";
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
  prioritySchema,
  startInspectionSchema,
  voidBatchSchema,
} from "@/server/validators/production.validator";
import { z } from "zod";

function refresh() {
  revalidatePath("/batches");
  revalidatePath("/camera/capture");
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
): Promise<ActionResult<{ number: number; code: string; time: string }>> {
  const user = await requirePermission("production:checkin");
  try {
    const result = await saveCheckIn(checkInSchema.parse(input), user);
    refresh();
    return { ok: true, number: result.number, code: result.code, time: result.time };
  } catch (error) {
    return toActionError(error, "Finishing the batch");
  }
}

const NO_BATCH = "This batch doesn't exist. Refresh the page.";

/** Start inspection (Phase 33, A-60): so another inspector takes a different batch. */
export async function startInspectionAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  const user = await requirePermission("production:checkin");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: NO_BATCH };
  try {
    const result = await startInspection(id, startInspectionSchema.parse(input), user);
    refresh();
    return { ok: true, code: result.code };
  } catch (error) {
    return toActionError(error, "Starting the inspection");
  }
}

/** Urgent with a reason, or back to Normal (Phase 33, A-58). */
export async function batchPriorityAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  const user = await requirePermission("production:prioritise");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: NO_BATCH };
  try {
    const result = await setBatchPriority(id, prioritySchema.parse(input), user);
    refresh();
    return { ok: true, code: result.code };
  } catch (error) {
    return toActionError(error, "The priority");
  }
}

/** Void a batch that won't be inspected, with a reason (Phase 33, A-59). */
export async function voidBatchAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  const user = await requirePermission("production:prioritise");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: NO_BATCH };
  try {
    const result = await voidBatch(id, voidBatchSchema.parse(input), user);
    refresh();
    return { ok: true, code: result.code };
  } catch (error) {
    return toActionError(error, "Voiding the batch");
  }
}

/** A correction with a reason: the day the batch was inspected, or any past day for the Floor Manager. */
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

// ───────────── repairs, stages and counts (Phase 34, D-130) ─────────────

const NO_REPAIR = "This repair doesn't exist. Refresh the page.";

/** Back for inspection (the stage's constructor or the Floor Manager), or the Floor Manager's change. */
export async function repairAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  const user = await requirePermission("repair:update");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: NO_REPAIR };
  try {
    const parsed = repairActionSchema.parse(input);
    if (parsed.action === "back") {
      const result = await markRepairBack(id, user);
      refresh();
      return { ok: true, code: result.code };
    }
    await requirePermission("repair:manage");
    const result = await changeRepair(id, parsed, user);
    refresh();
    return { ok: true, code: result.code };
  } catch (error) {
    return toActionError(error, "The repair");
  }
}

/** Inspect a repair that is back: passed, scrapped and sent back again. */
export async function inspectRepairAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ code: string; children: { code: string }[] }>> {
  const user = await requirePermission("production:checkin");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: NO_REPAIR };
  try {
    const result = await inspectRepair(id, repairInspectSchema.parse(input), user);
    refresh();
    return { ok: true, code: result.code, children: result.children };
  } catch (error) {
    return toActionError(error, "The repair inspection");
  }
}

/** The Floor Manager corrects a repair's inspection, with a reason (Phase 35B, A-105). */
export async function correctRepairInspectionAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ code: string; children: { code: string }[] }>> {
  const user = await requirePermission("repair:manage");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: NO_REPAIR };
  try {
    const result = await correctRepairInspection(id, repairCorrectionSchema.parse(input), user);
    refresh();
    return { ok: true, code: result.code, children: result.children.map((code) => ({ code })) };
  } catch (error) {
    return toActionError(error, "The correction");
  }
}

/** Who works at each stage on a day (Plan dialog, Floor Manager). */
export async function saveStageAssignmentsAction(
  day: string,
  input: unknown,
): Promise<ActionResult<{ day: string }>> {
  const user = await requirePermission("stage:assign");
  if (!planDaySchema.safeParse(day).success) return { ok: false, error: NO_DAY };
  try {
    const result = await saveStageAssignments(day, stageAssignmentsSchema.parse(input), user);
    refresh();
    return { ok: true, day: result.day };
  } catch (error) {
    return toActionError(error, "Who works where");
  }
}

/** The pairs at a stage now, for today (My stage on Capture, or the Floor Manager's board). */
export async function saveStageCountAction(
  input: unknown,
): Promise<ActionResult<{ stage: string; pairs: number }>> {
  const user = await requirePermission("stage:count");
  try {
    const parsed = stageCountSchema.parse(input);
    const result = await saveStageCount({ stage: parsed.stage, pairs: parsed.pairs }, user);
    refresh();
    return { ok: true, stage: result.stage, pairs: result.pairs };
  } catch (error) {
    return toActionError(error, "The count");
  }
}
