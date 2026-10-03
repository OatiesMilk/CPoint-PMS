import type { Prisma } from "@/generated/prisma/client";
import type { InventoryCategory, MovementType } from "@/lib/domain";
import {
  CATEGORY_PREFIX,
  formatQuantity,
  nextItemCode,
  notEnoughStock,
  planMovement,
  reversalOf,
  stockLevel,
  type StockLevel,
} from "@/lib/inventory-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  applyStockDelta,
  findInventoryItem,
  findInventoryItemBySku,
  findMovement,
  findReversal,
  insertInventoryItem,
  insertMovement,
  listInventoryItems,
  listItemCodes,
  listMovements,
  listRollItemsInStock,
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
  MovementBody,
} from "@/server/validators/inventory.validator";
import { recordAudit } from "./audit.service";

export const INVENTORY_PAGE_SIZE = 25;
export const MOVEMENT_PAGE_SIZE = 25;
/** The Undo toast lasts 6 s; allow a generous window, then corrections go through a stock count. */
const UNDO_WINDOW_MS = 10 * 60_000;

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
  return {
    rows: rows.map(toItem),
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

/** Leather-roll items the batch form can take a roll from. */
export async function rollItemOptions() {
  const rows = await listRollItemsInStock();
  return rows.map((r) => ({ ...r, quantityOnHand: Number(r.quantityOnHand) }));
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

export async function createItem(values: InventoryItemFormValues, actor: Actor, now = new Date()) {
  await assertCodeFree(values.sku);
  const { openingStock, ...columns } = values;
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
  const { sku, name, category, unit, reorderLevel } = values;
  return runInTransaction(async (tx) => {
    const after = await updateInventoryItem(
      id,
      { sku, name, category, unit, reorderLevel },
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

const STALE_COUNT =
  "Stock changed while you were counting. Check the new quantity and count again.";

/**
 * Writes one movement and its stock change in the caller's transaction (D-023). The update is
 * conditional: usage can't take stock below zero, and a count only applies to the stock it saw.
 * Other services (batch roll consumption) use this too, so the ledger has one write path.
 */
export async function postMovement(
  tx: Tx,
  item: Pick<InventoryItem, "id" | "sku" | "name" | "unit" | "quantityOnHand">,
  input: { type: MovementType; delta: number; reason: string; batchId?: string | null },
  actor: Actor,
  now: Date,
) {
  const guard =
    input.type === "ADJUST"
      ? { expected: item.quantityOnHand }
      : input.delta < 0
        ? { min: -input.delta }
        : {};
  const applied = await applyStockDelta(item.id, input.delta, guard, tx);
  if (!applied) {
    if (input.type === "ADJUST") throw Errors.stale(STALE_COUNT);
    const fresh = await findInventoryItem(item.id, tx);
    if (fresh && !fresh.isActive)
      throw Errors.conflict("This item is deactivated. Reactivate it to record stock.");
    throw Errors.conflict(notEnoughStock(Number(fresh?.quantityOnHand ?? 0), item.unit));
  }
  const movement = await insertMovement(
    {
      itemId: item.id,
      type: input.type,
      quantityDelta: input.delta,
      reason: input.reason,
      batchId: input.batchId ?? null,
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
      batchId: input.batchId ?? null,
    },
  });
  return { movementId: movement.id, onHandAfter };
}

export async function recordMovement(
  id: string,
  body: MovementBody,
  actor: Actor,
  now = new Date(),
) {
  const row = await findInventoryItem(id);
  if (!row) throw Errors.notFound("This item");
  const item = toItem(row);
  const plan = planMovement(item, body);
  if (!plan.ok) {
    if (plan.code === "STALE") throw Errors.stale(plan.reason);
    throw Errors.conflict(plan.reason);
  }
  const result = await runInTransaction((tx) =>
    postMovement(
      tx,
      item,
      {
        type: body.type,
        delta: plan.delta,
        reason: plan.reason,
        batchId: body.type === "OUT" ? body.batchId : undefined,
      },
      actor,
      now,
    ),
  );
  return {
    ...result,
    type: body.type,
    message: `${MOVEMENT_VERB[body.type]} ${formatQuantity(Math.abs(plan.delta), item.unit)} of ${item.name}.`,
  };
}

const MOVEMENT_VERB: Record<MovementType, string> = {
  IN: "Received",
  OUT: "Used",
  ADJUST: "Counted; corrected by",
};

/** The Undo toast: records the opposite movement (the ledger keeps both). */
export async function reverseMovement(movementId: string, actor: Actor, now = new Date()) {
  const movement = await findMovement(movementId);
  if (!movement) throw Errors.notFound("This stock entry");
  const delta = Number(movement.quantityDelta);
  const reversal = reversalOf({ type: movement.type, quantityDelta: delta });
  if (!reversal) throw Errors.conflict("A stock count can't be undone. Count again to correct it.");
  if (now.getTime() - movement.createdAt.getTime() > UNDO_WINDOW_MS)
    throw Errors.conflict("It's too late to undo this. Record a correction instead.");
  if (await findReversal({ ...movement, quantityDelta: delta }))
    throw Errors.conflict("This entry was already undone.");
  const item = toItem(movement.item);
  return runInTransaction((tx) =>
    postMovement(
      tx,
      item,
      {
        type: reversal.type,
        delta: -delta,
        reason: `Undo: ${movement.reason}`,
        batchId: movement.batch?.id,
      },
      actor,
      now,
    ),
  );
}
