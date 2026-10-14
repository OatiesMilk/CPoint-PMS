import { POD_MAX_BYTES, POD_MAX_FILES } from "@/lib/procurement-rules";
import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { getStorage } from "@/server/lib/storage";
import { requireApiPermission } from "@/server/policies/guard";
import {
  actOnRequest,
  addDeliveryProof,
  addRemark,
  closeShort,
  createRequest,
  decideRequest,
  getProofFile,
  getRequest,
  listRequesters,
  listRequests,
  orderRequest,
  orderSuppliers,
  recordDelivery,
  requestableItems,
  setRequester,
  type UploadedFile,
} from "@/server/services/procurement.service";
import {
  approveSchema,
  cancelSchema,
  closeShortSchema,
  decideSchema,
  deliverySchema,
  isRequestId,
  orderSchema,
  purchaseRequestSchema,
  rejectSchema,
  remarkSchema,
  requesterSchema,
  requestListQuerySchema,
} from "@/server/validators/procurement.validator";

type IdContext = { params: Promise<{ id: string }> };
type UserContext = { params: Promise<{ userId: string }> };

async function idFrom(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!isRequestId(id)) throw Errors.notFound("This request");
  return id;
}

const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);

/** A little room for the form's own fields on top of the files. */
const UPLOAD_OVERHEAD = 1024 * 1024;
const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * Reads a multipart upload: the proof files under "files", and anything else as text. The size is
 * refused from the Content-Length header before the body is read. What each file really is gets
 * checked from its bytes in the service.
 */
async function readUpload(request: Request): Promise<{ form: FormData; files: UploadedFile[] }> {
  const limit = POD_MAX_FILES * POD_MAX_BYTES + UPLOAD_OVERHEAD;
  if (Number(request.headers.get("content-length") ?? 0) > limit) {
    throw Errors.tooLarge(
      `The upload is too large. Attach at most ${POD_MAX_FILES} files of ${megabytes(POD_MAX_BYTES)} MB each.`,
    );
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw Errors.badRequest(
      "Send multipart/form-data with the proof-of-delivery files in the 'files' field.",
    );
  }
  const files: UploadedFile[] = [];
  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > POD_MAX_BYTES) {
      throw Errors.validation([
        {
          path: ["files"],
          message: `“${entry.name}” is larger than ${megabytes(POD_MAX_BYTES)} MB. Attach a smaller photo or PDF.`,
        },
      ]);
    }
    files.push({ name: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) });
  }
  return { form, files };
}

/** The delivery form's fields travel as one JSON text field ("data") beside the files. */
function deliveryFields(form: FormData): unknown {
  const raw = form.get("data");
  if (typeof raw !== "string")
    throw Errors.badRequest("Send the delivery details as JSON in the 'data' field.");
  try {
    return JSON.parse(raw);
  } catch {
    throw Errors.badRequest("The 'data' field must be valid JSON.");
  }
}

