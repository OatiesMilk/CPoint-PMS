"use server";

import { revalidatePath } from "next/cache";
import type { InventoryCategory } from "@/lib/domain";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  createItem,
  recordMovement,
  reverseMovement,
  setItemActive,
  suggestItemCode,
  updateItem,
} from "@/server/services/inventory.service";
import {
  inventoryItemFormSchema,
  isInventoryId,
  movementSchema,
} from "@/server/validators/inventory.validator";

export type { ActionResult };

const toResult = (error: unknown) => toActionError(error, "Inventory action");
const NOT_FOUND = { ok: false as const, error: "This item doesn't exist." };

function refresh(id?: string) {
  revalidatePath("/inventory");
  revalidatePath("/floor-manager");
  revalidatePath("/rolls/new");
  if (id) revalidatePath(`/inventory/${id}`);
}

export async function suggestCodeAction(category: InventoryCategory): Promise<string | null> {
  await requirePermission("inventory:manage");
  try {
    return await suggestItemCode(category);
  } catch {
    return null;
  }
}

export async function createItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory:manage");
  try {
    const item = await createItem(inventoryItemFormSchema.parse(input), user);
    refresh();
    return { ok: true, id: item.id };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateItemAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requirePermission("inventory:manage");
  if (!isInventoryId(id)) return NOT_FOUND;
  try {
    await updateItem(id, inventoryItemFormSchema.parse(input), user);
    refresh(id);
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function setItemActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await requirePermission("inventory:manage");
  if (!isInventoryId(id)) return NOT_FOUND;
  try {
    await setItemActive(id, isActive, user);
    refresh(id);
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function recordMovementAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ movementId: string; message: string; onHandAfter: number }>> {
  const user = await requirePermission("inventory:manage");
  if (!isInventoryId(id)) return NOT_FOUND;
  try {
    const result = await recordMovement(id, movementSchema.parse(input), user);
    refresh(id);
    return {
      ok: true,
      movementId: result.movementId,
      message: result.message,
      onHandAfter: result.onHandAfter,
    };
  } catch (error) {
    return toResult(error);
  }
}

export async function undoMovementAction(
  itemId: string,
  movementId: string,
): Promise<ActionResult> {
  const user = await requirePermission("inventory:manage");
  if (!isInventoryId(itemId) || !isInventoryId(movementId)) return NOT_FOUND;
  try {
    await reverseMovement(movementId, user);
    refresh(itemId);
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}
