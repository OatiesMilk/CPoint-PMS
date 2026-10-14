import { randomUUID } from "node:crypto";
import { PAGE_SIZE } from "@/lib/pagination";
import type { PurchaseLineDecision, PurchaseRequestStatus, Role } from "@/lib/domain";
import { formatCalendarDate, manilaToday, manilaYear } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory-rules";
import {
  ACTION_VERB,
  calendarDay,
  daysLeftLabel,
  decisionEventNote,
  decisionSummary,
  deriveReceiptStatus,
  deriveRequestStatus,
  EXPECTED_DELIVERY_MAX_DAYS,
  formatRequestCode,
  isDeliveryLate,
  isWellStocked,
  NEEDED_BY_MAX_DAYS,
  outstandingQuantity,
  POD_MAX_BYTES,
  POD_MAX_FILES,
  shortfallNote,
  STATUS_LABELS,
  suggestedDecision,
  transition,
  urgencyCutoffs,
  urgencyDateRange,
  urgencyOf,
  wellStockedReason,
  type LineOutcome,
  type PurchaseAction,
  type Urgency,
} from "@/lib/procurement-rules";
import { addDays, manilaDayStart } from "@/lib/report-rules";
import {
  safeAttachmentName,
  sniffAttachmentType,
  type AttachmentType,
} from "@/server/lib/attachment-type";
import { AppError, Errors } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { getStorage, type StorageService } from "@/server/lib/storage";
import { runInTransaction } from "@/server/models/db";
import { findInventoryItem, listRequestableItems } from "@/server/models/inventory.model";
import {
  addReceivedQuantity,
  findAttachment,
  findDelivery,
  findRequestDetail,
  insertAttachments,
  insertDelivery,
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
  setLineDecision,
  transitionStatus,
  type NewAttachment,
  type RequestDetailRow,
  type RequestListRow,
} from "@/server/models/procurement.model";
import { findSupplier, listActiveSuppliers } from "@/server/models/reference-data.model";
import { findUserById } from "@/server/models/user.model";
import {
  can,
  canRequestLeatherRollsFor,
  mayActOnRequest,
  mayCopyRequest,
  mayRemarkOnRequest,
} from "@/server/policies/permissions";
import type {
  DeliveryValues,
  OrderValues,
  PurchaseRequestValues,
  RequestListQuery,
} from "@/server/validators/procurement.validator";
import { recordAudit } from "./audit.service";
import { postMovement } from "./inventory.service";

/**
 * Material requests and procurement (D-029, D-031, D-035 to D-045). A Shoe Constructor asks
 * (leather rolls only if allowed), or the Floor Manager raises a restock request. The Floor
 * Manager approves or rejects each item, marks the request as ordered from a supplier, then
 * records each delivery with its proof files; every delivery posts stock IN through the inventory
 * ledger (D-023) in the same transaction. Every change writes a timeline event and an audit row.
 * Urgency and "delivery late" are worked out on every read.
 */

export type Viewer = { id: string; role: Role; canRequestLeatherRolls: boolean };

