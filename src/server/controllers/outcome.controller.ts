import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import { moveReworkTicket, reworkBoard } from "@/server/services/rework.service";
import {
  assignSalvage,
  discardSalvage,
  salvageList,
  unassignSalvage,
} from "@/server/services/salvage.service";
import {
  isOutcomeId,
  reworkListQuerySchema,
  reworkMoveSchema,
  salvageAssignSchema,
  salvageDiscardSchema,
  salvageListQuerySchema,
  salvageUnassignSchema,
} from "@/server/validators/outcome.validator";

type IdContext = { params: Promise<{ id: string }> };

async function idFrom(ctx: IdContext, what: string): Promise<string> {
  const { id } = await ctx.params;
  if (!isOutcomeId(id)) throw Errors.notFound(what);
  return id;
}

const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);

export const outcomeController = {
  /** GET /api/v1/rework?batch=: the repair board (waiting, in progress, repaired in the last 7 days). */
  reworkIndex: handle(async (request: Request) => {
    await requireApiPermission("rework:manage");
    return json({ data: await reworkBoard(reworkListQuerySchema.parse(query(request)).batch) });
  }),

  /** POST /api/v1/rework/{id}/status  { move: start|done|reopen|unstart, expectedStatus, note? } */
  reworkMove: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("rework:manage");
    const id = await idFrom(ctx, "This repair");
    return json({
      data: await moveReworkTicket(id, reworkMoveSchema.parse(await readJsonBody(request)), user),
    });
  }),

  /** GET /api/v1/salvage?status=AVAILABLE|ASSIGNED|DISCARDED&batch= */
  salvageIndex: handle(async (request: Request) => {
    await requireApiPermission("salvage:read");
    const q = salvageListQuerySchema.parse(query(request));
    return json({ data: await salvageList(q.status, q.batch, q.page) });
  }),

  /** POST /api/v1/salvage/{id}/assign  { batchId, expectedStatus, note? } */
  salvageAssign: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("salvage:manage");
    const id = await idFrom(ctx, "This salvage record");
    return json({
      data: await assignSalvage(id, salvageAssignSchema.parse(await readJsonBody(request)), user),
    });
  }),

  /** POST /api/v1/salvage/{id}/unassign  { expectedStatus } */
  salvageUnassign: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("salvage:manage");
    const id = await idFrom(ctx, "This salvage record");
    return json({
      data: await unassignSalvage(
        id,
        salvageUnassignSchema.parse(await readJsonBody(request)),
        user,
      ),
    });
  }),

  /** POST /api/v1/salvage/{id}/discard  { reason, expectedStatus } */
  salvageDiscard: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("salvage:manage");
    const id = await idFrom(ctx, "This salvage record");
    return json({
      data: await discardSalvage(id, salvageDiscardSchema.parse(await readJsonBody(request)), user),
    });
  }),
};
