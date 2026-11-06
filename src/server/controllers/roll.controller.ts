import { manilaToday } from "@/lib/format";
import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiCapture, requireApiPermission, requireDevice } from "@/server/policies/guard";
import {
  addRolls,
  deviceTargetRoll,
  finishRoll,
  getRollDetail,
  listRollsForReport,
  openRollsForCapture,
  putBackRoll,
  readyRollsForCapture,
  removeRoll,
  rollsCsv,
  startRoll,
} from "@/server/services/roll.service";
import { capturePlan } from "@/server/services/production.service";
import { isInventoryId } from "@/server/validators/inventory.validator";
import {
  addRollsSchema,
  isRollId,
  removeRollSchema,
  rollListQuerySchema,
} from "@/server/validators/roll.validator";
import { AppError } from "@/server/lib/errors";
import { ROLL_MESSAGES } from "@/lib/roll-rules";

type IdContext = { params: Promise<{ id: string }> };

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
  cancel: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiCapture();
    return json({ data: await putBackRoll(await rollIdFrom(ctx), user) });
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
