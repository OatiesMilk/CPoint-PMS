import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE } from "@/lib/pagination";
import type { InventoryCategory, MovementType } from "@/lib/domain";
import {
  CATEGORY_PREFIX,
  nextItemCode,
  notEnoughStock,
  staleLine,
  stockLevel,
  type StockLevel,
} from "@/lib/inventory-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import { findSupplier } from "@/server/models/reference-data.model";
import { lastUpdatedAt } from "@/server/models/stock-update.model";
import {
  applyStockDelta,
  findInventoryItem,
  findInventoryItemBySku,
  insertInventoryItem,
  insertMovement,
  listInventoryItems,
  listItemCodes,
  listMovements,
  lowStockItems,
  sumNewerDeltas,
  updateInventoryItem,
  type InventoryItemRow,
  type InventoryListFilter,
  type MovementRow,
} from "@/server/models/inventory.model";
import type {
  InventoryItemFormValues,
  InventoryListQuery,
} from "@/server/validators/inventory.validator";
import { recordAudit } from "./audit.service";

export const INVENTORY_PAGE_SIZE = PAGE_SIZE;
export const MOVEMENT_PAGE_SIZE = PAGE_SIZE;

type Actor = { id: string };
type Tx = Prisma.TransactionClient;

export type InventoryItem = Omit<InventoryItemRow, "quantityOnHand" | "reorderLevel"> & {
  quantityOnHand: number;
  reorderLevel: number;
  level: StockLevel;
};

function toItem(row: InventoryItemRow): InventoryItem {
  const quantityOnHand = Number(row.quantityOnHand);
  const reorderLevel = Number(row.reorderLevel);
  return { ...row, quantityOnHand, reorderLevel, level: stockLevel(quantityOnHand, reorderLevel) };
}

// ───────────── reads ─────────────

export async function listItems(query: InventoryListQuery) {
  const page = query.page ?? 1;
  const filter: InventoryListFilter = {
    category: query.category,
    stock: query.stock,
    q: query.q,
    includeInactive: query.inactive === "1",
  };
  const { rows, total } = await listInventoryItems(filter, {
    skip: (page - 1) * INVENTORY_PAGE_SIZE,
    take: INVENTORY_PAGE_SIZE,
  });
  const last = await lastUpdatedAt(rows.map((r) => r.id));
  return {
    rows: rows.map((r) => ({ ...toItem(r), lastUpdatedAt: last.get(r.id)?.toISOString() ?? null })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)),
  };
}

export type MovementEntry = Omit<MovementRow, "quantityDelta" | "createdAt"> & {
  quantityDelta: number;
  createdAt: string;
  balanceAfter: number;
};

export async function getItemDetail(id: string, page = 1) {
  const row = await findInventoryItem(id);
  if (!row) return null;
  const item = toItem(row);
  const { rows, total } = await listMovements(id, {
    skip: (page - 1) * MOVEMENT_PAGE_SIZE,
    take: MOVEMENT_PAGE_SIZE,
  });
  // Walk back from today's stock: the first row's balance is the stock minus anything newer.
  let balance = rows[0] ? item.quantityOnHand - (await sumNewerDeltas(id, rows[0])) : 0;
  const movements: MovementEntry[] = rows.map((m) => {
    const delta = Number(m.quantityDelta);
    const entry = {
      ...m,
      quantityDelta: delta,
      createdAt: m.createdAt.toISOString(),
      balanceAfter: balance,
    };
    balance = Math.round((balance - delta) * 100) / 100;
    return entry;
  });
  return {
    item,
    movements,
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / MOVEMENT_PAGE_SIZE)),
  };
}

export async function suggestItemCode(category: InventoryCategory): Promise<string> {
  const prefix = CATEGORY_PREFIX[category];
  return nextItemCode(prefix, await listItemCodes(prefix));
}

/** Low-stock alert for the Floor Manager home. */
export async function lowStockSummary(take = 5) {
  const { rows, count } = await lowStockItems(take);
  return { count, items: rows.map(toItem) };
}

// ───────────── item writes ─────────────

async function assertCodeFree(sku: string, exceptId?: string) {
  const existing = await findInventoryItemBySku(sku);
  if (existing && existing.id !== exceptId) {
    throw Errors.validation([
      { path: ["sku"], message: `${sku} is already used by another item. Choose another code.` },
    ]);
  }
}

/** A unique-constraint race on the code becomes the same field error as the pre-check. */
function codeTaken(error: unknown, sku: string): never {
  if ((error as { code?: string })?.code === "P2002") {
    throw Errors.validation([
      { path: ["sku"], message: `${sku} is already used by another item. Choose another code.` },
    ]);
  }
  throw error;
}

