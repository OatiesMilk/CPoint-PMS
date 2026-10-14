import type { InventoryCategory, Prisma, PurchaseRequestStatus } from "@/generated/prisma/client";
import { OPEN_STATUSES } from "@/lib/procurement-rules";
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
    /** The rejected or cancelled request this one was copied from (D-044). */
    copiedFromId?: string | null;
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
  /** Ordered or partly received, and expected before this day: "Delivery late" (D-041). */
  lateBefore?: Date;
  /** Constructors see only their own requests. */
  requestedById?: string;
};

const OPEN: PurchaseRequestStatus[] = [...OPEN_STATUSES];
const AWAITING_DELIVERY: PurchaseRequestStatus[] = ["ORDERED", "PARTIALLY_RECEIVED"];

/** Ordered or partly received requests whose expected delivery date has passed. */
const lateWhere = (before: Date): Prisma.PurchaseRequestWhereInput => ({
  status: { in: AWAITING_DELIVERY },
  expectedDeliveryOn: { lt: before },
});

function listWhere(filter: Omit<RequestListFilter, "status">): Prisma.PurchaseRequestWhereInput {
  const lineFilter: Prisma.PurchaseRequestLineWhereInput = {
    ...(filter.itemId ? { inventoryItemId: filter.itemId } : {}),
    ...(filter.category ? { category: filter.category } : {}),
  };
  const and: Prisma.PurchaseRequestWhereInput[] = [];
  // Closed requests have no urgency, so an urgency filter only ever matches open ones.
  if (filter.neededBy)
    and.push(
      { status: { in: OPEN } },
      {
        neededBy: {
          ...(filter.neededBy.after ? { gt: filter.neededBy.after } : {}),
          ...(filter.neededBy.through ? { lte: filter.neededBy.through } : {}),
        },
      },
    );
  if (filter.lateBefore) and.push(lateWhere(filter.lateBefore));
  return {
    ...(filter.requestedById ? { requestedById: filter.requestedById } : {}),
    ...(and.length ? { AND: and } : {}),
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
  expectedDeliveryOn: true,
  closedShortAt: true,
  supplier: { select: { id: true, name: true } },
  // The role marks a request the Floor Manager raised (D-045). Never counted or ranked (D-008).
  requestedBy: { select: { id: true, name: true, role: true } },
  lines: {
    select: {
      itemName: true,
      category: true,
      quantity: true,
      unit: true,
      decision: true,
      receivedQuantity: true,
    },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.PurchaseRequestSelect;

export type RequestListRow = Prisma.PurchaseRequestGetPayload<{ select: typeof listSelect }>;

/**
 * One page of requests plus a count per status (for the tabs, under the same non-status filters).
 * Pending: the nearest needed-by date first (so High urgency is on top, then Medium, then Low),
 * then oldest first. Ordered and partly received: the earliest expected delivery first, so late
 * ones are on top. Others: newest first.
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
      : (filter.status && AWAITING_DELIVERY.includes(filter.status)) || filter.lateBefore
        ? [{ expectedDeliveryOn: "asc" }, { createdAt: "asc" }]
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
const attachment = {
  select: { id: true, mime: true, size: true, originalName: true, createdAt: true },
  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
} satisfies Prisma.PurchaseDelivery$attachmentsArgs;

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
  orderReference: true,
  expectedDeliveryOn: true,
  orderNote: true,
  orderedAt: true,
  cancelReason: true,
  closedShortAt: true,
  closedShortReason: true,
  requestedById: true,
  requestedBy: { select: { id: true, name: true, role: true } },
  decidedBy: person,
  orderedBy: person,
  supplier: { select: { id: true, name: true, contactPerson: true, phone: true } },
  copiedFrom: { select: { id: true, code: true } },
  copies: { select: { id: true, code: true }, orderBy: { createdAt: "asc" } },
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
      receivedQuantity: true,
      decision: true,
      rejectionReason: true,
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
      deliveryId: true,
      createdAt: true,
      actor: person,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  deliveries: {
    select: {
      id: true,
      deliveredOn: true,
      note: true,
      createdAt: true,
      recordedBy: person,
      lines: { select: { lineId: true, quantity: true, movementId: true } },
      attachments: attachment,
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
  data: Prisma.PurchaseRequestUncheckedUpdateManyInput & { status: PurchaseRequestStatus },
  db: Db = defaultDb(),
): Promise<number> {
  const { count } = await db.purchaseRequest.updateMany({ where: { id, status: from }, data });
  return count;
}

/**
 * Records the decision on one item (D-039), only if it's this request's and still undecided.
 * Returns how many rows changed (0 or 1).
 */
export async function setLineDecision(
  requestId: string,
  lineId: string,
  data: {
    decision: "APPROVED" | "REJECTED";
    rejectionReason: string | null;
    decidedById: string;
    decidedAt: Date;
  },
  db: Db = defaultDb(),
): Promise<number> {
  const { count } = await db.purchaseRequestLine.updateMany({
    where: { id: lineId, requestId, decision: "PENDING" },
    data,
  });
  return count;
}

export function insertEvent(
  data: {
    requestId: string;
    fromStatus: PurchaseRequestStatus | null;
    toStatus: PurchaseRequestStatus;
    actorId: string;
    note: string | null;
    /** The delivery this event recorded or added proof to. */
    deliveryId?: string | null;
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

// ───────────── deliveries (D-042) ─────────────

/**
 * Adds what arrived to an approved item, only if its received quantity is still what the caller
 * saw, so two deliveries recorded at once can't both count. Returns how many rows changed (0 or 1).
 */
export async function addReceivedQuantity(
  requestId: string,
  lineId: string,
  seen: number,
  delta: number,
  db: Db = defaultDb(),
): Promise<number> {
  const { count } = await db.purchaseRequestLine.updateMany({
    where: { id: lineId, requestId, decision: "APPROVED", receivedQuantity: seen },
    data: { receivedQuantity: { increment: delta } },
  });
  return count;
}

export type NewAttachment = {
  storageKey: string;
  mime: string;
  size: number;
  originalName: string;
};

export function insertDelivery(
  data: {
    requestId: string;
    deliveredOn: Date;
    note: string | null;
    recordedById: string;
    createdAt: Date;
    lines: { lineId: string; quantity: number; movementId: string | null }[];
    attachments: NewAttachment[];
  },
  db: Db = defaultDb(),
) {
  const { lines, attachments, ...delivery } = data;
  return db.purchaseDelivery.create({
    data: {
      ...delivery,
      lines: { create: lines },
      attachments: {
        create: attachments.map((a) => ({
          ...a,
          uploadedById: data.recordedById,
          createdAt: data.createdAt,
        })),
      },
    },
    select: { id: true },
  });
}

/** More proof files on a delivery that's already recorded. Files are only ever added. */
export function insertAttachments(
  deliveryId: string,
  uploadedById: string,
  files: NewAttachment[],
  createdAt: Date,
  db: Db = defaultDb(),
) {
  return db.purchaseAttachment.createMany({
    data: files.map((f) => ({ ...f, deliveryId, uploadedById, createdAt })),
  });
}

export function findDelivery(id: string, db: Db = defaultDb()) {
  return db.purchaseDelivery.findUnique({
    where: { id },
    select: {
      id: true,
      deliveredOn: true,
      _count: { select: { attachments: true } },
      request: { select: { id: true, code: true, requestedById: true, status: true } },
    },
  });
}

export function findAttachment(id: string, db: Db = defaultDb()) {
  return db.purchaseAttachment.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      mime: true,
      originalName: true,
      delivery: { select: { request: { select: { id: true, requestedById: true } } } },
    },
  });
}

// ───────────── summaries ─────────────

/**
 * Open (not yet fully received) requests that still ask for any of these items: one entry per line.
 * An item rejected inside an approved request is no longer asked for (D-039).
 */
export function openRequestsForItems(itemIds: string[], db: Db = defaultDb()) {
  if (itemIds.length === 0) return Promise.resolve([]);
  return db.purchaseRequestLine.findMany({
    where: {
      inventoryItemId: { in: itemIds },
      decision: { not: "REJECTED" },
      request: { status: { in: OPEN } },
    },
    select: {
      inventoryItemId: true,
      request: { select: { id: true, code: true, status: true } },
    },
    orderBy: { request: { createdAt: "asc" } },
  });
}

/**
 * What waits on the Floor Manager: pending requests (how many, how many are High urgency, i.e.
 * needed on or before `highThrough`, and the oldest), approved requests not yet ordered, and
 * ordered ones expected before `today` that haven't fully arrived.
 */
export async function pendingSummary(highThrough: Date, today: Date, db: Db = defaultDb()) {
  const where = { status: "PENDING" as const };
  const [count, high, oldest, toOrder, late] = await Promise.all([
    db.purchaseRequest.count({ where }),
    db.purchaseRequest.count({ where: { ...where, neededBy: { lte: highThrough } } }),
    db.purchaseRequest.findFirst({
      where,
      select: { id: true, code: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.purchaseRequest.count({ where: { status: "APPROVED" } }),
    db.purchaseRequest.count({ where: lateWhere(today) }),
  ]);
  return { count, high, oldest, toOrder, late };
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
