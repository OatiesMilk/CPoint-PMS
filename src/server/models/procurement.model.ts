import type { InventoryCategory, Prisma, PurchaseRequestStatus } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

// Purchase requests (D-029). A request's status changes only through transitionStatus, which is
// conditional on the status the caller saw; every change also writes a purchase_request_events row.

export async function nextRequestNumber(year: number, db: Db = defaultDb()): Promise<number> {
  const rows = await db.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO purchase_request_sequences ("year", "lastValue") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastValue" = purchase_request_sequences."lastValue" + 1
    RETURNING "lastValue"`;
  return rows[0].lastValue;
}

export type NewLine = {
  inventoryItemId: string | null;
  itemName: string;
  category: InventoryCategory;
  unit: string;
  quantity: number;
  note: string | null;
  onHandAtRequest: number | null;
  reorderLevelAtRequest: number | null;
};

export function insertRequest(
  data: {
    code: string;
    requestedById: string;
    neededBy: Date;
    createdAt: Date;
    lines: NewLine[];
  },
  db: Db = defaultDb(),
) {
  const { lines, ...request } = data;
  return db.purchaseRequest.create({
    data: {
      ...request,
      lines: { create: lines.map((line, position) => ({ ...line, position })) },
    },
    select: { id: true, code: true },
  });
}

// ───────────── list ─────────────

export type RequestListFilter = {
  status?: PurchaseRequestStatus;
  category?: InventoryCategory;
  itemId?: string;
  from?: Date;
  to?: Date; // exclusive
  /** Open requests whose needed-by date is in this range (an urgency band, D-037). */
  neededBy?: { after?: Date; through?: Date };
  /** Constructors see only their own requests. */
  requestedById?: string;
};

const OPEN: PurchaseRequestStatus[] = ["PENDING", "APPROVED"];

function listWhere(filter: Omit<RequestListFilter, "status">): Prisma.PurchaseRequestWhereInput {
  const lineFilter: Prisma.PurchaseRequestLineWhereInput = {
    ...(filter.itemId ? { inventoryItemId: filter.itemId } : {}),
    ...(filter.category ? { category: filter.category } : {}),
  };
  return {
    ...(filter.requestedById ? { requestedById: filter.requestedById } : {}),
    // Closed requests have no urgency, so an urgency filter only ever matches open ones.
    ...(filter.neededBy
      ? {
          AND: [
            { status: { in: OPEN } },
            {
              neededBy: {
                ...(filter.neededBy.after ? { gt: filter.neededBy.after } : {}),
                ...(filter.neededBy.through ? { lte: filter.neededBy.through } : {}),
              },
            },
          ],
        }
      : {}),
    ...(Object.keys(lineFilter).length ? { lines: { some: lineFilter } } : {}),
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lt: filter.to } : {}),
          },
        }
      : {}),
  };
}

const listSelect = {
  id: true,
  code: true,
  status: true,
  neededBy: true,
  createdAt: true,
  decidedAt: true,
  receivedAt: true,
  requestedBy: { select: { id: true, name: true } },
  lines: {
    select: { itemName: true, category: true, quantity: true, unit: true },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.PurchaseRequestSelect;

export type RequestListRow = Prisma.PurchaseRequestGetPayload<{ select: typeof listSelect }>;

/**
 * One page of requests plus a count per status (for the tabs, under the same non-status filters).
 * Pending: the nearest needed-by date first (so High urgency is on top, then Medium, then Low),
 * then oldest first. Others: newest first.
 */
export async function listRequests(
  filter: RequestListFilter,
  page: { skip: number; take: number },
  db: Db = defaultDb(),
) {
  const base = listWhere(filter);
  const where = { ...base, ...(filter.status ? { status: filter.status } : {}) };
  const orderBy: Prisma.PurchaseRequestOrderByWithRelationInput[] =
    filter.status === "PENDING"
      ? [{ neededBy: "asc" }, { createdAt: "asc" }]
      : [{ createdAt: "desc" }];
  const [rows, total, byStatus] = await Promise.all([
    db.purchaseRequest.findMany({ where, select: listSelect, orderBy, ...page }),
    db.purchaseRequest.count({ where }),
    db.purchaseRequest.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);
  return {
    rows,
    total,
    counts: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])) as Partial<
      Record<PurchaseRequestStatus, number>
    >,
  };
}

// ───────────── detail ─────────────

const person = { select: { id: true, name: true } } as const;

const detailSelect = {
  id: true,
  code: true,
  status: true,
  neededBy: true,
  rejectionReason: true,
  approvalNote: true,
  createdAt: true,
  decidedAt: true,
  receivedAt: true,
  requestedById: true,
  requestedBy: person,
  decidedBy: person,
  lines: {
    select: {
      id: true,
      inventoryItemId: true,
      itemName: true,
      category: true,
      unit: true,
      quantity: true,
      note: true,
      onHandAtRequest: true,
      reorderLevelAtRequest: true,
      movementId: true,
      item: {
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          category: true,
          quantityOnHand: true,
          reorderLevel: true,
          isActive: true,
        },
      },
    },
    orderBy: { position: "asc" },
  },
  events: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      actor: person,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  remarks: {
    select: { id: true, body: true, createdAt: true, author: person },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.PurchaseRequestSelect;

export type RequestDetailRow = Prisma.PurchaseRequestGetPayload<{ select: typeof detailSelect }>;

export function findRequestDetail(id: string, db: Db = defaultDb()) {
  return db.purchaseRequest.findUnique({ where: { id }, select: detailSelect });
}

// ───────────── changes ─────────────

/** Moves a request on only if it's still in `from`. Returns how many rows changed (0 or 1). */
export async function transitionStatus(
  id: string,
  from: PurchaseRequestStatus,
  data: {
    status: PurchaseRequestStatus;
    decidedById?: string;
    decidedAt?: Date;
    rejectionReason?: string;
    approvalNote?: string | null;
    receivedAt?: Date;
  },
  db: Db = defaultDb(),
): Promise<number> {
  const { count } = await db.purchaseRequest.updateMany({ where: { id, status: from }, data });
  return count;
}

export function insertEvent(
  data: {
    requestId: string;
    fromStatus: PurchaseRequestStatus | null;
    toStatus: PurchaseRequestStatus;
    actorId: string;
    note: string | null;
    createdAt: Date;
  },
  db: Db = defaultDb(),
) {
  return db.purchaseRequestEvent.create({ data, select: { id: true } });
}

export function insertRemark(
  data: { requestId: string; authorId: string; body: string; createdAt: Date },
  db: Db = defaultDb(),
) {
  return db.purchaseRequestRemark.create({
    data,
    select: { id: true, body: true, createdAt: true },
  });
}

export function setLineMovement(lineId: string, movementId: string, db: Db = defaultDb()) {
  return db.purchaseRequestLine.update({
    where: { id: lineId },
    data: { movementId },
    select: { id: true },
  });
}

// ───────────── summaries ─────────────

/** Open (pending or approved) requests that ask for any of these items: one entry per line. */
export function openRequestsForItems(itemIds: string[], db: Db = defaultDb()) {
  if (itemIds.length === 0) return Promise.resolve([]);
  return db.purchaseRequestLine.findMany({
    where: { inventoryItemId: { in: itemIds }, request: { status: { in: OPEN } } },
    select: {
      inventoryItemId: true,
      request: { select: { id: true, code: true, status: true } },
    },
    orderBy: { request: { createdAt: "asc" } },
  });
}

/**
 * Pending requests waiting on the Floor Manager: how many, how many are High urgency (needed on or
 * before `highThrough`), and the oldest.
 */
export async function pendingSummary(highThrough: Date, db: Db = defaultDb()) {
  const where = { status: "PENDING" as const };
  const [count, high, oldest] = await Promise.all([
    db.purchaseRequest.count({ where }),
    db.purchaseRequest.count({ where: { ...where, neededBy: { lte: highThrough } } }),
    db.purchaseRequest.findFirst({
      where,
      select: { id: true, code: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { count, high, oldest };
}

/** A requester's open requests, newest first (the constructor home). */
export function openRequestsBy(userId: string, take: number, db: Db = defaultDb()) {
  return db.purchaseRequest.findMany({
    where: { requestedById: userId, status: { in: OPEN } },
    select: listSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

// ───────────── leather roll requesters (D-031) ─────────────

/** Active Shoe Constructors, for the designation toggles. */
export function listConstructors(db: Db = defaultDb()) {
  return db.user.findMany({
    where: { role: "SHOE_CONSTRUCTOR", isActive: true },
    select: { id: true, name: true, email: true, canRequestLeatherRolls: true },
    orderBy: { name: "asc" },
  });
}

export function setCanRequestLeatherRolls(
  userId: string,
  canRequestLeatherRolls: boolean,
  db: Db = defaultDb(),
) {
  return db.user.update({
    where: { id: userId },
    data: { canRequestLeatherRolls },
    select: { id: true },
  });
}
