import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  actOnRequest,
  addRemark,
  createRequest,
  decideRequest,
  getRequest,
  listRequesters,
  listRequests,
  requestableItems,
  setRequester,
} from "@/server/services/procurement.service";
import {
  approveSchema,
  cancelSchema,
  decideSchema,
  isRequestId,
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

/** Purchase requests (D-029, D-031). Constructors see and act on their own requests only. */
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

  /** POST …/{id}/receive: posts stock IN for every approved inventory line. */
  receive: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:decide");
    return json({ data: await actOnRequest(await idFrom(ctx), { action: "receive" }, user) });
  }),

  /** POST …/{id}/cancel  { note? }: the requester only, while pending. */
  cancel: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("procurement:request");
    const { note } = cancelSchema.parse(await readJsonBody(request));
    return json({ data: await actOnRequest(await idFrom(ctx), { action: "cancel", note }, user) });
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
