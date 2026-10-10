import type { PurchaseRequestStatus, Role } from "@/lib/domain";
import { manilaToday, manilaYear } from "@/lib/format";
import {
  ACTION_VERB,
  calendarDay,
  daysLeftLabel,
  formatRequestCode,
  NEEDED_BY_MAX_DAYS,
  transition,
  urgencyCutoffs,
  urgencyDateRange,
  urgencyOf,
  type PurchaseAction,
  type Urgency,
} from "@/lib/procurement-rules";
import { addDays, manilaDayStart } from "@/lib/report-rules";
import { AppError, Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import { findInventoryItem, listRequestableItems } from "@/server/models/inventory.model";
import {
  findRequestDetail,
  insertEvent,
  insertRemark,
  insertRequest,
  listConstructors,
  listRequests as listRequestRows,
  nextRequestNumber,
  openRequestsBy,
  openRequestsForItems,
  pendingSummary,
  setCanRequestLeatherRolls,
  setLineMovement,
  transitionStatus,
  type RequestDetailRow,
  type RequestListRow,
} from "@/server/models/procurement.model";
import { findUserById } from "@/server/models/user.model";
import {
  can,
  canRequestLeatherRollsFor,
  mayActOnRequest,
  mayRemarkOnRequest,
} from "@/server/policies/permissions";
import type {
  PurchaseRequestValues,
  RequestListQuery,
} from "@/server/validators/procurement.validator";
import { recordAudit } from "./audit.service";
import { postMovement } from "./inventory.service";

/**
 * Material requests (D-029, D-031, D-035 to D-037). A Shoe Constructor asks (leather rolls only if
 * allowed); the Floor Manager approves or rejects, then marks it received, which posts the stock
 * IN through the inventory ledger (D-023) in the same transaction. Every change writes a timeline
 * event and an audit row. Urgency is worked out from the needed-by date on every read.
 */

export type Viewer = { id: string; role: Role; canRequestLeatherRolls: boolean };

export const REQUEST_PAGE_SIZE = 25;

const STALE = "Someone else already changed this request. Refresh to see where it stands.";
const LEATHER_ROLLS_NOT_ALLOWED = () =>
  new AppError(
    403,
    "LEATHER_ROLLS_NOT_ALLOWED",
    "Only constructors your Floor Manager allows can request leather rolls. Ask them, or remove the leather roll.",
  );

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

// ───────────── picker ─────────────

export type RequestableItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  low: boolean;
  /** False for leather rolls when this person isn't allowed to request them (D-031). */
  allowed: boolean;
  /** An open request already asking for it ("PR-2026-0007 already asks for this"). */
  openRequestCode: string | null;
};

/**
 * Active items with their stock, for the request form. No movements and no people. Leather rolls
 * are marked not allowed for a constructor who isn't designated for them (D-031).
 */
export async function requestableItems(viewer?: {
  role: Role;
  canRequestLeatherRolls: boolean;
}): Promise<RequestableItem[]> {
  const leatherOk = !viewer || canRequestLeatherRollsFor(viewer);
  const rows = await listRequestableItems();
  const open = await openRequestCodes(rows.map((r) => r.id));
  return rows.map((r) => {
    const onHand = Number(r.quantityOnHand);
    const reorderLevel = Number(r.reorderLevel);
    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      category: r.category,
      unit: r.unit,
      onHand,
      reorderLevel,
      low: onHand <= reorderLevel,
      allowed: r.category !== "LEATHER_ROLL" || leatherOk,
      openRequestCode: open.get(r.id)?.code ?? null,
    };
  });
}

/** itemId → the oldest open (pending or approved) request asking for it. */
export async function openRequestCodes(
  itemIds: string[],
): Promise<Map<string, { id: string; code: string }>> {
  const lines = await openRequestsForItems(itemIds);
  const map = new Map<string, { id: string; code: string }>();
  for (const line of lines)
    if (line.inventoryItemId && !map.has(line.inventoryItemId))
      map.set(line.inventoryItemId, { id: line.request.id, code: line.request.code });
  return map;
}

// ───────────── create ─────────────

