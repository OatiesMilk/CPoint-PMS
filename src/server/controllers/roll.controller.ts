import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import {
  requireApiCapture,
  requireApiPermission,
  requireApiUser,
  requireDevice,
} from "@/server/policies/guard";
import { can, canCaptureFor } from "@/server/policies/permissions";
import {
  cancelRoll,
  deviceTargetRoll,
  finishRoll,
  getRollDetail,
  listRollsForReport,
  openRollsForCapture,
  startRoll,
} from "@/server/services/roll.service";
import {
  isRollId,
  managerCancelSchema,
  rollListQuerySchema,
  startRollSchema,
  type StartRollValues,
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
    const { rows, total, page, pageCount } = await listRollsForReport(query);
    return json({ data: rows, meta: { total, page, pageCount } });
  }),

  /** POST /api/v1/rolls { supplierId, tagCode? }: start a roll at Capture. */
  create: handle(async (request: Request) => {
    const user = await requireApiCapture();
    const values = startRollSchema.parse(await readJsonBody(request)) as StartRollValues;
    return json({ data: await startRoll(values, user) }, 201);
  }),

  /** GET /api/v1/rolls/open: every open roll, for the Capture page's Roll dropdown. */
  open: handle(async () => {
    const user = await requireApiCapture();
    return json({ data: await openRollsForCapture(user) });
  }),

  /** GET /api/v1/rolls/{id}: a roll and its shots (the Floor Manager). */
  show: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiPermission("roll:read");
    const detail = await getRollDetail(await rollIdFrom(ctx));
    if (!detail) throw Errors.notFound("This roll");
    return json({ data: detail });
  }),

  /** POST /api/v1/rolls/{id}/finish: at Capture, once all of the roll is scanned. */
  finish: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiCapture();
    return json({ data: await finishRoll(await rollIdFrom(ctx), user) });
  }),

  /**
   * POST /api/v1/rolls/{id}/cancel { reason? }. The Floor Manager cancels any open roll with a
   * reason; someone at Capture cancels only an empty roll.
   */
  cancel: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiUser();
    const id = await rollIdFrom(ctx);
    if (can(user.role, "roll:manage")) {
      const { reason } = managerCancelSchema.parse(await readJsonBody(request));
      return json({ data: await cancelRoll(id, { by: "manager", reason }, user) });
    }
    if (!canCaptureFor(user)) throw Errors.forbidden();
    return json({ data: await cancelRoll(id, { by: "capture" }, user) });
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