/** Purchase requests (D-029, D-031, D-041 to D-045). Constructors see and act on their own only. */
export const procurementController = {
  /** GET /api/v1/procurement/requests?status=&category=&item=&from=&to=&page= */
  index: handle(async (request: Request) => {
    const user = await requireApiPermission("procurement:read");
    return json({ data: await listRequests(requestListQuerySchema.parse(query(request)), user) });
  }),

  /** POST /api/v1/procurement/requests  { neededBy, remarks?, lines[] } */
  create: handle(async (request: Request) => {
    const user = await requireApiPermission("procurement:request");
    const values = purchaseRequestSchema.parse(await readJsonBody(request));
    return json({ data: await createRequest(values, user) }, 201);
  }),

  /** GET /api/v1/procurement/requests/{id}: lines, timeline, remarks, and what you may do now. */
  show: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:read");
    const detail = await getRequest(await idFrom(ctx), user);
    if (!detail) throw Errors.notFound("This request");
    return json({ data: detail });
  }),

  /**
   * POST …/{id}/decide  { lines: [{ lineId, decision, reason? }], note? }: every item approved or
   * rejected (a reason is needed to reject), saved together (D-039).
   */
  decide: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    const input = decideSchema.parse(await readJsonBody(request));
    return json({ data: await decideRequest(await idFrom(ctx), input, user) });
  }),

  /** POST …/{id}/approve  { note? }: approves every item. */
  approve: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    const { note } = approveSchema.parse(await readJsonBody(request));
    return json({ data: await actOnRequest(await idFrom(ctx), { action: "approve", note }, user) });
  }),

  /** POST …/{id}/reject  { reason }: rejects every item with the one reason. */
  reject: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    const { reason } = rejectSchema.parse(await readJsonBody(request));
    return json({
      data: await actOnRequest(await idFrom(ctx), { action: "reject", reason }, user),
    });
  }),

  /** GET /api/v1/procurement/suppliers: active suppliers, for "Mark as ordered". */
  suppliers: handle(async () => {
    await requireApiPermission("procurement:decide");
    return json({ data: await orderSuppliers() });
  }),

  /** POST …/{id}/order  { supplierId, reference?, expectedDeliveryOn, note? } (D-041) */
  order: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    const input = orderSchema.parse(await readJsonBody(request));
    return json({ data: await orderRequest(await idFrom(ctx), input, user) });
  }),

  /**
   * POST …/{id}/deliveries  multipart: data = JSON { deliveredOn, note?, lines: [{ lineId,
   * quantity }] }, files = 1 to 5 photos or PDFs. Posts stock IN for what arrived (D-042).
   */
  deliver: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    const id = await idFrom(ctx);
    const { form, files } = await readUpload(request);
    const input = deliverySchema.parse(deliveryFields(form));
    return json({ data: await recordDelivery(id, input, files, user) }, 201);
  }),

  /** POST /api/v1/procurement/deliveries/{id}/attachments  multipart: files. Adds proof files. */
  addProof: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    const { id } = await ctx.params;
    if (!isRequestId(id)) throw Errors.notFound("This delivery");
    const { files } = await readUpload(request);
    return json({ data: await addDeliveryProof(id, files, user) }, 201);
  }),

  /**
   * GET /api/v1/procurement/attachments/{id}: a proof file. The Floor Manager, the System Admin
   * and the requester on their own request. Private, and never run as a page by the browser.
   */
  attachment: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:read");
    const { id } = await ctx.params;
    const file = isRequestId(id) ? await getProofFile(id, user) : null;
    if (!file) throw Errors.notFound("This proof file");
    let bytes: Buffer;
    try {
      bytes = await getStorage().read(file.storageKey);
    } catch {
      throw Errors.notFound("This proof file's content");
    }
    // The name was reduced to letters, digits and a few marks when it was stored; the UTF-8 form
    // covers names that aren't plain ASCII.
    const ascii = file.originalName.replace(/[^\x20-\x7e]/g, "_");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  }),

  /** POST …/{id}/close-short  { reason }: the rest of a partly received request won't come. */
  closeShort: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    const { reason } = closeShortSchema.parse(await readJsonBody(request));
    return json({ data: await closeShort(await idFrom(ctx), reason, user) });
  }),

  /**
   * POST …/{id}/cancel  { note? } or { reason }: the requester while it's pending; the Floor
   * Manager, with a reason, once it's approved or ordered and nothing has arrived (D-043).
   */
  cancel: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:read");
    const input = cancelSchema.parse(await readJsonBody(request));
    return json({
      data: await actOnRequest(await idFrom(ctx), { action: "cancel", ...input }, user),
    });
  }),

  /** POST …/{id}/remarks  { body } */
  remark: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:remark");
    const { body } = remarkSchema.parse(await readJsonBody(request));
    return json({ data: await addRemark(await idFrom(ctx), body, user) }, 201);
  }),

  /** GET /api/v1/procurement/items: the request form's picker (no movements, no people). */
  items: handle(async () => {
    const user = await requireApiPermission("procurement:request");
    return json({ data: await requestableItems(user) });
  }),

  /** GET /api/v1/procurement/requesters: active Shoe Constructors and their flag. */
  requesters: handle(async () => {
    await requireApiPermission("procurement:designate");
    return json({ data: await listRequesters() });
  }),

  /** PUT /api/v1/procurement/requesters/{userId}  { canRequestLeatherRolls }: leather rolls (D-031). */
  setRequester: handle(async (request: Request, ctx: UserContext) => {
    const user = await requireApiPermission("procurement:designate");
    const { userId } = await ctx.params;
    if (!isRequestId(userId)) throw Errors.notFound("This person");
    const { canRequestLeatherRolls } = requesterSchema.parse(await readJsonBody(request));
    return json({ data: await setRequester(userId, canRequestLeatherRolls, user) });
  }),
};
