"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { addLocation, editLocation } from "@/server/services/location.service";
import { markPickedUp, moveRolls, setAsideRoll } from "@/server/services/roll.service";
import {
  addLocationSchema,
  editLocationSchema,
  isLocationId,
  moveRollsSchema,
  setAsideSchema,
} from "@/server/validators/location.validator";
import { isRollId } from "@/server/validators/roll.validator";

const toResult = (error: unknown) => toActionError(error, "Storage location action");
const NO_LOCATION = { ok: false as const, error: "This location doesn't exist." };
const NO_ROLL = { ok: false as const, error: "This roll doesn't exist." };

/** Inventory, a roll's page and Find roll all show where rolls are, so all of them refresh. */
function refresh() {
  revalidatePath("/inventory", "layout");
  revalidatePath("/reports/rolls", "layout");
  revalidatePath("/find");
}

/** Inventory → Storage locations → Add location (Phase 32, D-128). */
export async function addLocationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("location:manage");
  try {
    const location = await addLocation(addLocationSchema.parse(input), user);
    refresh();
    return { ok: true, id: location.id };
  } catch (error) {
    return toResult(error);
  }
}

/** Edit a location's code (only while never used), name, kind or notes. */
export async function editLocationAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("location:manage");
  if (!isLocationId(id)) return NO_LOCATION;
  try {
    await editLocation(id, editLocationSchema.parse(input), user);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/** Deactivate an empty location, or reactivate one. */
export async function setLocationActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const user = await requirePermission("location:manage");
  if (!isLocationId(id)) return NO_LOCATION;
  try {
    await editLocation(id, { isActive }, user);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/** The Floor Manager places or moves rolls (A-56). */
export async function moveRollsAction(
  input: unknown,
): Promise<ActionResult<{ moved: number; to: string }>> {
  const user = await requirePermission("roll:move");
  try {
    const { moved } = await moveRolls(moveRollsSchema.parse(input), user);
    refresh();
    return { ok: true, moved: moved.length, to: moved[0]?.to ?? "" };
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Set a Returned to supplier roll aside for the supplier (A-77), from the roll's page. Takes the
 * Move dialog's input ({ toLocationId }) and answers like a move, so the same dialog serves.
 */
export async function setAsideAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ moved: number; to: string }>> {
  const user = await requirePermission("roll:move");
  if (!isRollId(id)) return NO_ROLL;
  try {
    const raw = (input ?? {}) as { toLocationId?: unknown };
    const { locationId } = setAsideSchema.parse({ locationId: raw.toLocationId });
    const result = await setAsideRoll(id, locationId, user);
    refresh();
    return { ok: true, moved: 1, to: result.location.code };
  } catch (error) {
    return toResult(error);
  }
}

/** The supplier took a Returned to supplier roll (A-77). */
export async function pickedUpAction(id: string): Promise<ActionResult> {
  const user = await requirePermission("roll:manage");
  if (!isRollId(id)) return NO_ROLL;
  try {
    await markPickedUp(id, user);
    refresh();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}
