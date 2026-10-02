"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { assignSalvage, discardSalvage, unassignSalvage } from "@/server/services/salvage.service";
import {
  isOutcomeId,
  salvageAssignSchema,
  salvageDiscardSchema,
  salvageUnassignSchema,
} from "@/server/validators/outcome.validator";

function refresh() {
  revalidatePath("/salvage");
  revalidatePath("/batches", "layout");
  revalidatePath("/scans", "layout");
}

async function run<T extends object>(id: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  if (!isOutcomeId(id)) return { ok: false, error: "This salvage record doesn't exist." };
  try {
    const result = await fn();
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return toActionError(error, "Salvage action");
  }
}

export async function assignSalvageAction(
  id: string,
  input: { batchId: string; expectedStatus: string; note?: string },
) {
  const user = await requirePermission("salvage:manage");
  return run(id, () => assignSalvage(id, salvageAssignSchema.parse(input), user));
}

export async function unassignSalvageAction(id: string, input: { expectedStatus: string }) {
  const user = await requirePermission("salvage:manage");
  return run(id, () => unassignSalvage(id, salvageUnassignSchema.parse(input), user));
}

export async function discardSalvageAction(
  id: string,
  input: { reason: string; expectedStatus: string },
) {
  const user = await requirePermission("salvage:manage");
  return run(id, () => discardSalvage(id, salvageDiscardSchema.parse(input), user));
}