export const REQUEST_PAGE_SIZE = PAGE_SIZE;

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
  /** An open request already asking for it ("MR-2026-0007 already asks for this"). */
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
      "Only Shoe Constructors and the Floor Manager send requests. Ask one of them to send it for you.",
    );
  // Copy to a new request (D-044): only your own, and only once it's rejected or cancelled.
  const source = values.copiedFromId ? await findRequestDetail(values.copiedFromId) : null;
  if (
    values.copiedFromId &&
    (!source || !visibleTo(source, actor) || !mayCopyRequest(actor, source))
  )
    throw Errors.conflict(
      "Only your own rejected or cancelled requests can be copied. Send this as a new request instead.",
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
        copiedFromId: source?.id ?? null,
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
        note: source ? `Copied from ${source.code}.` : null,
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
        ...(source ? { copiedFrom: source.code } : {}),
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
  | { action: "cancel"; note?: string; reason?: string };

const REFUSED: Record<PurchaseAction, string> = {
  approve: "Only the Floor Manager can approve requests. Ask them to decide this one.",
  reject: "Only the Floor Manager can reject requests. Ask them to decide this one.",
  cancel: "Only the person who sent this request can cancel it. Ask them, or add a remark.",
  order: "Only the Floor Manager can mark a request as ordered. Ask them to place the order.",
  receive: "Only the Floor Manager can record a delivery. Tell them the delivery arrived.",
  close_short: "Only the Floor Manager can close a request short. Ask them, or add a remark.",
};
const CANCEL_AFTER_APPROVAL_REFUSED =
  "Only the Floor Manager can cancel a request after it's approved. Ask them, or add a remark.";

export type LineDecisionInput = {
  lineId: string;
  decision: LineOutcome;
  reason?: string;
};

/**
 * The Floor Manager's decision on every item of a pending request (D-039), saved together: each
 * item approved, or rejected with a reason. The request's status follows from the items: approved
 * if at least one is, rejected if every one is. Conditional on PENDING (409 STALE), one timeline
 * event listing the items, one audit row.
 */
export async function decideRequest(
  id: string,
  input: { lines: LineDecisionInput[]; note?: string },
  actor: Viewer,
  now: Date = new Date(),
) {
  const request = await findRequestDetail(id);
  if (!request || !visibleTo(request, actor)) throw Errors.notFound("This request");
  if (!mayActOnRequest(actor, request, "approve")) throw Errors.forbidden(REFUSED.approve);
  if (request.status !== "PENDING") {
    throw Errors.conflict(
      `Only a pending request can be decided. This one is ${STATUS_LABELS[request.status].toLowerCase()}.`,
    );
  }

  // Every item of the request gets exactly one decision; nothing else is accepted.
  const known = new Set(request.lines.map((l) => l.id));
  const byLine = new Map<string, LineDecisionInput>();
  const issues: { path: PropertyKey[]; message: string }[] = [];
  input.lines.forEach((line, i) => {
    if (!known.has(line.lineId) || byLine.has(line.lineId))
      issues.push({
        path: ["lines", i, "lineId"],
        message: "This item isn't on the request as you saw it. Refresh the page and decide again.",
      });
    else byLine.set(line.lineId, line);
  });
  const decided = request.lines.map((line, i) => {
    const choice = byLine.get(line.id);
    if (!choice) {
      issues.push({
        path: ["lines", i, "decision"],
        message: `Choose Approve or Reject for ${line.itemName}.`,
      });
      return null;
    }
    const reason = choice.decision === "REJECTED" ? (choice.reason?.trim() ?? "") : null;
    if (reason !== null && reason.length < 3)
      issues.push({
        path: ["lines", i, "reason"],
        message: `Enter a reason of at least 3 characters for rejecting ${line.itemName}, so the requester knows why.`,
      });
    return { id: line.id, itemName: line.itemName, decision: choice.decision, reason };
  });
  if (issues.length) throw Errors.validation(issues);
  const lines = decided.flatMap((d) => (d ? [d] : []));

  const status = deriveRequestStatus(lines.map((l) => l.decision));
  if (status === "PENDING") throw Errors.conflict("This request has no items to decide.");
  const reasons = new Set(lines.map((l) => l.reason));
  // One reason for every item: it is the request's reason too, as a whole-request rejection was.
  const sharedReason = status === "REJECTED" && reasons.size === 1 ? lines[0].reason : null;
  const note = input.note ?? null;
  const approved = lines.filter((l) => l.decision === "APPROVED").length;
  const action = approved === lines.length ? "approve" : approved === 0 ? "reject" : "decide";

  return runInTransaction(async (tx) => {
    const count = await transitionStatus(
      id,
      "PENDING",
      {
        status,
        decidedById: actor.id,
        decidedAt: now,
        approvalNote: note,
        rejectionReason: sharedReason,
      },
      tx,
    );
    if (count !== 1) throw Errors.stale(STALE);
    for (const line of lines) {
      const changed = await setLineDecision(
        id,
        line.id,
        {
          decision: line.decision,
          rejectionReason: line.reason,
          decidedById: actor.id,
          decidedAt: now,
        },
        tx,
      );
      if (changed !== 1) throw Errors.stale(STALE);
    }
    await insertEvent(
      {
        requestId: id,
        fromStatus: "PENDING",
        toStatus: status,
        actorId: actor.id,
        note: decisionEventNote(lines, note),
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: `procurement.request.${action}`,
      entity: "PurchaseRequest",
      entityId: id,
      before: { code: request.code, status: "PENDING" },
      after: {
        code: request.code,
        status,
        ...(note ? { note } : {}),
        lines: lines.map((l) => ({
          item: l.itemName,
          decision: l.decision,
          ...(l.reason ? { reason: l.reason } : {}),
        })),
      },
    });
    const summary = decisionSummary(lines);
    return {
      id,
      code: request.code,
      status,
      message:
        approved === lines.length
          ? `${request.code} approved.`
          : approved === 0
            ? `${request.code} rejected.`
            : `${request.code} decided: ${summary.label}.`,
    };
  });
}

/**
 * Approve, reject or cancel. Approve and reject are the same decision applied to every item
 * (D-039). A pending request is cancelled by whoever sent it; an approved or ordered one by the
 * Floor Manager, with a reason, while nothing has arrived (D-043). Conditional on the status loaded
 * here (409 STALE).
 */
export async function actOnRequest(
  id: string,
  input: ActionInput,
  actor: Viewer,
  now: Date = new Date(),
) {
  const request = await findRequestDetail(id);
  if (!request || !visibleTo(request, actor)) throw Errors.notFound("This request");
  if (!mayActOnRequest(actor, request, input.action)) {
    throw Errors.forbidden(
      input.action === "cancel" && request.status !== "PENDING"
        ? CANCEL_AFTER_APPROVAL_REFUSED
        : REFUSED[input.action],
    );
  }
  const move = transition(request.status, input.action);
  if (!move.ok) throw Errors.conflict(move.reason);

  if (input.action === "approve" || input.action === "reject") {
    const lines = request.lines.map((line) =>
      input.action === "reject"
        ? { lineId: line.id, decision: "REJECTED" as const, reason: input.reason }
        : { lineId: line.id, decision: "APPROVED" as const },
    );
    return decideRequest(
      id,
      { lines, note: input.action === "approve" ? input.note : undefined },
      actor,
      now,
    );
  }

  // Cancelling an order other people are waiting on needs a reason they can read (D-043).
  const afterApproval = move.from !== "PENDING";
  const reason = (input.reason ?? input.note)?.trim() || null;
  if (afterApproval && (!reason || reason.length < 3)) {
    throw Errors.validation([
      {
        path: ["reason"],
        message:
          "Enter a reason of at least 3 characters, so the requester knows why it's cancelled.",
      },
    ]);
  }

  return runInTransaction(async (tx) => {
    const count = await transitionStatus(
      id,
      move.from,
      { status: move.to, cancelReason: reason },
      tx,
    );
    if (count !== 1) throw Errors.stale(STALE);
    await insertEvent(
      {
        requestId: id,
        fromStatus: move.from,
        toStatus: move.to,
        actorId: actor.id,
        note: reason,
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "procurement.request.cancel",
      entity: "PurchaseRequest",
      entityId: id,
      before: { code: request.code, status: move.from },
      after: { code: request.code, status: move.to, ...(reason ? { reason } : {}) },
    });
    return {
      id,
      code: request.code,
      status: move.to,
      message: `${request.code} ${ACTION_VERB.cancel}.`,
    };
  });
}

// ───────────── ordering (D-041) ─────────────

/** Active suppliers, for the "Mark as ordered" form. Kept under Settings → Suppliers. */
export function orderSuppliers() {
  return listActiveSuppliers();
}

/**
 * Mark an approved request as ordered: one supplier, an optional reference number and the date
 * the supplier expects to deliver. Nothing is sent to the supplier; this is the record of the
 * order. Conditional on APPROVED (409 STALE).
 */
export async function orderRequest(
  id: string,
  input: OrderValues,
  actor: Viewer,
  now: Date = new Date(),
) {
  const request = await findRequestDetail(id);
  if (!request || !visibleTo(request, actor)) throw Errors.notFound("This request");
  if (!mayActOnRequest(actor, request, "order")) throw Errors.forbidden(REFUSED.order);
  const move = transition(request.status, "order");
  if (!move.ok) throw Errors.conflict(move.reason);

  // The schema checks the date against the clock; this checks it against the caller's `now`.
  const today = manilaToday(now);
  if (input.expectedDeliveryOn < today) {
    throw Errors.validation([
      {
        path: ["expectedDeliveryOn"],
        message: "Expected delivery can't be in the past. Pick today or a later date.",
      },
    ]);
  }
  if (input.expectedDeliveryOn > addDays(today, EXPECTED_DELIVERY_MAX_DAYS)) {
    throw Errors.validation([
      {
        path: ["expectedDeliveryOn"],
        message: `Expected delivery can be at most ${EXPECTED_DELIVERY_MAX_DAYS} days ahead. Pick an earlier date.`,
      },
    ]);
  }
  const supplier = await findSupplier(input.supplierId);
  if (!supplier || !supplier.isActive) {
    throw Errors.validation([
      {
        path: ["supplierId"],
        message:
          "This supplier is no longer in the list. Choose another, or ask the System Admin to add it under Settings.",
      },
    ]);
  }
  const reference = input.reference ?? null;
  const note = input.note ?? null;

  return runInTransaction(async (tx) => {
    const count = await transitionStatus(
      id,
      move.from,
      {
        status: move.to,
        supplierId: supplier.id,
        orderReference: reference,
        expectedDeliveryOn: dayToDate(input.expectedDeliveryOn),
        orderNote: note,
        orderedById: actor.id,
        orderedAt: now,
      },
      tx,
    );
    if (count !== 1) throw Errors.stale(STALE);
    await insertEvent(
      {
        requestId: id,
        fromStatus: move.from,
        toStatus: move.to,
        actorId: actor.id,
        note: [
          `Ordered from ${supplier.name}${reference ? `, reference ${reference}` : ""}. Expected ${formatCalendarDate(input.expectedDeliveryOn)}.`,
          ...(note ? [note] : []),
        ].join("\n"),
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "procurement.request.order",
      entity: "PurchaseRequest",
      entityId: id,
      before: { code: request.code, status: move.from },
      after: {
        code: request.code,
        status: move.to,
        supplier: supplier.name,
        expectedDeliveryOn: input.expectedDeliveryOn,
        ...(reference ? { reference } : {}),
        ...(note ? { note } : {}),
      },
    });
    return {
      id,
      code: request.code,
      status: move.to,
      message: `${request.code} marked as ordered from ${supplier.name}.`,
    };
  });
}

// ───────────── deliveries and proof (D-042) ─────────────

/** A proof-of-delivery file as it arrives: the name the person's computer gave it, and its bytes. */
export type UploadedFile = { name: string; bytes: Uint8Array };

type CheckedFile = { bytes: Uint8Array; type: AttachmentType; originalName: string };

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * Checks proof files by their bytes, never their names: a photo (JPEG, PNG, WebP) or a PDF, each
 * within the size limit, at least one and at most `max`. Every message names the file.
 */
function checkProofFiles(files: UploadedFile[], max: number): CheckedFile[] {
  if (files.length === 0) {
    throw Errors.validation([
      {
        path: ["files"],
        message:
          "Attach a photo or PDF of the delivery receipt. A delivery can't be recorded without proof.",
      },
    ]);
  }
  if (files.length > max) {
    throw Errors.validation([
      {
        path: ["files"],
        message: `Attach at most ${max} files here. Remove ${files.length - max} and try again.`,
      },
    ]);
  }
  const issues: { path: PropertyKey[]; message: string }[] = [];
  const checked: CheckedFile[] = [];
  for (const file of files) {
    const type = sniffAttachmentType(file.bytes);
    if (file.bytes.length > POD_MAX_BYTES)
      issues.push({
        path: ["files"],
        message: `“${file.name}” is larger than ${megabytes(POD_MAX_BYTES)} MB. Attach a smaller photo or PDF.`,
      });
    else if (!type)
      issues.push({
        path: ["files"],
        message: `“${file.name}” isn't a photo or a PDF. Attach a JPEG, PNG, WebP or PDF file.`,
      });
    else
      checked.push({
        bytes: file.bytes,
        type,
        originalName: safeAttachmentName(file.name, type.ext),
      });
  }
  if (issues.length) throw Errors.validation(issues);
  return checked;
}

function proofKey(now: Date, ext: string): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `pod/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

/** Writes the files, then runs `save`; if `save` fails, the files are removed again. */
async function withStoredProof<T>(
  files: CheckedFile[],
  now: Date,
  storage: StorageService,
  save: (stored: NewAttachment[]) => Promise<T>,
): Promise<T> {
  const stored: NewAttachment[] = [];
  try {
    for (const file of files) {
      const storageKey = proofKey(now, file.type.ext);
      await storage.put(storageKey, file.bytes);
      stored.push({
        storageKey,
        mime: file.type.mime,
        size: file.bytes.length,
        originalName: file.originalName,
      });
    }
    return await save(stored);
  } catch (error) {
    for (const { storageKey } of stored)
      await storage
        .remove(storageKey)
        .catch((err) => logger.warn({ err, storageKey }, "Could not remove orphaned proof file"));
    throw error;
  }
}

/**
 * Record a delivery on an ordered request: what arrived of each approved item this time (0 if none
 * did), the day it came, and at least one proof file. What arrived of an inventory item is posted
 * as stock IN through the ledger (D-023) in the same transaction. Anything still outstanding leaves
 * the request partly received; nothing outstanding makes it received. Conditional on the status and
 * the received quantities loaded here (409 STALE).
 */
export async function recordDelivery(
  id: string,
  input: DeliveryValues,
  files: UploadedFile[],
  actor: Viewer,
  now: Date = new Date(),
  storage: StorageService = getStorage(),
) {
  const request = await findRequestDetail(id);
  if (!request || !visibleTo(request, actor)) throw Errors.notFound("This request");
  if (!mayActOnRequest(actor, request, "receive")) throw Errors.forbidden(REFUSED.receive);
  const move = transition(request.status, "receive");
  if (!move.ok) throw Errors.conflict(move.reason);

  const issues: { path: PropertyKey[]; message: string }[] = [];
  const today = manilaToday(now);
  const orderedOn = request.orderedAt ? manilaToday(request.orderedAt) : null;
  if (input.deliveredOn > today)
    issues.push({
      path: ["deliveredOn"],
      message: "Delivered on can't be in the future. Pick today or the day it arrived.",
    });
  else if (orderedOn && input.deliveredOn < orderedOn)
    issues.push({
      path: ["deliveredOn"],
      message: `Delivered on can't be before the order was placed (${formatCalendarDate(orderedOn)}). Pick that day or a later one.`,
    });

  // Every approved item gets exactly one quantity; nothing else is accepted.
  const approved = request.lines.filter((l) => l.decision === "APPROVED");
  const known = new Set(approved.map((l) => l.id));
  const byLine = new Map<string, { quantity: number; index: number }>();
  input.lines.forEach((line, index) => {
    if (!known.has(line.lineId) || byLine.has(line.lineId))
      issues.push({
        path: ["lines", index, "lineId"],
        message:
          "This item isn't on the request as you saw it. Refresh the page and record the delivery again.",
      });
    else byLine.set(line.lineId, { quantity: line.quantity, index });
  });
  const arrived = approved.map((line, i) => {
    const entry = byLine.get(line.id);
    const seen = Number(line.receivedQuantity);
    const outstanding = outstandingQuantity(Number(line.quantity), seen);
    if (!entry) {
      issues.push({
        path: ["lines", i, "quantity"],
        message: `Enter what arrived of ${line.itemName}, or 0 if none of it came.`,
      });
      return { line, seen, quantity: 0 };
    }
    if (entry.quantity > outstanding)
      issues.push({
        path: ["lines", entry.index, "quantity"],
        message:
          outstanding === 0
            ? `All of ${line.itemName} has already arrived. Enter 0 for it.`
            : `Received quantity can't be more than the ${formatQuantity(outstanding, line.unit)} still outstanding.`,
      });
    return { line, seen, quantity: entry.quantity };
  });
  if (issues.length === 0 && arrived.every((a) => a.quantity === 0))
    issues.push({
      path: ["lines"],
      message:
        "Enter what arrived for at least one item. If nothing came, there is no delivery to record.",
    });
  if (issues.length) throw Errors.validation(issues);
  const checked = checkProofFiles(files, POD_MAX_FILES);

  const after = approved.map((line) => {
    const got = arrived.find((a) => a.line.id === line.id)!;
    return {
      itemName: line.itemName,
      unit: line.unit,
      decision: line.decision,
      quantity: Number(line.quantity),
      receivedQuantity: Math.round((got.seen + got.quantity) * 100) / 100,
    };
  });
  const status = deriveReceiptStatus(after);
  const note = input.note ?? null;
  const came = arrived.filter((a) => a.quantity > 0);
  const typed = came.filter((a) => !a.line.item).map((a) => a.line.itemName);
  const stillToCome = shortfallNote(after);
  const eventNote = [
    `Arrived: ${came.map((a) => `${formatQuantity(a.quantity, a.line.unit)} of ${a.line.itemName}`).join(", ")}.`,
    ...(stillToCome ? [`Still to come: ${stillToCome}.`] : []),
    ...(typed.length ? [`Not in inventory, so not added to stock: ${typed.join(", ")}.`] : []),
    ...(note ? [note] : []),
  ].join("\n");

  return withStoredProof(checked, now, storage, (attachments) =>
    runInTransaction(async (tx) => {
      const count = await transitionStatus(
        id,
        move.from,
        { status, ...(status === "RECEIVED" ? { receivedAt: now } : {}) },
        tx,
      );
      if (count !== 1) throw Errors.stale(STALE);

      const lines: { lineId: string; quantity: number; movementId: string | null }[] = [];
      for (const { line, seen, quantity } of arrived) {
        // Also for 0: the update is the check that nobody else recorded a delivery meanwhile.
        const changed = await addReceivedQuantity(id, line.id, seen, quantity, tx);
        if (changed !== 1) throw Errors.stale(STALE);
        if (quantity === 0) continue;
        let movementId: string | null = null;
        if (line.item) {
          const posted = await postMovement(
            tx,
            {
              id: line.item.id,
              sku: line.item.sku,
              name: line.item.name,
              unit: line.item.unit,
              quantityOnHand: Number(line.item.quantityOnHand),
            },
            { type: "IN", delta: quantity, reason: `Delivery for ${request.code}` },
            actor,
            now,
          );
          movementId = posted.movementId;
        }
        lines.push({ lineId: line.id, quantity, movementId });
      }

      const delivery = await insertDelivery(
        {
          requestId: id,
          deliveredOn: dayToDate(input.deliveredOn)!,
          note,
          recordedById: actor.id,
          createdAt: now,
          lines,
          attachments,
        },
        tx,
      );
      await insertEvent(
        {
          requestId: id,
          fromStatus: move.from,
          toStatus: status,
          actorId: actor.id,
          note: eventNote,
          deliveryId: delivery.id,
          createdAt: now,
        },
        tx,
      );
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action: "procurement.delivery.record",
        entity: "PurchaseRequest",
        entityId: id,
        before: { code: request.code, status: move.from },
        after: {
          code: request.code,
          status,
          deliveredOn: input.deliveredOn,
          received: came.map((a) => ({
            item: a.line.itemName,
            quantity: a.quantity,
            unit: a.line.unit,
            addedToStock: !!a.line.item,
          })),
          proofFiles: attachments.map((a) => a.originalName),
          ...(note ? { note } : {}),
        },
      });
      return {
        id,
        code: request.code,
        status,
        deliveryId: delivery.id,
        message:
          status === "RECEIVED"
            ? `${request.code} received in full. Stock updated.`
            : `Delivery recorded for ${request.code}. Still to come: ${stillToCome}.`,
      };
    }),
  );
}

