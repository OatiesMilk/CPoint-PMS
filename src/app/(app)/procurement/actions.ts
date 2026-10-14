"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import {
  actOnRequest,
  addRemark,
  closeShort,
  createRequest,
  decideRequest,
  orderRequest,
  setRequester,
} from "@/server/services/procurement.service";
import {
  approveSchema,
  cancelAfterApprovalSchema,
  cancelSchema,
  closeShortSchema,
  decideSchema,
  isRequestId,
  orderSchema,
  purchaseRequestSchema,
  rejectSchema,
  remarkSchema,
  requesterSchema,
} from "@/server/validators/procurement.validator";

function refresh() {
  revalidatePath("/procurement", "layout");
  revalidatePath("/floor-manager");
  revalidatePath("/constructor");
  revalidatePath("/inventory", "layout");
  revalidatePath("/admin/users", "layout");
}

async function run<T extends object>(
  id: string,
  context: string,
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  if (!isRequestId(id)) return { ok: false, error: "This request doesn't exist." };
  try {
    const result = await fn();
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return toActionError(error, context);
  }
}

/**
 * Submit a request. Any Shoe Constructor (leather rolls need the designation, D-031), or the Floor
 * Manager raising a restock request (D-045).
 */
export async function createRequestAction(input: unknown) {
  const user = await requirePermission("procurement:request");
  try {
    const result = await createRequest(purchaseRequestSchema.parse(input), user);
    refresh();
    return { ok: true as const, ...result };
  } catch (error) {
    return toActionError(error, "Purchase request");
  }
}

/** The decision panel: every item approved or rejected, saved together (D-039). */
export async function decideRequestAction(id: string, input: unknown) {
  const user = await requirePermission("procurement:decide");
  return run(id, "Request decision", () => decideRequest(id, decideSchema.parse(input), user));
}

export async function approveRequestAction(id: string, input: { note?: string }) {
  const user = await requirePermission("procurement:decide");
  return run(id, "Approve request", () =>
    actOnRequest(id, { action: "approve", ...approveSchema.parse(input) }, user),
  );
}

export async function rejectRequestAction(id: string, input: { reason: string }) {
  const user = await requirePermission("procurement:decide");
  return run(id, "Reject request", () =>
    actOnRequest(id, { action: "reject", ...rejectSchema.parse(input) }, user),
  );
}

/** Mark an approved request as ordered from a supplier (D-041). */
export async function orderRequestAction(id: string, input: unknown) {
  const user = await requirePermission("procurement:decide");
  return run(id, "Order", () => orderRequest(id, orderSchema.parse(input), user));
}

/** Close a partly received request: the rest won't come (D-042). */
export async function closeShortAction(id: string, input: { reason: string }) {
  const user = await requirePermission("procurement:decide");
  return run(id, "Close short", () => closeShort(id, closeShortSchema.parse(input).reason, user));
}

/** The requester's own cancel of a pending request; the service checks it's theirs. */
export async function cancelRequestAction(id: string, input: { note?: string }) {
  const user = await requirePermission("procurement:request");
  return run(id, "Cancel request", () =>
    actOnRequest(id, { action: "cancel", ...cancelSchema.parse(input) }, user),
  );
}

/** The Floor Manager's cancel of an approved or ordered request, with a reason (D-043). */
export async function cancelAfterApprovalAction(id: string, input: { reason: string }) {
  const user = await requirePermission("procurement:decide");
  return run(id, "Cancel request", () =>
    actOnRequest(id, { action: "cancel", ...cancelAfterApprovalSchema.parse(input) }, user),
  );
}

/**
 * Deliveries and proof files are uploaded to the API (they're too large for a server action); the
 * form calls this afterwards so the lists, the home cards and inventory show the new stock.
 */
export async function refreshAfterDeliveryAction() {
  await requirePermission("procurement:decide");
  refresh();
}

export async function addRemarkAction(id: string, input: { body: string }) {
  const user = await requirePermission("procurement:remark");
  return run(id, "Request remark", async () => {
    const remark = await addRemark(id, remarkSchema.parse(input).body, user);
    return { remarkId: remark.id };
  });
}

/** Allow a Shoe Constructor to request leather rolls (Floor Manager or System Admin, D-031). */
export async function setRequesterAction(userId: string, canRequestLeatherRolls: boolean) {
  const user = await requirePermission("procurement:designate");
  return run(userId, "Requester designation", () =>
    setRequester(
      userId,
      requesterSchema.parse({ canRequestLeatherRolls }).canRequestLeatherRolls,
      user,
    ),
  );
}
