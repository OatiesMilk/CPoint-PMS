"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission, requirePurchaseRequester } from "@/server/policies/guard";
import {
  actOnRequest,
  addRemark,
  createRequest,
  setRequester,
} from "@/server/services/procurement.service";
import {
  approveSchema,
  cancelSchema,
  isRequestId,
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

/** Submit a request. Only a designated requester gets this far (D-030). */
export async function createRequestAction(input: unknown) {
  const user = await requirePurchaseRequester();
  try {
    const result = await createRequest(purchaseRequestSchema.parse(input), user);
    refresh();
    return { ok: true as const, ...result };
  } catch (error) {
    return toActionError(error, "Purchase request");
  }
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

export async function receiveRequestAction(id: string) {
  const user = await requirePermission("procurement:decide");
  return run(id, "Receive request", () => actOnRequest(id, { action: "receive" }, user));
}

/** The requester's own cancel; the service checks it's theirs and they're still designated. */
export async function cancelRequestAction(id: string, input: { note?: string }) {
  const user = await requirePermission("procurement:request");
  return run(id, "Cancel request", () =>
    actOnRequest(id, { action: "cancel", ...cancelSchema.parse(input) }, user),
  );
}

export async function addRemarkAction(id: string, input: { body: string }) {
  const user = await requirePermission("procurement:remark");
  return run(id, "Request remark", async () => {
    const remark = await addRemark(id, remarkSchema.parse(input).body, user);
    return { remarkId: remark.id };
  });
}

/** Designate a Shoe Constructor as a requester (Floor Manager or System Admin). */
export async function setRequesterAction(userId: string, canRequestMaterials: boolean) {
  const user = await requirePermission("procurement:designate");
  return run(userId, "Requester designation", () =>
    setRequester(userId, requesterSchema.parse({ canRequestMaterials }).canRequestMaterials, user),
  );
}