/** How many proof files one delivery can hold, corrections included. */
const POD_MAX_FILES_PER_DELIVERY = POD_MAX_FILES * 2;

/**
 * Add proof files to a delivery that's already recorded: the way a wrong file is corrected, since
 * a proof file is never deleted (D-042). Say which one is right in a remark.
 */
export async function addDeliveryProof(
  deliveryId: string,
  files: UploadedFile[],
  actor: Viewer,
  now: Date = new Date(),
  storage: StorageService = getStorage(),
) {
  const delivery = await findDelivery(deliveryId);
  if (!delivery || !visibleTo(delivery.request, actor)) throw Errors.notFound("This delivery");
  if (!can(actor.role, "procurement:decide"))
    throw Errors.forbidden(
      "Only the Floor Manager can add proof of delivery. Hand them the receipt, or add a remark.",
    );
  const room = POD_MAX_FILES_PER_DELIVERY - delivery._count.attachments;
  if (room <= 0)
    throw Errors.conflict(
      `This delivery already has ${POD_MAX_FILES_PER_DELIVERY} proof files, the most it can hold. Say which one is right in a remark.`,
    );
  const checked = checkProofFiles(files, Math.min(POD_MAX_FILES, room));
  const { request } = delivery;

  return withStoredProof(checked, now, storage, (attachments) =>
    runInTransaction(async (tx) => {
      await insertAttachments(deliveryId, actor.id, attachments, now, tx);
      await insertEvent(
        {
          requestId: request.id,
          fromStatus: request.status,
          toStatus: request.status,
          actorId: actor.id,
          note: `Added proof of delivery: ${attachments.map((a) => a.originalName).join(", ")}.`,
          deliveryId,
          createdAt: now,
        },
        tx,
      );
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action: "procurement.delivery.add_proof",
        entity: "PurchaseRequest",
        entityId: request.id,
        after: { code: request.code, proofFiles: attachments.map((a) => a.originalName) },
      });
      return {
        id: request.id,
        code: request.code,
        added: attachments.length,
        message: `${attachments.length} proof file${attachments.length === 1 ? "" : "s"} added to ${request.code}.`,
      };
    }),
  );
}

