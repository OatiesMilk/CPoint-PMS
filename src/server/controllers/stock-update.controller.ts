import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  recentStockUpdates,
  reminderDays,
  saveReminderDays,
  saveStockUpdate,
} from "@/server/services/stock-update.service";
import {
  inventorySettingsSchema,
  stockUpdateSchema,
} from "@/server/validators/inventory.validator";

export const stockUpdateController = {
  /** GET /api/v1/inventory/updates: the latest Update stock saves, newest first. */
  index: handle(async () => {
    await requireApiPermission("inventory:read");
    const rows = await recentStockUpdates(15);
    return json({
      data: rows.map((u) => ({
        id: u.id,
        createdAt: u.createdAt.toISOString(),
        by: u.createdBy.name,
        items: u.items,
        note: u.note,
      })),
    });
  }),

  /** POST /api/v1/inventory/updates  { lines: [{ itemId, seenQuantity, added?, used?, correction?, reason? }], note? } */
  create: handle(async (request: Request) => {
    const user = await requireApiPermission("inventory:manage");
    const body = stockUpdateSchema.parse(await readJsonBody(request));
    return json({ data: await saveStockUpdate(body, user) }, 201);
  }),

  /** GET /api/v1/inventory/settings: the reminder days (ISO weekdays). */
  settings: handle(async () => {
    await requireApiPermission("inventory:read");
    return json({ data: { reminderDays: await reminderDays() } });
  }),

  /** PUT /api/v1/inventory/settings  { reminderDays: [3, 5] } */
  saveSettings: handle(async (request: Request) => {
    const user = await requireApiPermission("inventory:manage");
    const { reminderDays: days } = inventorySettingsSchema.parse(await readJsonBody(request));
    return json({ data: await saveReminderDays(days, user) });
  }),
};
