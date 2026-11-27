"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { addRollTag, editRollTag, removeRollTag } from "@/server/services/roll-tag.service";
import {
  addRollTagSchema,
  editRollTagSchema,
  isRollTagId,
} from "@/server/validators/roll-tag.validator";

const toResult = (error: unknown) => toActionError(error, "Roll tag action");
const NO_TAG = { ok: false as const, error: "This tag doesn't exist." };

/** Add rolls on every item page lists the tags, so the whole Inventory section refreshes. */
function refresh() {
  revalidatePath("/inventory", "layout");
}

/** Inventory → Roll tags → Add tag (Phase 42, D-139). */
export async function addRollTagAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory:manage");
  try {
    const tag = await addRollTag(addRollTagSchema.parse(input), user);
    refresh();
    return { ok: true, id: tag.id };
  } catch (error) {
    return toResult(error);
  }
}

/** Edit a tag's code (only while no roll was made from it), supplier or default. */
export async function editRollTagAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("inventory:manage");
  if (!isRollTagId(id)) return NO_TAG;
  try {
    await editRollTag(id, editRollTagSchema.parse(input), user);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/** Deactivate a tag (it leaves Add rolls; its rolls keep their codes), or reactivate it. */
export async function setRollTagActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await requirePermission("inventory:manage");
  if (!isRollTagId(id)) return NO_TAG;
  try {
    await editRollTag(id, { isActive }, user);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/** Remove a tag no roll was ever made from. */
export async function removeRollTagAction(id: string): Promise<ActionResult> {
  const user = await requirePermission("inventory:manage");
  if (!isRollTagId(id)) return NO_TAG;
  try {
    await removeRollTag(id, user);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}