/** A leather roll names an active supplier from Settings → Suppliers (Phase 29, D-102). */
async function assertSupplier(supplierId: string | null) {
  if (!supplierId) return;
  const supplier = await findSupplier(supplierId);
  if (!supplier || !supplier.isActive) {
    throw Errors.validation([
      {
        path: ["supplierId"],
        message: "This supplier is no longer active. Choose another supplier.",
      },
    ]);
  }
}

export async function createItem(
  values: Omit<InventoryItemFormValues, "supplierId"> & { supplierId?: string | null },
  actor: Actor,
  now = new Date(),
) {
  await assertCodeFree(values.sku);
  await assertSupplier(values.supplierId ?? null);
  const { openingStock, ...rest } = values;
  const columns = { ...rest, supplierId: rest.supplierId ?? null };
  return runInTransaction(async (tx) => {
    const row = await insertInventoryItem(columns, tx).catch((e) => codeTaken(e, values.sku));
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "inventory.item.create",
      entity: "InventoryItem",
      entityId: row.id,
      after: { ...toItem(row), openingStock: openingStock ?? 0 },
    });
    if (openingStock && openingStock > 0) {
      await postMovement(
        tx,
        toItem(row),
        { type: "IN", delta: openingStock, reason: "Opening stock" },
        actor,
        now,
      );
    }
    return row;
  });
}

export async function updateItem(id: string, values: InventoryItemFormValues, actor: Actor) {
  const before = await findInventoryItem(id);
  if (!before) throw Errors.notFound("This item");
  await assertCodeFree(values.sku, id);
  if (values.supplierId !== before.supplierId) await assertSupplier(values.supplierId);
  const { sku, name, category, unit, reorderLevel, supplierId } = values;
  return runInTransaction(async (tx) => {
    const after = await updateInventoryItem(
      id,
      { sku, name, category, unit, reorderLevel, supplierId },
      tx,
    ).catch((e) => codeTaken(e, sku));
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "inventory.item.update",
      entity: "InventoryItem",
      entityId: id,
      before: toItem(before),
      after: toItem(after),
    });
    return after;
  });
}

export async function setItemActive(id: string, isActive: boolean, actor: Actor) {
  const before = await findInventoryItem(id);
  if (!before) throw Errors.notFound("This item");
  if (before.isActive === isActive) return before;
  return runInTransaction(async (tx) => {
    const after = await updateInventoryItem(id, { isActive }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: isActive ? "inventory.item.reactivate" : "inventory.item.deactivate",
      entity: "InventoryItem",
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return after;
  });
}

// ───────────── movements ─────────────

const AUDIT: Record<MovementType, string> = {
  IN: "inventory.movement.in",
  OUT: "inventory.movement.out",
  ADJUST: "inventory.movement.adjust",
};

/**
 * Writes one movement and its stock change in the caller's transaction (D-023). The update is
 * conditional: nothing takes stock below zero, and an Update stock line (`updateId`) only applies
 * to the stock the sheet saw (`item.quantityOnHand`), else it is STALE. Only Opening stock and
 * the sheet post movements since Phase 29 (D-102).
 */
export async function postMovement(
  tx: Tx,
  item: Pick<InventoryItem, "id" | "sku" | "name" | "unit" | "quantityOnHand">,
  input: { type: MovementType; delta: number; reason: string; updateId?: string | null },
  actor: Actor,
  now: Date,
) {
  const guard = input.updateId
    ? { expected: item.quantityOnHand, ...(input.delta < 0 ? { min: -input.delta } : {}) }
    : input.delta < 0
      ? { min: -input.delta }
      : {};
  const applied = await applyStockDelta(item.id, input.delta, guard, tx);
  if (!applied) {
    const fresh = await findInventoryItem(item.id, tx);
    if (fresh && !fresh.isActive)
      throw Errors.conflict(`${item.name} is deactivated. Reactivate it to record stock.`);
    const onHand = Number(fresh?.quantityOnHand ?? 0);
    if (input.updateId && Math.round(onHand * 100) !== Math.round(item.quantityOnHand * 100))
      throw Errors.stale(staleLine({ ...item, quantityOnHand: onHand }));
    throw Errors.conflict(notEnoughStock(onHand, item.unit, item.name));
  }
  const movement = await insertMovement(
    {
      itemId: item.id,
      type: input.type,
      quantityDelta: input.delta,
      reason: input.reason,
      updateId: input.updateId ?? null,
      createdById: actor.id,
      createdAt: now,
    },
    tx,
  );
  const onHandAfter = Math.round((item.quantityOnHand + input.delta) * 100) / 100;
  await recordAudit(tx, {
    actor: { type: "USER", userId: actor.id },
    action: AUDIT[input.type],
    entity: "InventoryMovement",
    entityId: movement.id,
    before: { quantityOnHand: item.quantityOnHand },
    after: {
      item: `${item.sku} · ${item.name}`,
      change: input.delta,
      quantityOnHand: onHandAfter,
      reason: input.reason,
      updateId: input.updateId ?? null,
    },
  });
  return { movementId: movement.id, onHandAfter };
}
