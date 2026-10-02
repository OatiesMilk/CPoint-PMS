import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/domain";
import { auth } from "@/server/lib/auth";
import { Errors } from "@/server/lib/errors";
import type { DeviceScope } from "@/server/lib/device-token";
import { authenticateDevice, type DeviceIdentity } from "@/server/services/api-token.service";
import { getActiveSessionUser, type SessionUser } from "@/server/services/auth.service";
import { can, type Permission } from "./permissions";

/**
 * Data Access Layer: the real authorization check (src/proxy.ts only does a cookie check).
 * The session token says who you are; the database says whether you still may. So deactivating
 * a user or changing their role takes effect on their next request. Memoised per request.
 */
const getSession = cache(() => auth());

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const id = (await getSession())?.user?.id;
  return id ? getActiveSessionUser(id) : null;
});

/** Pages and server actions: the signed-in, active user, or a redirect. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const user = await getCurrentUser();
  // Valid token but the account is gone or deactivated: clear the cookie, then explain.
  if (!user) redirect("/logout?reason=deactivated");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/forbidden");
  return user;
}

/** Route handlers: same checks, but as 401/403 JSON errors instead of redirects. */
export async function requireApiPermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthenticated();
  if (!can(user.role, permission)) throw Errors.forbidden();
  return user;
}

/** Device (camera) requests: a Bearer device token with the given scope. Throws 401/403. */
export function requireDevice(request: Request, scope: DeviceScope): Promise<DeviceIdentity> {
  return authenticateDevice(request.headers.get("authorization"), scope);
}
