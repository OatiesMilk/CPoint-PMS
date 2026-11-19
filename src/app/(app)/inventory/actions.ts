"use server";

import { revalidatePath } from "next/cache";
import type { InventoryCategory } from "@/lib/domain";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  createItem,
  setItemActive,
  suggestItemCode,
  updateItem,
} from "@/server/services/inventory.service";
import { addRolls } from "@/server/services/roll.service";
import { saveReminderDays, saveStockUpdate } from "@/server/services/stock-update.service";
import { addRollsSchema } from "@/server/validators/roll.validator";
import {
  inventoryItemFormSchema,
  inventorySettingsSchema,
  isInventoryId,
  stockUpdateSchema,
} from "@/server/validators/inventory.validator";

export type { ActionResult };

const toResult = (error: unknown) => toActionError(error, "Inventory action");
const NOT_FOUND = { ok: false as const, error: "This item doesn't exist." };

function refresh(id?: string) {
  revalidatePath("/inventory");
  revalidatePath("/floor-manager");
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

/** The Update stock sheet (Phase 29, D-102). Also refreshes the bell and the FM home. */
export async function saveStockUpdateAction(
  input: unknown,
): Promise<ActionResult<{ items: number }>> {
  const user = await requirePermission("inventory:manage");
  try {
    const result = await saveStockUpdate(stockUpdateSchema.parse(input), user);
    revalidatePath("/", "layout");
    return { ok: true, items: result.items };
  } catch (error) {
    return toResult(error);
  }
}

export async function saveReminderDaysAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission("inventory:manage");
  try {
    const { reminderDays } = inventorySettingsSchema.parse(input);
    await saveReminderDays(reminderDays, user);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/** Add rolls to a leather item, each with its own area (Phase 30A, D-103). */
export async function addRollsAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ codes: string[]; ids: string[] }>> {
  const user = await requirePermission("inventory:manage");
  if (!isInventoryId(id)) return NOT_FOUND;
  try {
    const result = await addRolls(id, addRollsSchema.parse(input), user);
    refresh(id);
    revalidatePath("/reports/rolls");
    return {
      ok: true,
      codes: result.added.map((r) => r.code),
      ids: result.added.map((r) => r.id),
    };
  } catch (error) {
    return toResult(error);
  }
}
