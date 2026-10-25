import type { Role } from "@/lib/domain";
import { Errors } from "@/server/lib/errors";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/lib/password";
import { runInTransaction } from "@/server/models/db";
import {
  findUserByEmail,
  findUserById,
  isSessionRevoked,
  recordFailedLogin,
  revokeSession,
  recordSuccessfulLogin,
  setPassword,
  type User,
} from "@/server/models/user.model";
import { recordAudit } from "./audit.service";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Set by an admin reset or for a new account: the user must choose a password first (D-024). */
  mustChangePassword: boolean;
  /** Has camera access (D-075, Phase 26). Read from the database on every request, like the role. */
  canCapture: boolean;
};

export type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "inactive" }
  | { ok: false; reason: "locked"; minutesLeft: number };

type RequestMeta = { ip?: string | null; userAgent?: string | null };

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    canCapture: user.canCapture,
  };
}

/** What the login form says for a refused sign-in, by its error code (never which part was wrong). */
export function loginErrorMessage(code: string): string {
  if (code === "inactive") {
    return "This account is deactivated. Ask a System Admin to reactivate it.";
  }
  if (code.startsWith("locked:")) {
    const minutes = Number(code.split(":")[1]) || 15;
    return `Too many wrong passwords. This account is locked for ${minutes} more minute${minutes === 1 ? "" : "s"}. Ask a System Admin if you need in sooner.`;
  }
  return "Email or password is incorrect. Check both and try again. After 5 wrong tries the account locks for 15 minutes.";
}

function minutesUntil(date: Date, now: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 60_000));
}

/**
 * Checks an email + password. Locks the account for LOCK_MINUTES after MAX_FAILED_ATTEMPTS wrong
 * passwords. Unknown emails still run a bcrypt compare, so timing doesn't reveal which accounts
 * exist, and they get the same "invalid" answer as a wrong password.
 */
export async function verifyCredentials(
  input: { email: string; password: string; method?: "demo" },
  meta: RequestMeta = {},
  now: Date = new Date(),
): Promise<SignInResult> {
  const email = input.email.trim().toLowerCase();
  const user = await findUserByEmail(email);

  if (!user) {
    await verifyPassword(input.password, DUMMY_HASH);
    await runInTransaction((tx) =>
      recordAudit(tx, {
        actor: { type: "SYSTEM" },
        action: "user.login_failed",
        entity: "User",
        after: { email, reason: "unknown_email" },
        request: meta,
      }),
    );
    return { ok: false, reason: "invalid" };
  }

  const lockActive = user.lockedUntil !== null && user.lockedUntil > now;
  if (lockActive) {
    return { ok: false, reason: "locked", minutesLeft: minutesUntil(user.lockedUntil!, now) };
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);

  if (!passwordOk) {
    // An expired lock starts a fresh count, so one more mistake doesn't immediately re-lock.
    const previous = user.lockedUntil ? 0 : user.failedLoginCount;
    const failedLoginCount = previous + 1;
    const locks = failedLoginCount >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = locks ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;
    await runInTransaction(async (tx) => {
      await recordFailedLogin(user.id, { failedLoginCount, lockedUntil }, tx);
      await recordAudit(tx, {
        actor: { type: "USER", userId: user.id },
        action: locks ? "user.locked" : "user.login_failed",
        entity: "User",
        entityId: user.id,
        after: { failedLoginCount, lockedUntil },
        request: meta,
      });
    });
    return locks
      ? { ok: false, reason: "locked", minutesLeft: LOCK_MINUTES }
      : { ok: false, reason: "invalid" };
  }

  if (!user.isActive) {
    await runInTransaction((tx) =>
      recordAudit(tx, {
        actor: { type: "USER", userId: user.id },
        action: "user.login_failed",
        entity: "User",
        entityId: user.id,
        after: { reason: "inactive" },
        request: meta,
      }),
    );
    return { ok: false, reason: "inactive" };
  }

  await runInTransaction(async (tx) => {
    await recordSuccessfulLogin(user.id, now, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: user.id },
      action: "user.login",
      entity: "User",
      entityId: user.id,
      // A demo sign-in from the login page (D-101) says so; a normal one has no `after`.
      ...(input.method === "demo" ? { after: { method: "demo" } } : {}),
      request: meta,
    });
  });
  return { ok: true, user: toSessionUser(user) };
}

export type SessionState =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "deactivated" | "password-reset" | "signed-out" };

/**
 * The signed-in user as of right now. A session ends when the account is removed or deactivated
 * (D-016), when its password was reset or changed after this session signed in (D-024), or when
 * this session signed out (its `sid` is revoked, D-025).
 * `authAt` is the sign-in time from the token; tokens from before D-024 have none.
 */
export async function checkSession(
  userId: string,
  authAt?: number,
  sid?: string,
): Promise<SessionState> {
  const [user, revoked] = await Promise.all([
    findUserById(userId),
    sid ? isSessionRevoked(sid) : false,
  ]);
  if (!user || !user.isActive) return { ok: false, reason: "deactivated" };
  // Signed out on this device: a late response may have restored the cookie; it's still over.
  if (revoked) return { ok: false, reason: "signed-out" };
  if (user.sessionsValidFrom && (authAt ?? 0) < user.sessionsValidFrom.getTime()) {
    return { ok: false, reason: "password-reset" };
  }
  return { ok: true, user: toSessionUser(user) };
}

/** The signed-in user as of right now, or null if their session has ended (see checkSession). */
export async function getActiveSessionUser(
  userId: string,
  authAt?: number,
): Promise<SessionUser | null> {
  const state = await checkSession(userId, authAt);
  return state.ok ? state.user : null;
}

/** Session lifetime (auth.config SESSION_MAX_AGE_SECONDS): a revocation is useless after this. */
const REVOCATION_TTL_MS = 12 * 3_600_000;

/**
 * Signs a session out server-side: its `sid` is revoked, so the JWT is refused even if a stale
 * cookie comes back (a late prefetch response can restore it, D-025). Other devices stay signed in.
 */
export async function recordSignOut(
  userId: string,
  meta: RequestMeta = {},
  sid?: string,
  now: Date = new Date(),
): Promise<void> {
  await runInTransaction(async (tx) => {
    if (sid) {
      await revokeSession(
        { sid, userId, expiresAt: new Date(now.getTime() + REVOCATION_TTL_MS) },
        now,
        tx,
      );
    }
    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: "user.logout",
      entity: "User",
      entityId: userId,
      request: meta,
    });
  });
}

/**
 * The signed-in user chooses a new password (D-024). It clears `mustChangePassword` and ends their
 * other sessions; the caller signs this one in again with the new password.
 */
export async function changeOwnPassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
  meta: RequestMeta = {},
  now: Date = new Date(),
): Promise<{ email: string }> {
  const user = await findUserById(userId);
  if (!user || !user.isActive) throw Errors.unauthenticated();
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw Errors.validation([
      {
        path: ["currentPassword"],
        message: "That's not your current password. Check and try again.",
      },
    ]);
  }
  const passwordHash = await hashPassword(input.newPassword);
  await runInTransaction(async (tx) => {
    await setPassword(
      userId,
      { passwordHash, mustChangePassword: false, sessionsValidFrom: now },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: "user.password_change",
      entity: "User",
      entityId: userId,
      before: { mustChangePassword: user.mustChangePassword },
      after: { mustChangePassword: false, otherSessionsEnded: true },
      request: meta,
    });
  });
  return { email: user.email };
}