/**
 * Close a partly received request because the rest won't come. It ends as received, marked
 * "closed short", and the timeline says what never arrived. Conditional on PARTIALLY_RECEIVED.
 */
export async function closeShort(
  id: string,
  reason: string,
  actor: Viewer,
  now: Date = new Date(),
) {
  const request = await findRequestDetail(id);
  if (!request || !visibleTo(request, actor)) throw Errors.notFound("This request");
  if (!mayActOnRequest(actor, request, "close_short")) throw Errors.forbidden(REFUSED.close_short);
  const move = transition(request.status, "close_short");
  if (!move.ok) throw Errors.conflict(move.reason);
  const missing = shortfallNote(
    request.lines.map((l) => ({
      itemName: l.itemName,
      unit: l.unit,
      decision: l.decision,
      quantity: Number(l.quantity),
      receivedQuantity: Number(l.receivedQuantity),
    })),
  );

  return runInTransaction(async (tx) => {
    const count = await transitionStatus(
      id,
      move.from,
      { status: move.to, receivedAt: now, closedShortAt: now, closedShortReason: reason },
      tx,
    );
    if (count !== 1) throw Errors.stale(STALE);
    await insertEvent(
      {
        requestId: id,
        fromStatus: move.from,
        toStatus: move.to,
        actorId: actor.id,
        note: `Closed short: ${reason}\nNever arrived: ${missing}.`,
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "procurement.request.close_short",
      entity: "PurchaseRequest",
      entityId: id,
      before: { code: request.code, status: move.from },
      after: {
        code: request.code,
        status: move.to,
        closedShort: true,
        reason,
        neverArrived: missing,
      },
    });
    return {
      id,
      code: request.code,
      status: move.to,
      message: `${request.code} ${ACTION_VERB.close_short}.`,
    };
  });
}

