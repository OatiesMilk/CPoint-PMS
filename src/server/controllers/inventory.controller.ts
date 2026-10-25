import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  createItem,
  getItemDetail,
  listItems,
  setItemActive,
  updateItem,
} from "@/server/services/inventory.service";
import {
  activeSchema,
  inventoryItemFormSchema,
  inventoryListQuerySchema,
  isInventoryId,
} from "@/server/validators/inventory.validator";

type IdContext = { params: Promise<{ id: string }> };

async function idFrom(ctx: IdContext, what: string): Promise<string> {
  const { id } = await ctx.params;
  if (!isInventoryId(id)) throw Errors.notFound(what);
  return id;
}

const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);
const pageFrom = (request: Request) =>
  Math.max(1, Math.min(10_000, Number(new URL(request.url).searchParams.get("page")) || 1));

export const inventoryController = {
  /** GET /api/v1/inventory?category=&stock=low|out&q=&inactive=1&page= */
  index: handle(async (request: Request) => {
    await requireApiPermission("inventory:read");
    return json({ data: await listItems(inventoryListQuerySchema.parse(query(request))) });
  }),

  /** POST /api/v1/inventory  { sku, name, category, unit, reorderLevel, openingStock? } */
  create: handle(async (request: Request) => {
    const user = await requireApiPermission("inventory:manage");
    const values = inventoryItemFormSchema.parse(await readJsonBody(request));
    return json({ data: await createItem(values, user) }, 201);
  }),

  /** GET /api/v1/inventory/{id}?page=: the item and a page of its stock history. */
  show: handle(async (request: Request, ctx: IdContext) => {
    await requireApiPermission("inventory:read");
    const detail = await getItemDetail(await idFrom(ctx, "This item"), pageFrom(request));
    if (!detail) throw Errors.notFound("This item");
    return json({ data: detail });
  }),

  /** PATCH /api/v1/inventory/{id}  item fields, or { isActive } to deactivate/reactivate. */
  update: handle(async (request: Request, ctx: IdContext) => {
    const user = await requireApiPermission("inventory:manage");
    const id = await idFrom(ctx, "This item");
    const body = await readJsonBody(request);
    const active = activeSchema.safeParse(body);
    if (active.success) return json({ data: await setItemActive(id, active.data.isActive, user) });
    return json({ data: await updateItem(id, inventoryItemFormSchema.parse(body), user) });
  }),

  /** GET /api/v1/inventory/{id}/movements?page= */
  movements: handle(async (request: Request, ctx: IdContext) => {
    await requireApiPermission("inventory:read");
    const detail = await getItemDetail(await idFrom(ctx, "This item"), pageFrom(request));
    if (!detail) throw Errors.notFound("This item");
    const { movements, page, pageCount } = detail;
    return json({ data: { movements, page, pageCount } });
  }),
};
