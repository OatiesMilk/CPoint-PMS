import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { canFindRolls } from "@/server/policies/permissions";
import { requireApiPermission, requireApiUser } from "@/server/policies/guard";
import {
  addLocation,
  editLocation,
  getLocation,
  listLocations,
} from "@/server/services/location.service";
import {
  addLocationSchema,
  editLocationSchema,
  isLocationId,
} from "@/server/validators/location.validator";

type IdContext = { params: Promise<{ id: string }> };

/** The Floor Manager, or a constructor with camera access (Put back, Find roll). */
async function requireApiFinder() {
  const user = await requireApiUser();
  if (!canFindRolls(user)) throw Errors.forbidden();
  return user;
}

async function locationIdFrom(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!isLocationId(id)) throw Errors.notFound("This location");
  return id;
}

export const locationController = {
  /** GET /api/v1/locations?active=false: the storage locations (active only by default). */
  index: handle(async (request: Request) => {
    await requireApiFinder();
    const all = new URL(request.url).searchParams.get("active") === "false";
    return json({ data: await listLocations({ activeOnly: !all }) });
  }),

  /** POST /api/v1/locations { code, name?, kind, notes? }: the Floor Manager adds one. */
  create: handle(async (request: Request) => {
    const user = await requireApiPermission("location:manage");
    const values = addLocationSchema.parse(await readJsonBody(request));
    return json({ data: await addLocation(values, user) }, 201);
  }),

  /** GET /api/v1/locations/{id}. */
  show: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiFinder();
    const location = await getLocation(await locationIdFrom(ctx));
    if (!location) throw Errors.notFound("This location");
    return json({ data: location });
  }),

  /** PATCH /api/v1/locations/{id} { code?, name?, kind?, notes?, isActive? }. */
  update: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("location:manage");
    const id = await locationIdFrom(ctx);
    const values = editLocationSchema.parse(await readJsonBody(request));
    return json({ data: await editLocation(id, values, user) });
  }),
};

export { requireApiFinder };