/**
 * A proof file, for whoever may see its request: the Floor Manager, the System Admin, and the
 * requester on their own request. Null otherwise, so the route answers 404 either way.
 */
export async function getProofFile(id: string, viewer: Viewer) {
  const file = await findAttachment(id);
  if (!file || !visibleTo(file.delivery.request, viewer)) return null;
  return { storageKey: file.storageKey, mime: file.mime, originalName: file.originalName };
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
  lines: { itemName: string; quantity: number; unit: string; decision: PurchaseLineDecision }[];
  /** "1 of 2 items approved" when some items were rejected and others approved, else null. */
  partlyApproved: string | null;
  urgency: Urgency | null;
  daysLeft: string | null;
  /** Ordered or partly received, and past its expected delivery date (D-041). */
  late: boolean;
  /** Raised by the Floor Manager, not a constructor (D-045). */
  raisedByFloorManager: boolean;
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
      lateBefore: query.late ? dayToDate(today) : undefined,
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
  const summary = decisionSummary(row.lines);
  return {
    ...row,
    ...urgencyFields(row, today),
    lines: row.lines.map((l) => ({
      itemName: l.itemName,
      unit: l.unit,
      decision: l.decision,
      quantity: Number(l.quantity),
    })),
    partlyApproved: summary.approved > 0 && summary.rejected > 0 ? summary.label : null,
    late: isDeliveryLate(row.status, row.expectedDeliveryOn, today),
    raisedByFloorManager: row.requestedBy.role === "FLOOR_MANAGER",
  };
}

