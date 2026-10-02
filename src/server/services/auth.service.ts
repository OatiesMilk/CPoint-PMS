import type { Role } from "@/lib/domain";
import { DUMMY_HASH, verifyPassword } from "@/server/lib/password";
import { runInTransaction } from "@/server/models/db";
import {
  findUserByEmail,
  findUserById,
  recordFailedLogin,
  recordSuccessfulLogin,
  type User,
} from "@/server/models/user.model";
import { recordAudit } from "./audit.service";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type SessionUser = { id: string; name: string; email: string; role: Role };

export type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "inactive" }
  | { ok: false; reason: "locked"; minutesLeft: number };

type RequestMeta = { ip?: string | null; userAgent?: string | null };

function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
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
  input: { email: string; password: string },
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
      request: meta,
    });
  });
  return { ok: true, user: toSessionUser(user) };
}

/** The signed-in user as of right now, or null if the account was removed or deactivated. */
export async function getActiveSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await findUserById(userId);
  return user && user.isActive ? toSessionUser(user) : null;
}

export async function recordSignOut(userId: string, meta: RequestMeta = {}): Promise<void> {
  await runInTransaction((tx) =>
    recordAudit(tx, {
      actor: { type: "USER", userId },
      action: "user.logout",
      entity: "User",
      entityId: userId,
      request: meta,
    }),
  );
}
