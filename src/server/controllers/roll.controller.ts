import { manilaToday } from "@/lib/format";
import { AppError, Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import {
  requireApiCapture,
  requireApiPermission,
  requireApiUser,
  requireDevice,
} from "@/server/policies/guard";
import {
  addRolls,
  deviceTargetRoll,
  findRolls,
  finishRoll,
  getRollDetail,
  markPickedUp,
  moveRolls,
  rollHistory,
  setAsideRoll,
  listRollsForReport,
  openRollsForCapture,
  putBackRoll,
  readyRollsForCapture,
  removeRoll,
  rollsCsv,
  startRoll,
  updateRoll,
} from "@/server/services/roll.service";
import { capturePlan } from "@/server/services/production.service";
import { isInventoryId } from "@/server/validators/inventory.validator";
import {
  addRollsSchema,
  isRollId,
  removeRollSchema,
  rollListQuerySchema,
  updateRollSchema,
} from "@/server/validators/roll.validator";
import { canCaptureFor, can } from "@/server/policies/permissions";
import { requireApiFinder } from "./location.controller";
import {
  findQuerySchema,
  moveRollsSchema,
  putBackSchema,
  setAsideSchema,
} from "@/server/validators/location.validator";
import { ROLL_MESSAGES } from "@/lib/roll-rules";

type IdContext = { params: Promise<{ id: string }> };

/** A JSON body that may be empty (the old Put back sent none). */
async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Errors.badRequest("The request body must be valid JSON.");
  }
}

async function rollIdFrom(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!isRollId(id)) throw Errors.notFound("This roll");
  return id;
}

