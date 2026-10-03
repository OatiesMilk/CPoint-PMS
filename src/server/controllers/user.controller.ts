import { Errors } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import {
  createAccount,
  listUsers,
  resetAccountPassword,
  setAccountActive,
  unlockAccount,
  updateAccount,
} from "@/server/services/user-admin.service";
import {
  isUserId,
  userActiveSchema,
  userFormSchema,
  userListQuerySchema,
} from "@/server/validators/user.validator";

type IdContext = { params: Promise<{ id: string }> };

async function idFrom(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!isUserId(id)) throw Errors.notFound("This account");
  return id;
}

const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);

export const userController = {
  /** GET /api/v1/users?role=&status=active|deactivated|locked&q=&page= */
  index: handle(async (request: Request) => {
    await requireApiPermission("user:manage");
    return json({ data: await listUsers(userListQuerySchema.parse(query(request))) });
  }),

  /** POST /api/v1/users  { name, email, role } → 201 { id, name, temporaryPassword } (shown once) */
  create: handle(async (request: Request) => {
    const admin = await requireApiPermission("user:manage");
    const values = userFormSchema.parse(await readJsonBody(request));
    return json({ data: await createAccount(values, admin) }, 201);
  }),

  /** PATCH /api/v1/users/{id}  { name, email, role } or { isActive } */
  update: handle(async (request: Request, ctx: IdContext) => {
    const admin = await requireApiPermission("user:manage");
    const id = await idFrom(ctx);
    const body = await readJsonBody(request);
    const active = userActiveSchema.safeParse(body);
    if (active.success) {
      await setAccountActive(id, active.data.isActive, admin);
      return json({ data: { id, isActive: active.data.isActive } });
    }
    const updated = await updateAccount(id, userFormSchema.parse(body), admin);
    return json({ data: updated });
  }),

  /** POST /api/v1/users/{id}/reset-password → { name, temporaryPassword } (shown once) */
  resetPassword: handle(async (_request: Request, ctx: IdContext) => {
    const admin = await requireApiPermission("user:manage");
    return json({ data: await resetAccountPassword(await idFrom(ctx), admin) });
  }),

  /** POST /api/v1/users/{id}/unlock */
  unlock: handle(async (_request: Request, ctx: IdContext) => {
    const admin = await requireApiPermission("user:manage");
    const id = await idFrom(ctx);
    await unlockAccount(id, admin);
    return json({ data: { id } });
  }),
};
