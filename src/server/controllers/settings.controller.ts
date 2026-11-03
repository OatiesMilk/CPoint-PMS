import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  createReferenceRow,
  getThresholds,
  listReferenceRows,
  saveThresholds,
  setReferenceActive,
  updateReferenceRow,
} from "@/server/services/settings.service";
import {
  isReferenceId,
  referenceActiveSchema,
  thresholdsSchema,
  type ReferenceKind,
} from "@/server/validators/settings.validator";

type IdContext = { params: Promise<{ id: string }> };

export const settingsController = {
  /** GET /api/v1/settings/cv */
  getThresholds: handle(async () => {
    await requireApiPermission("settings:manage");
    return json({ data: await getThresholds() });
  }),

  /** PUT /api/v1/settings/cv  { foundPercent, earlyModelNotice? } (e.g. 50, true) */
  putThresholds: handle(async (request: Request) => {
    const admin = await requireApiPermission("settings:manage");
    const input = thresholdsSchema.parse(await readJsonBody(request));
    return json({ data: await saveThresholds(input, admin) });
  }),
};

/** GET / POST /api/v1/<kind> and PATCH /api/v1/<kind>/{id}, the same for all four lists. */
export function referenceController(kind: ReferenceKind, what: string) {
  return {
    index: handle(async () => {
      await requireApiPermission("settings:manage");
      return json({ data: await listReferenceRows(kind) });
    }),
    create: handle(async (request: Request) => {
      const admin = await requireApiPermission("settings:manage");
      return json(
        { data: await createReferenceRow(kind, await readJsonBody(request), admin) },
        201,
      );
    }),
    /** PATCH { isActive } to (de)activate, or the item's fields to edit it. */
    update: handle(async (request: Request, ctx: IdContext) => {
      const admin = await requireApiPermission("settings:manage");
      const { id } = await ctx.params;
      if (!isReferenceId(id)) throw Errors.notFound(what);
      const body = await readJsonBody(request);
      const active = referenceActiveSchema.safeParse(body);
      return json({
        data: active.success
          ? await setReferenceActive(kind, id, active.data.isActive, admin)
          : await updateReferenceRow(kind, id, body, admin),
      });
    }),
  };
}

export const defectTypeController = referenceController("defectType", "This defect type");
export const supplierController = referenceController("supplier", "This supplier");