export type RequestDetail = ReturnType<typeof toDetail>;

function toDetail(row: RequestDetailRow, viewer: Viewer, today: string) {
  const actions = (
    ["approve", "reject", "order", "receive", "close_short", "cancel"] as const
  ).filter((a) => mayActOnRequest(viewer, row, a) && transition(row.status, a).ok);
  const nameOf = new Map(row.lines.map((l) => [l.id, { itemName: l.itemName, unit: l.unit }]));
  const cancelMove = transition(row.status, "cancel");
  return {
    ...row,
    ...urgencyFields(row, today),
    late: isDeliveryLate(row.status, row.expectedDeliveryOn, today),
    raisedByFloorManager: row.requestedBy.role === "FLOOR_MANAGER",
    lines: row.lines.map((l) => {
      const item = l.item
        ? {
            ...l.item,
            quantityOnHand: Number(l.item.quantityOnHand),
            reorderLevel: Number(l.item.reorderLevel),
          }
        : null;
      // Stock guidance for the decision panel (D-040), from the stock as it is now. A suggestion
      // only: nothing is decided until the Floor Manager saves.
      const stock = item && { onHand: item.quantityOnHand, reorderLevel: item.reorderLevel };
      const wellStocked = !!stock && isWellStocked(stock.onHand, stock.reorderLevel);
      const quantity = Number(l.quantity);
      const receivedQuantity = Number(l.receivedQuantity);
      return {
        ...l,
        quantity,
        receivedQuantity,
        /** What is still to come of an approved item; 0 for a rejected one. */
        outstanding:
          l.decision === "APPROVED" ? outstandingQuantity(quantity, receivedQuantity) : 0,
        onHandAtRequest: num(l.onHandAtRequest),
        reorderLevelAtRequest: num(l.reorderLevelAtRequest),
        item,
        wellStocked,
        suggestedDecision: suggestedDecision(stock),
        suggestedReason:
          wellStocked && item
            ? wellStockedReason(item.quantityOnHand, item.reorderLevel, item.unit)
            : null,
      };
    }),
    deliveries: row.deliveries.map((d) => ({
      ...d,
      lines: d.lines.map((dl) => ({
        ...dl,
        quantity: Number(dl.quantity),
        itemName: nameOf.get(dl.lineId)?.itemName ?? "Item",
        unit: nameOf.get(dl.lineId)?.unit ?? "",
      })),
    })),
    /** "1 of 2 items approved", once the request is decided. */
    decided: row.lines.some((l) => l.decision !== "PENDING") ? decisionSummary(row.lines) : null,
    /** What this viewer can do now: drives the buttons, and the service checks again. */
    actions,
    /** Why the Floor Manager can't cancel right now, when a reader would expect to (D-043). */
    cancelBlocked:
      can(viewer.role, "procurement:decide") &&
      row.status === "PARTIALLY_RECEIVED" &&
      !cancelMove.ok
        ? cancelMove.reason
        : null,
    canAddProof: can(viewer.role, "procurement:decide"),
    canCopy: mayCopyRequest(viewer, row),
    canRemark: mayRemarkOnRequest(viewer, row),
  };
}