export const rollController = {
  /** GET /api/v1/rolls?status=&supplierId=&days=&q=&page= (Reports → Rolls, the Floor Manager). */
  index: handle(async (request: Request) => {
    await requireApiPermission("roll:read");
    const query = rollListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { rows, total, page, pageCount, scanning } = await listRollsForReport(query);
    return json({ data: rows, meta: { total, page, pageCount, scanning } });
  }),

  /**
   * GET /api/v1/reports/rolls.csv?status=&supplierId=&days=&q=: the rolls Reports → Rolls shows,
   * every page, with each roll's scanning time (D-121). The Floor Manager only.
   */
  csv: handle(async (request: Request) => {
    await requireApiPermission("roll:read");
    const query = rollListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return new Response(await rollsCsv(query), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cpoint-rolls-${manilaToday()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }),

  /**
   * POST /api/v1/inventory/{id}/rolls { receivedOn, rolls: [{ areaSqFt, tagCode? }] }: the Floor
   * Manager adds rolls to a leather item (Phase 30A). Starting a roll at Capture is
   * POST /api/v1/rolls/{id}/start; POST /api/v1/rolls answers 405 since then.
   */
  add: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("inventory:manage");
    const { id } = await ctx.params;
    if (!isInventoryId(id)) throw Errors.notFound("This item");
    const values = addRollsSchema.parse(await readJsonBody(request));
    return json({ data: await addRolls(id, values, user) }, 201);
  }),

  /** GET /api/v1/rolls/open: every roll being scanned, for the Capture page's Roll dropdown. */
  open: handle(async () => {
    const user = await requireApiCapture();
    return json({ data: await openRollsForCapture(user) });
  }),

  /**
   * GET /api/v1/rolls/plan: Capture's counter (D-118), today and the next planned days with the
   * rolls planned and scanned.
   */
  plan: handle(async () => {
    await requireApiCapture();
    return json({ data: await capturePlan() });
  }),

  /** GET /api/v1/rolls/ready: rolls in stock, not scanned yet, for Capture's Scan a roll. */
  ready: handle(async () => {
    await requireApiCapture();
    return json({ data: await readyRollsForCapture() });
  }),

  /** GET /api/v1/rolls/{id}: a roll and its shots (the Floor Manager). */
  show: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiPermission("roll:read");
    const detail = await getRollDetail(await rollIdFrom(ctx));
    if (!detail) throw Errors.notFound("This roll");
    return json({ data: detail });
  }),

  /**
   * PATCH /api/v1/rolls/{id} { expectedUpdatedAt, reason, tagCode?, receivedOn?, areaSqFt?,
   * returnNote? }: the Floor Manager corrects a roll's details (Phase 35B). The area only before
   * Finish roll; the return note only once a decision exists.
   */
  update: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("roll:manage");
    const id = await rollIdFrom(ctx);
    const input = updateRollSchema.parse(await readJsonBody(request));
    return json({ data: await updateRoll(id, input, user) });
  }),

  /** POST /api/v1/rolls/{id}/start: pick a roll at Capture; it is now being scanned. */
  start: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiCapture();
    return json({ data: await startRoll(await rollIdFrom(ctx), user) });
  }),

  /** POST /api/v1/rolls/{id}/finish: at Capture, once all of the roll is scanned. */
  finish: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiCapture();
    return json({ data: await finishRoll(await rollIdFrom(ctx), user) });
  }),

  /**
   * POST /api/v1/rolls/{id}/cancel: at Capture, put back a roll picked by mistake (no shots). A
   * roll from Inventory waits to be scanned again; one from before Phase 30A is cancelled.
   */
  cancel: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiCapture();
    const id = await rollIdFrom(ctx);
    // Where it went (Phase 32): optional, and an empty body still puts it back.
    const { locationId } = putBackSchema.parse(await readOptionalJson(request));
    return json({ data: await putBackRoll(id, user, undefined, locationId ?? null) });
  }),

  /** POST /api/v1/rolls/move { rollIds, toLocationId, note? }: the Floor Manager (Phase 32). */
  move: handle(async (request: Request) => {
    const user = await requireApiPermission("roll:move");
    const values = moveRollsSchema.parse(await readJsonBody(request));
    return json({ data: await moveRolls(values, user) });
  }),

  /**
   * POST /api/v1/rolls/{id}/set-aside { locationId }: a roll Returned to supplier is set aside for
   * the supplier (A-77), by the constructor right after Finish roll or by the Floor Manager.
   */
  setAside: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiUser();
    if (!can(user.role, "roll:move") && !canCaptureFor(user)) throw Errors.forbidden();
    const id = await rollIdFrom(ctx);
    const { locationId } = setAsideSchema.parse(await readJsonBody(request));
    return json({ data: await setAsideRoll(id, locationId, user) });
  }),

  /** POST /api/v1/rolls/{id}/picked-up: the supplier took a returned roll (A-77). */
  pickedUp: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("roll:manage");
    return json({ data: await markPickedUp(await rollIdFrom(ctx), user) });
  }),

  /** GET /api/v1/rolls/find?q=: Find roll by code, tag or a location label (Phase 32). */
  find: handle(async (request: Request) => {
    await requireApiFinder();
    const { q } = findQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json({ data: await findRolls(q) });
  }),

  /** GET /api/v1/rolls/{id}/moves: a roll's location history, newest first, no names (A-78). */
  moves: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiFinder();
    return json({ data: await rollHistory(await rollIdFrom(ctx)) });
  }),

  /** POST /api/v1/rolls/{id}/remove { reason }: the Floor Manager removes a roll (Phase 30A). */
  remove: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("roll:manage");
    const id = await rollIdFrom(ctx);
    const { reason } = removeRollSchema.parse(await readJsonBody(request));
    return json({ data: await removeRoll(id, reason, user) });
  }),

  /** GET /api/v1/rolls/current: for a device token (the simulator), where its next scan goes. */
  current: handle(async (request: Request) => {
    await requireDevice(request, "scans:create");
    const roll = await deviceTargetRoll();
    if (!roll) throw new AppError(404, "NO_OPEN_ROLL", ROLL_MESSAGES.noOpenRoll);
    const { mine: _mine, ...shown } = roll;
    void _mine;
    return json({ data: { rollId: shown.id, ...shown } });
  }),
};