export async function createRequest(
  values: PurchaseRequestValues,
  actor: Viewer,
  now: Date = new Date(),
) {
  if (!can(actor.role, "procurement:request"))
    throw Errors.forbidden(
      "Only Shoe Constructors send material requests. Ask one of them to send it for you.",
    );
  // The schema checks the date against the clock; this checks it against the caller's `now`.
  const today = manilaToday(now);
  if (values.neededBy < today) {
    throw Errors.validation([
      {
        path: ["neededBy"],
        message: "Needed by can't be in the past. Pick today or a later date.",
      },
    ]);
  }
  if (values.neededBy > addDays(today, NEEDED_BY_MAX_DAYS)) {
    throw Errors.validation([
      {
        path: ["neededBy"],
        message: `Needed by can be at most ${NEEDED_BY_MAX_DAYS} days ahead. Pick an earlier date.`,
      },
    ]);
  }

  const lines = await Promise.all(
    values.lines.map(async (line, i) => {
      if (!line.inventoryItemId) {
        return {
          inventoryItemId: null,
          itemName: line.itemName!,
          category: line.category!,
          unit: line.unit!,
          quantity: line.quantity,
          note: line.note ?? null,
          onHandAtRequest: null,
          reorderLevelAtRequest: null,
        };
      }
      const item = await findInventoryItem(line.inventoryItemId);
      if (!item || !item.isActive) {
        throw Errors.validation([
          {
            path: ["lines", i, "inventoryItemId"],
            message:
              "This item is no longer in inventory. Choose another item, or pick “Something not in inventory yet” and type its name.",
          },
        ]);
      }
      return {
        inventoryItemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        quantity: line.quantity,
        note: line.note ?? null,
        onHandAtRequest: Number(item.quantityOnHand),
        reorderLevelAtRequest: Number(item.reorderLevel),
      };
    }),
  );
  // Leather rolls need the designation, whether picked from inventory or typed (D-031).
  if (lines.some((l) => l.category === "LEATHER_ROLL") && !canRequestLeatherRollsFor(actor))
    throw LEATHER_ROLLS_NOT_ALLOWED();
  const open = await openRequestCodes(
    lines.flatMap((l) => (l.inventoryItemId ? [l.inventoryItemId] : [])),
  );

  const created = await runInTransaction(async (tx) => {
    const year = manilaYear(now);
    const code = formatRequestCode(year, await nextRequestNumber(year, tx));
    const request = await insertRequest(
      {
        code,
        requestedById: actor.id,
        neededBy: new Date(`${values.neededBy}T00:00:00Z`),
        createdAt: now,
        lines,
      },
      tx,
    );
    await insertEvent(
      {
        requestId: request.id,
        fromStatus: null,
        toStatus: "PENDING",
        actorId: actor.id,
        note: null,
        createdAt: now,
      },
      tx,
    );
    // Why it's needed, if they said: the request's first remark (D-036).
    if (values.remarks) {
      await insertRemark(
        { requestId: request.id, authorId: actor.id, body: values.remarks, createdAt: now },
        tx,
      );
    }
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "procurement.request.create",
      entity: "PurchaseRequest",
      entityId: request.id,
      after: {
        code,
        neededBy: values.neededBy,
        ...(values.remarks ? { remarks: values.remarks } : {}),
        lines: lines.map((l) => ({
          item: l.itemName,
          category: l.category,
          quantity: l.quantity,
          unit: l.unit,
        })),
      },
    });
    return request;
  });

  return {
    ...created,
    /** Items another open request already asks for: shown as a heads-up, never a block. */
    alreadyRequested: lines.flatMap((l) =>
      l.inventoryItemId && open.has(l.inventoryItemId)
        ? [{ itemName: l.itemName, code: open.get(l.inventoryItemId)!.code }]
        : [],
    ),
  };
}

// ───────────── decisions ─────────────

type ActionInput =
  | { action: "approve"; note?: string }
  | { action: "reject"; reason: string }
  | { action: "cancel"; note?: string }
  | { action: "receive" };

const REFUSED: Record<PurchaseAction, string> = {
  approve: "Only the Floor Manager can approve requests. Ask them to decide this one.",
  reject: "Only the Floor Manager can reject requests. Ask them to decide this one.",
  cancel: "Only the person who sent this request can cancel it. Ask them, or add a remark.",
  receive: "Only the Floor Manager can mark requests received. Tell them the delivery arrived.",
};