export async function getRequest(id: string, viewer: Viewer, now: Date = new Date()) {
  const row = await findRequestDetail(id);
  if (!row || !visibleTo(row, viewer)) return null;
  return toDetail(row, viewer, manilaToday(now));
}

/**
 * The Floor Manager's home card: pending requests (how many are High urgency, the oldest wait),
 * approved ones waiting to be ordered, and deliveries that are late.
 */
export function pendingRequestsCard(now: Date = new Date()) {
  const today = manilaToday(now);
  return pendingSummary(dayToDate(urgencyCutoffs(today).highThrough)!, dayToDate(today)!);
}

/**
 * The items of a rejected or cancelled request, for "Copy to a new request" (D-044). Rejected
 * items come with their reasons and start unticked. Null unless it's the viewer's own.
 */
export async function getCopySource(id: string, viewer: Viewer) {
  const row = await findRequestDetail(id);
  if (!row || !visibleTo(row, viewer) || !mayCopyRequest(viewer, row)) return null;
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    lines: row.lines.map((l) => ({
      // An item that was since deactivated can't be picked again: it is copied as a typed item.
      inventoryItemId: l.item?.isActive ? l.item.id : null,
      itemName: l.itemName,
      category: l.category,
      unit: l.unit,
      quantity: Number(l.quantity),
      note: l.note,
      rejectionReason:
        l.decision === "REJECTED" ? (l.rejectionReason ?? row.rejectionReason) : null,
    })),
  };
}
export type CopySource = NonNullable<Awaited<ReturnType<typeof getCopySource>>>;

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
