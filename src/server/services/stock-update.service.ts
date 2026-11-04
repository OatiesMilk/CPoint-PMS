import { manilaToday } from "@/lib/format";
import { planStockLine, stockLevel } from "@/lib/inventory-rules";
import { DEFAULT_REMINDER_DAYS, stockUpdateDue } from "@/lib/stock-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import { findDayPlan } from "@/server/models/production.model";
import {
  findItemsForUpdate,
  getInventorySettings,
  insertStockUpdate,
  lastUpdatedAt,
  listRecentUpdates,
  listSheetItems,
  saveInventorySettings,
  stockUpdateSavedOn,
} from "@/server/models/stock-update.model";
import type { StockUpdateBody } from "@/server/validators/inventory.validator";
import { recordAudit } from "./audit.service";
import { postMovement } from "./inventory.service";

/*
 * The Update stock sheet (Phase 29, D-102, C-16, C-32). The Floor Manager records per item what
 * was added, what was used and any correction for a miscount, on any day, in one save. Each is a
 * ledger movement (D-023: IN, OUT, ADJUST) that applies only to the stock the sheet saw; the save
 * is one transaction with one audit row. A save on a reminder day (Wednesday and Friday by
 * default) clears the reminder.
 */

type Actor = { id: string };

export async function reminderDays(): Promise<number[]> {
  return (await getInventorySettings())?.reminderDays ?? DEFAULT_REMINDER_DAYS;
}

/** Everything the sheet shows: the active items with their last update, and the reminder days. */
export async function stockSheet(now = new Date()) {
  const rows = await listSheetItems();
  const [last, days, recent, savedToday] = await Promise.all([
    lastUpdatedAt(rows.map((r) => r.id)),
    reminderDays(),
    listRecentUpdates(5),
    stockUpdateSavedOn(manilaToday(now)),
  ]);
  return {
    items: rows.map((r) => {
      const quantityOnHand = Number(r.quantityOnHand);
      const reorderLevel = Number(r.reorderLevel);
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        unit: r.unit,
        supplier: r.supplier?.name ?? null,
        quantityOnHand,
        level: stockLevel(quantityOnHand, reorderLevel),
        lastUpdatedAt: last.get(r.id)?.toISOString() ?? null,
      };
    }),
    reminderDays: days,
    due: stockUpdateDue(manilaToday(now), days, savedToday),
    recent: recent.map((u) => ({
      id: u.id,
      createdAt: u.createdAt.toISOString(),
      by: u.createdBy.name,
      items: u.items,
      note: u.note,
    })),
  };
}

/** For the FM home and the bell: is today a reminder day with no update saved yet? */
export async function stockUpdateReminder(now = new Date()) {
  const today = manilaToday(now);
  const [days, savedToday, plan] = await Promise.all([
    reminderDays(),
    stockUpdateSavedOn(today),
    findDayPlan(today),
  ]);
  // A day marked Non-working / Holiday has no reminder (D-114, A-41).
  const nonWorking = plan?.kind === "NON_WORKING";
  return { due: !nonWorking && stockUpdateDue(today, days, savedToday), reminderDays: days };
}

/** When each item was last on a saved sheet (the Inventory list's Last updated). */
export function lastUpdatedFor(itemIds: string[]) {
  return lastUpdatedAt(itemIds);
}

export async function recentStockUpdates(take = 10) {
  return listRecentUpdates(take);
}

/**
 * Saves the sheet. Every line is checked first against the stock as it is now: a line whose item
 * changed since the sheet loaded is STALE (named), and the others' problems come back under their
 * own fields (`lines.<itemId>.added`, `.used`, `.correction` or `.reason`). Nothing is saved
 * unless every line is fine.
 */
export async function saveStockUpdate(body: StockUpdateBody, actor: Actor, now = new Date()) {
  return runInTransaction(async (tx) => {
    const items = new Map(
      (
        await findItemsForUpdate(
          body.lines.map((l) => l.itemId),
          tx,
        )
      ).map((i) => [i.id, { ...i, quantityOnHand: Number(i.quantityOnHand) }]),
    );
    const issues: { path: string[]; message: string }[] = [];
    const planned = [];
    for (const line of body.lines) {
      const item = items.get(line.itemId);
      if (!item)
        throw Errors.stale("An item on the sheet was removed. Refresh the page and try again.");
      // A leather item's count follows its rolls (Phase 30A, D-104), never the sheet.
      if (item.category === "LEATHER_ROLL") {
        issues.push({
          path: ["lines", line.itemId, "added"],
          message: `${item.name} is counted from its rolls. Add or remove rolls on the item instead.`,
        });
        continue;
      }
      const plan = planStockLine(item, line);
      if (!plan.ok) {
        if (plan.code === "STALE") throw Errors.stale(plan.reason);
        issues.push({ path: ["lines", line.itemId, plan.field ?? "added"], message: plan.reason });
        continue;
      }
      planned.push({ item, plan });
    }
    if (issues.length > 0) throw Errors.validation(issues);

    const today = manilaToday(now);
    const update = await insertStockUpdate(
      { day: today, createdById: actor.id, note: body.note ?? null, createdAt: now },
      tx,
    );
    const entries = [];
    for (const { item, plan } of planned) {
      let onHand = item.quantityOnHand;
      for (const entry of plan.entries) {
        const result = await postMovement(
          tx,
          { ...item, quantityOnHand: onHand },
          { ...entry, updateId: update.id },
          actor,
          now,
        );
        onHand = result.onHandAfter;
      }
      entries.push({
        item: `${item.sku} · ${item.name}`,
        added: plan.entries.find((e) => e.type === "IN")?.delta ?? 0,
        used: -(plan.entries.find((e) => e.type === "OUT")?.delta ?? 0),
        correction: plan.entries.find((e) => e.type === "ADJUST")?.delta ?? 0,
        quantityOnHand: onHand,
      });
    }
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "inventory.update",
      entity: "StockUpdate",
      entityId: update.id,
      after: { day: today, items: entries.length, entries, note: body.note ?? null },
    });
    return { id: update.id, items: entries.length };
  });
}

export async function saveReminderDays(days: number[], actor: Actor) {
  const before = await reminderDays();
  return runInTransaction(async (tx) => {
    const saved = await saveInventorySettings({ reminderDays: days, updatedById: actor.id }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "inventory.settings.update",
      entity: "InventorySettings",
      entityId: "1",
      before: { reminderDays: before },
      after: { reminderDays: saved.reminderDays },
    });
    return saved;
  });
}
