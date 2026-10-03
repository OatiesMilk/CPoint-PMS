import type { InventoryCategory, MovementType, Prisma } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

// Inventory is a ledger (D-023): quantityOnHand changes only together with an inventory_movements
// row, through applyStockDelta's conditional update. Nothing here deletes a movement.

const itemSelect = {
  id: true,
  sku: true,
  name: true,
  category: true,
  unit: true,
  quantityOnHand: true,
  reorderLevel: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InventoryItemSelect;

export type InventoryItemRow = Prisma.InventoryItemGetPayload<{ select: typeof itemSelect }>;

export type InventoryListFilter = {
  category?: InventoryCategory;
  stock?: "low" | "out";
  q?: string;
  includeInactive?: boolean;
};

function listWhere(filter: InventoryListFilter, db: Db): Prisma.InventoryItemWhereInput {
  return {
    ...(filter.includeInactive ? {} : { isActive: true }),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.stock === "low"
      ? { quantityOnHand: { lte: db.inventoryItem.fields.reorderLevel } }
      : filter.stock === "out"
        ? { quantityOnHand: { lte: 0 } }
        : {}),
    ...(filter.q
      ? {
          OR: [
            { sku: { contains: filter.q, mode: "insensitive" } },
            { name: { contains: filter.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listInventoryItems(
  filter: InventoryListFilter,
  page: { skip: number; take: number },
  db: Db = defaultDb(),
) {
  const where = listWhere(filter, db);
  const [rows, total] = await Promise.all([
    db.inventoryItem.findMany({
      where,
      select: itemSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      ...page,
    }),
    db.inventoryItem.count({ where }),
  ]);
  return { rows, total };
}

export function findInventoryItem(id: string, db: Db = defaultDb()) {
  return db.inventoryItem.findUnique({ where: { id }, select: itemSelect });
}

export function findInventoryItemBySku(sku: string, db: Db = defaultDb()) {
  return db.inventoryItem.findFirst({
    where: { sku: { equals: sku, mode: "insensitive" } },
    select: { id: true },
  });
}

/** Codes starting with `prefix-`, for suggesting the next one. */
export async function listItemCodes(prefix: string, db: Db = defaultDb()): Promise<string[]> {
  const rows = await db.inventoryItem.findMany({
    where: { sku: { startsWith: `${prefix}-`, mode: "insensitive" } },
    select: { sku: true },
  });
  return rows.map((r) => r.sku);
}

type ItemColumns = {
  sku: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  reorderLevel: number;
};

export function insertInventoryItem(data: ItemColumns, db: Db = defaultDb()) {
  return db.inventoryItem.create({ data, select: itemSelect });
}

export function updateInventoryItem(
  id: string,
  data: Partial<ItemColumns> & { isActive?: boolean },
  db: Db = defaultDb(),
) {
  return db.inventoryItem.update({ where: { id }, data, select: itemSelect });
}

/**
 * Adds `delta` to the stock in one conditional UPDATE. `min` refuses it unless at least that much
 * is on hand (no negative stock); `expected` refuses it unless the stock is exactly what the
 * caller saw (stock counts). Returns false when the condition didn't hold.
 */
export async function applyStockDelta(
  id: string,
  delta: number,
  guard: { min?: number; expected?: number },
  db: Db,
): Promise<boolean> {
  const quantity: Prisma.DecimalFilter<"InventoryItem"> = {};
  if (guard.min !== undefined) quantity.gte = guard.min;
  if (guard.expected !== undefined) quantity.equals = guard.expected;
  const { count } = await db.inventoryItem.updateMany({
    where: {
      id,
      isActive: true,
      ...(Object.keys(quantity).length ? { quantityOnHand: quantity } : {}),
    },
    data: { quantityOnHand: { increment: delta } },
  });
  return count === 1;
}

export function insertMovement(
  data: {
    itemId: string;
    type: MovementType;
    quantityDelta: number;
    reason: string;
    batchId?: string | null;
    createdById: string;
    createdAt?: Date;
  },
  db: Db,
) {
  return db.inventoryMovement.create({ data });
}

const movementSelect = {
  id: true,
  itemId: true,
  type: true,
  quantityDelta: true,
  reason: true,
  createdAt: true,
  batch: { select: { id: true, code: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.InventoryMovementSelect;

export type MovementRow = Prisma.InventoryMovementGetPayload<{ select: typeof movementSelect }>;

const newestFirst: Prisma.InventoryMovementOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

export async function listMovements(
  itemId: string,
  page: { skip: number; take: number },
  db: Db = defaultDb(),
) {
  const [rows, total] = await Promise.all([
    db.inventoryMovement.findMany({
      where: { itemId },
      select: movementSelect,
      orderBy: newestFirst,
      ...page,
    }),
    db.inventoryMovement.count({ where: { itemId } }),
  ]);
  return { rows, total };
}

/** Sum of the movements recorded after `row`, so a page of history can show each balance. */
export async function sumNewerDeltas(
  itemId: string,
  row: { id: string; createdAt: Date },
  db: Db = defaultDb(),
): Promise<number> {
  const { _sum } = await db.inventoryMovement.aggregate({
    where: {
      itemId,
      OR: [{ createdAt: { gt: row.createdAt } }, { createdAt: row.createdAt, id: { gt: row.id } }],
    },
    _sum: { quantityDelta: true },
  });
  return Number(_sum.quantityDelta ?? 0);
}

export function findMovement(id: string, db: Db = defaultDb()) {
  return db.inventoryMovement.findUnique({
    where: { id },
    select: { ...movementSelect, item: { select: itemSelect } },
  });
}

/** A later movement that already undid this one (same item, the "Undo:" note, opposite delta). */
export function findReversal(
  movement: { id: string; itemId: string; createdAt: Date; reason: string; quantityDelta: number },
  db: Db = defaultDb(),
) {
  return db.inventoryMovement.findFirst({
    where: {
      itemId: movement.itemId,
      createdAt: { gte: movement.createdAt },
      id: { not: movement.id },
      reason: `Undo: ${movement.reason}`,
      quantityDelta: -movement.quantityDelta,
    },
    select: { id: true },
  });
}

/** Active items at or below their reorder level, emptiest first. */
export async function lowStockItems(take: number, db: Db = defaultDb()) {
  const where: Prisma.InventoryItemWhereInput = {
    isActive: true,
    quantityOnHand: { lte: db.inventoryItem.fields.reorderLevel },
  };
  const [rows, count] = await Promise.all([
    db.inventoryItem.findMany({
      where,
      select: itemSelect,
      orderBy: [{ quantityOnHand: "asc" }, { name: "asc" }],
      take,
    }),
    db.inventoryItem.count({ where }),
  ]);
  return { rows, count };
}

/** Active leather-roll items with at least one roll on hand (the batch form's picker). */
export function listRollItemsInStock(db: Db = defaultDb()) {
  return db.inventoryItem.findMany({
    where: { category: "LEATHER_ROLL", isActive: true, quantityOnHand: { gte: 1 } },
    select: { id: true, sku: true, name: true, unit: true, quantityOnHand: true },
    orderBy: { name: "asc" },
  });
}

/** Leather-roll movements linked to a batch: what was taken for it, and anything returned. */
export function listRollMovementsForBatch(batchId: string, db: Db = defaultDb()) {
  return db.inventoryMovement.findMany({
    where: { batchId, item: { category: "LEATHER_ROLL" } },
    select: {
      id: true,
      type: true,
      quantityDelta: true,
      item: { select: { id: true, sku: true, name: true, unit: true } },
    },
    orderBy: newestFirst,
  });
}
