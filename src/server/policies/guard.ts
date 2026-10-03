import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/domain";
import { auth } from "@/server/lib/auth";
import { AppError, Errors } from "@/server/lib/errors";
import type { DeviceScope } from "@/server/lib/device-token";
import { authenticateDevice, type DeviceIdentity } from "@/server/services/api-token.service";
import { checkSession, type SessionState, type SessionUser } from "@/server/services/auth.service";
import { can, type Permission } from "./permissions";

/**
 * Data Access Layer: the real authorization check (src/proxy.ts only does a cookie check).
 * The session token says who you are; the database says whether you still may. So deactivating
 * a user or changing their role takes effect on their next request. Memoised per request.
 */
const getSession = cache(() => auth());

const getSessionState = cache(async (): Promise<SessionState | null> => {
  const user = (await getSession())?.user;
  return user?.id ? checkSession(user.id, user.authAt) : null;
});

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const state = await getSessionState();
  return state?.ok ? state.user : null;
});

/**
 * Pages and server actions: the signed-in, active user, or a redirect. A user who must choose a
 * new password (D-024) is sent to /account/password first; only that page opts out.
 */
export async function requireUser(
  options: { allowPasswordChange?: boolean } = {},
): Promise<SessionUser> {
  const state = await getSessionState();
  if (!state) redirect("/login");
  // Valid token but the session has ended: clear the cookie, then explain why.
  if (!state.ok) redirect(`/logout?reason=${state.reason}`);
  if (state.user.mustChangePassword && !options.allowPasswordChange) redirect("/account/password");
  return state.user;
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
  if (user.mustChangePassword) {
    throw new AppError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Choose a new password at /account/password first.",
    );
  }
  if (!can(user.role, permission)) throw Errors.forbidden();
  return user;
}

/** Device (camera) requests: a Bearer device token with the given scope. Throws 401/403. */
export function requireDevice(request: Request, scope: DeviceScope): Promise<DeviceIdentity> {
  return authenticateDevice(request.headers.get("authorization"), scope);
}
