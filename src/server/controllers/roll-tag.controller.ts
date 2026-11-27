import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  addRollTag,
  editRollTag,
  getRollTag,
  listRollTags,
  removeRollTag,
} from "@/server/services/roll-tag.service";
import {
  addRollTagSchema,
  editRollTagSchema,
  isRollTagId,
} from "@/server/validators/roll-tag.validator";

type IdContext = { params: Promise<{ id: string }> };

async function tagIdFrom(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!isRollTagId(id)) throw Errors.notFound("This tag");
  return id;
}

/** Roll tags (Phase 42, D-139): the Floor Manager's list whose codes start every roll code. */
export const rollTagController = {
  /** GET /api/v1/roll-tags?active=false: the roll tags (active only by default). */
  index: handle(async (request: Request) => {
    await requireApiPermission("inventory:read");
    const all = new URL(request.url).searchParams.get("active") === "false";
    return json({ data: await listRollTags({ activeOnly: !all }) });
  }),

  /** POST /api/v1/roll-tags { code, supplierId?, isDefault? }: the Floor Manager adds one. */
  create: handle(async (request: Request) => {
    const user = await requireApiPermission("inventory:manage");
    const values = addRollTagSchema.parse(await readJsonBody(request));
    return json({ data: await addRollTag(values, user) }, 201);
  }),

  /** GET /api/v1/roll-tags/{id}. */
  show: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiPermission("inventory:read");
    const tag = await getRollTag(await tagIdFrom(ctx));
    if (!tag) throw Errors.notFound("This tag");
    return json({ data: tag });
  }),

  /** PATCH /api/v1/roll-tags/{id} { code?, supplierId?, isDefault?, isActive? }. */
  update: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("inventory:manage");
    const id = await tagIdFrom(ctx);
    const values = editRollTagSchema.parse(await readJsonBody(request));
    return json({ data: await editRollTag(id, values, user) });
  }),

  /** DELETE /api/v1/roll-tags/{id}: a tag no roll was made from; otherwise deactivate it. */
  remove: handle(async (_request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("inventory:manage");
    await removeRollTag(await tagIdFrom(ctx), user);
    return json({ data: { removed: true } });
  }),
};
