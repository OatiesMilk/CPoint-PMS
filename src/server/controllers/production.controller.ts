import { manilaToday } from "@/lib/format";
import { addDays } from "@/lib/report-rules";
import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  clearNonWorking,
  correctCheckIn,
  markNonWorking,
  planMonth,
  productionDays,
  productionToday,
  saveCheckIn,
  saveDayPlan,
  saveLunchBreak,
} from "@/server/services/production.service";
import {
  checkInSchema,
  correctionSchema,
  dayMarkSchema,
  dayPlanSchema,
  daysQuerySchema,
  lunchBreakSchema,
  planDaySchema,
  planMonthSchema,
} from "@/server/validators/production.validator";
import { z } from "zod";

type IdContext = { params: Promise<{ id: string }> };
type DayContext = { params: Promise<{ day: string }> };

async function planDay(ctx: DayContext) {
  const { day } = await ctx.params;
  const parsed = planDaySchema.safeParse(day);
  if (!parsed.success) throw Errors.notFound("This day");
  return parsed.data;
}

/** The mark routes take an optional body: `{ expectedUpdatedAt }`. */
async function markBody(request: Request) {
  const text = await request.text();
  let body: unknown = {};
  try {
    if (text.trim()) body = JSON.parse(text);
  } catch {
    throw Errors.badRequest("The request body must be valid JSON.");
  }
  return dayMarkSchema.parse(body);
}

/** Batches API (Phase 27; internal name production, Phase 23). Every route checks its own permission. */
export const productionController = {
  /** GET /api/v1/production/today: today's batches with their states, the lunch and the quota. */
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

  /** POST /api/v1/production/check-ins  { slotAt, pairs, failedPairs, notes? }: finish a batch */
  createCheckIn: handle(async (request: Request) => {
    const user = await requireApiPermission("production:checkin");
    const input = checkInSchema.parse(await readJsonBody(request));
    return json({ data: await saveCheckIn(input, user) }, 201);
  }),

  /** PATCH /api/v1/production/check-ins/{id}  { expectedUpdatedAt, pairs, failedPairs, reason } */
  correctCheckIn: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("production:checkin");
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw Errors.notFound("This batch");
    const input = correctionSchema.parse(await readJsonBody(request));
    return json({ data: await correctCheckIn(id, input, user) });
  }),

  /** GET /api/v1/production/plans?month=2026-11: the planning calendar's month (D-114). */
  plans: handle(async (request: Request) => {
    await requireApiPermission("production:plan");
    const q = planMonthSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json({ data: await planMonth(q.month ?? manilaToday().slice(0, 7)) });
  }),

  /**
   * PUT /api/v1/production/plans/{day}  { rollsPlanned, quota, suggestedQuota?, intervalMinutes
   * (240, or null = once at the end of the day), shiftStart, shiftEnd, expectedUpdatedAt }
   */
  savePlan: handle(async (request: Request, ctx: DayContext) => {
    const user = await requireApiPermission("production:plan");
    const day = await planDay(ctx);
    const input = dayPlanSchema.parse(await readJsonBody(request));
    return json({ data: await saveDayPlan(day, input, user) });
  }),

  /** PUT /api/v1/production/plans/{day}/non-working  { expectedUpdatedAt }: Non-working / Holiday */
  markNonWorking: handle(async (request: Request, ctx: DayContext) => {
    const user = await requireApiPermission("production:plan");
    const day = await planDay(ctx);
    return json({ data: await markNonWorking(day, await markBody(request), user) });
  }),

  /** DELETE /api/v1/production/plans/{day}/non-working  { expectedUpdatedAt }: undo the mark */
  clearNonWorking: handle(async (request: Request, ctx: DayContext) => {
    const user = await requireApiPermission("production:plan");
    const day = await planDay(ctx);
    return json({ data: await clearNonWorking(day, await markBody(request), user) });
  }),

  /** PUT /api/v1/settings/lunch-break  { startTime, endTime } or { none: true } (System Admin) */
  lunchBreak: handle(async (request: Request) => {
    const user = await requireApiPermission("settings:manage");
    const input = lunchBreakSchema.parse(await readJsonBody(request));
    return json({ data: await saveLunchBreak(input, user) });
  }),
};
