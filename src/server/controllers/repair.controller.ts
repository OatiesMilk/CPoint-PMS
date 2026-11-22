import { z } from "zod";
import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import { correctRepairInspection, inspectRepair } from "@/server/services/batch-queue.service";
import { changeRepair, defectSuggestions, markRepairBack } from "@/server/services/repair.service";
import {
  repairActionSchema,
  repairCorrectionSchema,
  repairInspectSchema,
} from "@/server/validators/repair.validator";

type IdContext = { params: Promise<{ id: string }> };

async function repairId(ctx: IdContext) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw Errors.notFound("This repair");
  return id;
}

/** Repairs API (Phase 34, D-130). Every route checks its own permission. */
export const repairController = {
  /** GET /api/v1/production/defect-suggestions: the usual answer per final defect type (A-76) */
  suggestions: handle(async () => {
    await requireApiPermission("production:checkin");
    return json({ data: await defectSuggestions() });
  }),

  /**
   * PATCH /api/v1/production/repairs/{id}  { action: "back" } (the stage's constructor or the
   * Floor Manager) | { action: "move", stage, reason } | { action: "notFixable", reason }
   * (Floor Manager, until it is back)
   */
  update: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("repair:update");
    const id = await repairId(ctx);
    const input = repairActionSchema.parse(await readJsonBody(request));
    if (input.action === "back") return json({ data: await markRepairBack(id, user) });
    await requireApiPermission("repair:manage");
    return json({ data: await changeRepair(id, input, user) });
  }),

  /** POST /api/v1/production/repairs/{id}/inspect  { passedPairs, scrappedPairs, resend: [{ stage, pairs }] } */
  inspect: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("production:checkin");
    const id = await repairId(ctx);
    const input = repairInspectSchema.parse(await readJsonBody(request));
    return json({ data: await inspectRepair(id, input, user) });
  }),

  /**
   * PATCH /api/v1/production/repairs/{id}/inspect  { passedPairs, scrappedPairs, resend, reason,
   * expectedUpdatedAt }: the Floor Manager corrects an inspection while the pairs it sent back are
   * still At stage (Phase 35B, A-105).
   */
  correctInspection: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("repair:manage");
    const id = await repairId(ctx);
    const input = repairCorrectionSchema.parse(await readJsonBody(request));
    return json({ data: await correctRepairInspection(id, input, user) });
  }),
};
