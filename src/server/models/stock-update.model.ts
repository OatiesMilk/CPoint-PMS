import { type Db, defaultDb } from "./db";

// Stock updates (Phase 29, D-102): one row per save of the Update stock sheet, and the single
// settings row with the reminder days. The entries themselves are ledger movements (D-023).

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Every active item for the sheet, by category then name. */
export function listSheetItems(db: Db = defaultDb()) {
  return db.inventoryItem.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      unit: true,
      quantityOnHand: true,
      reorderLevel: true,
      isActive: true,
      supplier: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/** The items a save names, fresh, inside the save's transaction. */
export function findItemsForUpdate(ids: string[], db: Db) {
  return db.inventoryItem.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      quantityOnHand: true,
      isActive: true,
      category: true,
    },
  });
}

export function insertStockUpdate(
  data: { day: string; createdById: string; note: string | null; createdAt: Date },
  db: Db,
) {
  return db.stockUpdate.create({
    data: { ...data, day: dayDate(data.day) },
    select: { id: true },
  });
}

export async function stockUpdateSavedOn(day: string, db: Db = defaultDb()): Promise<boolean> {
  return (await db.stockUpdate.count({ where: { day: dayDate(day) } })) > 0;
}

/** When each item was last on a saved Update stock sheet. */
export async function lastUpdatedAt(
  itemIds: string[],
  db: Db = defaultDb(),
): Promise<Map<string, Date>> {
  if (itemIds.length === 0) return new Map();
  const rows = await db.inventoryMovement.groupBy({
    by: ["itemId"],
    where: { itemId: { in: itemIds }, updateId: { not: null } },
    _max: { createdAt: true },
  });
  return new Map(
    rows.flatMap((r) => (r._max.createdAt ? [[r.itemId, r._max.createdAt] as const] : [])),
  );
}

/** The latest saves, newest first, with how many items each changed. Never totalled per person. */
export async function listRecentUpdates(take: number, db: Db = defaultDb()) {
  const rows = await db.stockUpdate.findMany({
    select: {
      id: true,
      day: true,
      note: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      movements: { select: { itemId: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
  // One item can have up to three movements (added, used, correction): count items, not rows.
  return rows.map(({ movements, ...r }) => ({
    ...r,
    items: new Set(movements.map((m) => m.itemId)).size,
  }));
}

export async function getInventorySettings(db: Db = defaultDb()) {
  return db.inventorySettings.findUnique({
    where: { id: 1 },
    select: { reminderDays: true, updatedAt: true },
  });
}

export function ensureInventorySettings(db: Db = defaultDb()) {
  return db.inventorySettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export function saveInventorySettings(
  data: { reminderDays: number[]; updatedById: string | null },
  db: Db,
) {
  return db.inventorySettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
    select: { reminderDays: true },
  });
}

export type SheetItemRow = Awaited<ReturnType<typeof listSheetItems>>[number];
