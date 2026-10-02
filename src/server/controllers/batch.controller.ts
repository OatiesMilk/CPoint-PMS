import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  cancelBatch,
  createBatch,
  getBatchDetail,
  listBatches,
  transitionBatchStage,
  updateBatch,
} from "@/server/services/batch.service";
import {
  batchFormSchema,
  batchListQuerySchema,
  cancelSchema,
  isBatchId,
  transitionSchema,
} from "@/server/validators/batch.validator";

type IdContext = { params: Promise<{ id: string }> };

async function batchIdFrom(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!isBatchId(id)) throw Errors.notFound("This batch");
  return id;
}

export const batchController = {
  /** GET /api/v1/batches?status=&stage=&shoeTypeId=&q=&page= */
  index: handle(async (request: Request) => {
    await requireApiPermission("batch:read");
    const query = batchListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { rows, total, page, pageCount } = await listBatches(query, query.page ?? 1);
    return json({ data: rows, meta: { total, page, pageCount } });
  }),

  /** POST /api/v1/batches */
  create: handle(async (request: Request) => {
    const user = await requireApiPermission("batch:manage");
    const values = batchFormSchema.parse(await readJsonBody(request));
    return json({ data: await createBatch(values, user) }, 201);
  }),

  /** GET /api/v1/batches/{id}: batch, stage logs, allowed actions, time per stage (ms). */
  show: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiPermission("batch:read");
    const detail = await getBatchDetail(await batchIdFrom(ctx));
    if (!detail) throw Errors.notFound("This batch");
    return json({ data: detail });
  }),

  /** PATCH /api/v1/batches/{id}: full form values (same shape as create). */
  update: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("batch:manage");
    const id = await batchIdFrom(ctx);
    const values = batchFormSchema.parse(await readJsonBody(request));
    return json({ data: await updateBatch(id, values, user) });
  }),

  /** POST /api/v1/batches/{id}/stages  { action, expectedStage, reason? } */
  transition: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("batch:manage");
    const id = await batchIdFrom(ctx);
    const input = transitionSchema.parse(await readJsonBody(request));
    return json({ data: await transitionBatchStage(id, input, user) });
  }),

  /** POST /api/v1/batches/{id}/cancel  { reason, expectedStage? } */
  cancel: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("batch:manage");
    const id = await batchIdFrom(ctx);
    const input = cancelSchema.parse(await readJsonBody(request));
    return json({ data: await cancelBatch(id, input, user) });
  }),
};
