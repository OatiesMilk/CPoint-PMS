import { manilaToday } from "@/lib/format";
import { addDays } from "@/lib/report-rules";
import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  correctCheckIn,
  productionDays,
  productionToday,
  saveCheckIn,
  saveQuotas,
  saveSchedule,
} from "@/server/services/production.service";
import {
  checkInSchema,
  correctionSchema,
  daysQuerySchema,
  quotasSchema,
  scheduleSchema,
} from "@/server/validators/production.validator";
import { z } from "zod";

type IdContext = { params: Promise<{ id: string }> };

/** Production progression API (Phase 23). Every route checks its own permission. */
export const productionController = {
  /** GET /api/v1/production/today: today's check-ins, progress against the quota, next check-in. */
  today: handle(async () => {
    const user = await requireApiPermission("production:read");
    return json({ data: await productionToday(user) });
  }),

  /** GET /api/v1/production/days?from=&to= (default the last 14 days, at most 92). */
  days: handle(async (request: Request) => {
    await requireApiPermission("production:read");
    const q = daysQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const to = q.to ?? manilaToday();
    let from = q.from ?? addDays(to, -13);
    if (from > to) from = to;
    if (from < addDays(to, -91)) from = addDays(to, -91);
    return json({ data: await productionDays(from, to) });
  }),

  /** POST /api/v1/production/check-ins  { slotAt, counts: [{ shoeTypeId, pairs }], notes? } */
  createCheckIn: handle(async (request: Request) => {
    const user = await requireApiPermission("production:checkin");
    const input = checkInSchema.parse(await readJsonBody(request));
    return json({ data: await saveCheckIn(input, user) }, 201);
  }),

  /** PATCH /api/v1/production/check-ins/{id}  { expectedUpdatedAt, counts, reason } (same day) */
  correctCheckIn: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("production:checkin");
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw Errors.notFound("This check-in");
    const input = correctionSchema.parse(await readJsonBody(request));
    return json({ data: await correctCheckIn(id, input, user) });
  }),

  /** PUT /api/v1/production/schedule  { shiftStart, shiftEnd, intervalMinutes, workingDays } */
  schedule: handle(async (request: Request) => {
    const user = await requireApiPermission("production:plan");
    const input = scheduleSchema.parse(await readJsonBody(request));
    return json({ data: await saveSchedule(input, user) });
  }),

  /** PUT /api/v1/production/quotas  { quotas: [{ shoeTypeId, pairs, suggestedPairs? }] } */
  quotas: handle(async (request: Request) => {
    const user = await requireApiPermission("production:plan");
    const input = quotasSchema.parse(await readJsonBody(request));
    return json({ data: await saveQuotas(input, user) });
  }),
};
