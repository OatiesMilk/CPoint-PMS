import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  saveStageAssignments,
  saveStageCount,
  stageAssignmentsFor,
  wipBoard,
} from "@/server/services/stage.service";
import { planDaySchema } from "@/server/validators/production.validator";
import { stageAssignmentsSchema, stageCountSchema } from "@/server/validators/repair.validator";

type DayContext = { params: Promise<{ day: string }> };

async function stageDay(ctx: DayContext) {
  const { day } = await ctx.params;
  const parsed = planDaySchema.safeParse(day);
  if (!parsed.success) throw Errors.notFound("This day");
  return parsed.data;
}

/** Stage assignments, counts and the work in progress board (Phase 34, D-130). */
export const stageController = {
  /** GET /api/v1/production/stages/{day}: who works at each stage, and the prefill suggestion */
  day: handle(async (_request: Request, ctx: DayContext) => {
    await requireApiPermission("stage:assign");
    return json({ data: await stageAssignmentsFor(await stageDay(ctx)) });
  }),

  /** PUT /api/v1/production/stages/{day}  { assignments: [{ stage, userIds }] } (Floor Manager) */
  saveDay: handle(async (request: Request, ctx: DayContext) => {
    const user = await requireApiPermission("stage:assign");
    const day = await stageDay(ctx);
    const input = stageAssignmentsSchema.parse(await readJsonBody(request));
    return json({ data: await saveStageAssignments(day, input, user) });
  }),

  /** POST /api/v1/production/stage-counts  { stage, pairs }: the pairs at a stage now, for today */
  count: handle(async (request: Request) => {
    const user = await requireApiPermission("stage:count");
    const input = stageCountSchema.parse(await readJsonBody(request));
    return json(
      { data: await saveStageCount({ stage: input.stage, pairs: input.pairs }, user) },
      201,
    );
  }),

  /** GET /api/v1/production/wip: the work in progress board */
  board: handle(async () => {
    const user = await requireApiPermission("stage:read");
    return json({ data: await wipBoard(user) });
  }),
};