/** Approve, reject, cancel or receive. Conditional on the status loaded here (409 STALE). */
export async function actOnRequest(
  id: string,
  input: ActionInput,
  actor: Viewer,
  now: Date = new Date(),
) {
  const request = await findRequestDetail(id);
  if (!request || !visibleTo(request, actor)) throw Errors.notFound("This request");
  if (!mayActOnRequest(actor, request, input.action)) {
    throw Errors.forbidden(REFUSED[input.action]);
  }
  const move = transition(request.status, input.action);
  if (!move.ok) throw Errors.conflict(move.reason);

  const decision =
    input.action === "approve"
      ? { decidedById: actor.id, decidedAt: now, approvalNote: input.note ?? null }
      : input.action === "reject"
        ? { decidedById: actor.id, decidedAt: now, rejectionReason: input.reason }
        : input.action === "receive"
          ? { receivedAt: now }
          : {};
  const note =
    input.action === "reject"
      ? input.reason
      : input.action === "approve" || input.action === "cancel"
        ? (input.note ?? null)
        : null;

  return runInTransaction(async (tx) => {
    const count = await transitionStatus(id, move.from, { status: move.to, ...decision }, tx);
    if (count !== 1) throw Errors.stale(STALE);

    const received: { itemName: string; quantity: number; unit: string }[] = [];
    if (input.action === "receive") {
      for (const line of request.lines) {
        if (!line.item) continue; // typed items: added to inventory by hand
        const { movementId } = await postMovement(
          tx,
          {
            id: line.item.id,
            sku: line.item.sku,
            name: line.item.name,
            unit: line.item.unit,
            quantityOnHand: Number(line.item.quantityOnHand),
          },
          { type: "IN", delta: Number(line.quantity), reason: `Received for ${request.code}` },
          actor,
          now,
        );
        await setLineMovement(line.id, movementId, tx);
        received.push({
          itemName: line.itemName,
          quantity: Number(line.quantity),
          unit: line.unit,
        });
      }
    }

    await insertEvent(
      {
        requestId: id,
        fromStatus: move.from,
        toStatus: move.to,
        actorId: actor.id,
        note:
          input.action === "receive"
            ? received.length
              ? `Added to stock: ${received.map((r) => r.itemName).join(", ")}.`
              : "No inventory items on this request; nothing added to stock."
            : note,
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: `procurement.request.${input.action}`,
      entity: "PurchaseRequest",
      entityId: id,
      before: { code: request.code, status: move.from },
      after: {
        code: request.code,
        status: move.to,
        ...(note ? { note } : {}),
        ...(input.action === "receive" ? { received } : {}),
      },
    });
    return {
      id,
      code: request.code,
      status: move.to,
      message: `${request.code} ${ACTION_VERB[input.action]}.`,
    };
  });
}

export async function addRemark(id: string, body: string, actor: Viewer, now: Date = new Date()) {
  const request = await findRequestDetail(id);
  if (!request || !visibleTo(request, actor)) throw Errors.notFound("This request");
  if (!mayRemarkOnRequest(actor, request)) {
    throw Errors.forbidden(
      actor.role === "SHOE_CONSTRUCTOR"
        ? "You can add remarks to your own requests only. Open one of yours to add a remark."
        : "Only the Floor Manager and the requester can add remarks. Ask the Floor Manager to add it.",
    );
  }
  return runInTransaction(async (tx) => {
    const remark = await insertRemark(
      { requestId: id, authorId: actor.id, body, createdAt: now },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "procurement.remark.add",
      entity: "PurchaseRequest",
      entityId: id,
      after: { code: request.code, remark: body },
    });
    return remark;
  });
}

// ───────────── reads ─────────────

/** Constructors see only their own requests; the Floor Manager and the System Admin see all. */
function visibleTo(request: { requestedById: string }, viewer: Viewer): boolean {
  return viewer.role !== "SHOE_CONSTRUCTOR" || request.requestedById === viewer.id;
}

/** Urgency and "in 2 working days", or nulls once the request is closed (D-037). */
function urgencyFields(
  row: { status: PurchaseRequestStatus; neededBy: Date },
  today: string,
): { urgency: Urgency | null; daysLeft: string | null } {
  const urgency = urgencyOf(row.status, row.neededBy, today);
  return {
    urgency,
    daysLeft: urgency ? daysLeftLabel(calendarDay(row.neededBy), today) : null,
  };
}

const dayToDate = (day: string | undefined) => (day ? new Date(`${day}T00:00:00Z`) : undefined);

export type RequestListItem = Omit<RequestListRow, "lines"> & {
  lines: { itemName: string; quantity: number; unit: string }[];
  urgency: Urgency | null;
  daysLeft: string | null;
};

export async function listRequests(
  query: RequestListQuery,
  viewer: Viewer,
  now: Date = new Date(),
) {
  const page = query.page ?? 1;
  const today = manilaToday(now);
  const band = query.urgency ? urgencyDateRange(query.urgency, today) : undefined;
  const { rows, total, counts } = await listRequestRows(
    {
      status: query.status,
      category: query.category,
      itemId: query.item,
      from: query.from ? manilaDayStart(query.from) : undefined,
      to: query.to ? manilaDayStart(addDays(query.to, 1)) : undefined,
      requestedById: viewer.role === "SHOE_CONSTRUCTOR" ? viewer.id : undefined,
      neededBy: band && { after: dayToDate(band.after), through: dayToDate(band.through) },
    },
    { skip: (page - 1) * REQUEST_PAGE_SIZE, take: REQUEST_PAGE_SIZE },
  );
  return {
    rows: rows.map((row) => toListItem(row, today)),
    total,
    counts,
    page,
    pageCount: Math.max(1, Math.ceil(total / REQUEST_PAGE_SIZE)),
  };
}

function toListItem(row: RequestListRow, today: string): RequestListItem {
  return {
    ...row,
    ...urgencyFields(row, today),
    lines: row.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
  };
}

export type RequestDetail = ReturnType<typeof toDetail>;

function toDetail(row: RequestDetailRow, viewer: Viewer, today: string) {
  const actions = (["approve", "reject", "receive", "cancel"] as const).filter(
    (a) => mayActOnRequest(viewer, row, a) && transition(row.status, a).ok,
  );
  return {
    ...row,
    ...urgencyFields(row, today),
    lines: row.lines.map((l) => ({
      ...l,
      quantity: Number(l.quantity),
      onHandAtRequest: num(l.onHandAtRequest),
      reorderLevelAtRequest: num(l.reorderLevelAtRequest),
      item: l.item
        ? {
            ...l.item,
            quantityOnHand: Number(l.item.quantityOnHand),
            reorderLevel: Number(l.item.reorderLevel),
          }
        : null,
    })),
    /** What this viewer can do now: drives the buttons, and the service checks again. */
    actions,
    canRemark: mayRemarkOnRequest(viewer, row),
  };
}

export async function getRequest(id: string, viewer: Viewer, now: Date = new Date()) {
  const row = await findRequestDetail(id);
  if (!row || !visibleTo(row, viewer)) return null;
  return toDetail(row, viewer, manilaToday(now));
}

/** The Floor Manager's home card: pending requests, how many are High urgency, the oldest wait. */
export function pendingRequestsCard(now: Date = new Date()) {
  return pendingSummary(dayToDate(urgencyCutoffs(manilaToday(now)).highThrough)!);
}

/** The constructor's home: their open requests. */
export async function myOpenRequests(userId: string, take = 5, now: Date = new Date()) {
  const today = manilaToday(now);
  return (await openRequestsBy(userId, take)).map((row) => toListItem(row, today));
}

export const OPEN_TAB_DEFAULT: Record<Role, PurchaseRequestStatus | undefined> = {
  FLOOR_MANAGER: "PENDING",
  SHOE_CONSTRUCTOR: undefined,
  SYSTEM_ADMIN: undefined,
  QUALITY_INSPECTOR: undefined,
};

// ───────────── leather roll requesters (D-031) ─────────────

export function listRequesters() {
  return listConstructors();
}

/**
 * Allows (or stops) a Shoe Constructor to request leather rolls. Every constructor can request the
 * other materials. Used by both the Floor Manager's Procurement tab and the System Admin's Users
 * page. Takes effect on the person's next request: the flag is read from the database every time.
 */
export async function setRequester(
  userId: string,
  canRequestLeatherRolls: boolean,
  actor: { id: string; role: Role },
) {
  if (!can(actor.role, "procurement:designate"))
    throw Errors.forbidden(
      "Only the Floor Manager or the System Admin chooses who can request leather rolls.",
    );
  const target = await findUserById(userId);
  if (!target) throw Errors.notFound("This person");
  if (target.role !== "SHOE_CONSTRUCTOR" || !target.isActive) {
    throw Errors.conflict(
      "Only an active Shoe Constructor can be allowed to request leather rolls.",
    );
  }
  if (target.canRequestLeatherRolls === canRequestLeatherRolls)
    return { id: userId, canRequestLeatherRolls };
  await runInTransaction(async (tx) => {
    await setCanRequestLeatherRolls(userId, canRequestLeatherRolls, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: canRequestLeatherRolls
        ? "procurement.leather_rolls.grant"
        : "procurement.leather_rolls.revoke",
      entity: "User",
      entityId: userId,
      before: { email: target.email, canRequestLeatherRolls: target.canRequestLeatherRolls },
      after: { email: target.email, canRequestLeatherRolls },
    });
  });
  return { id: userId, canRequestLeatherRolls };
}
