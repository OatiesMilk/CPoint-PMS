import type { Role } from "@/lib/domain";
import { checkAccountChange, generateTemporaryPassword } from "@/lib/admin-rules";
import { Errors } from "@/server/lib/errors";
import { hashPassword } from "@/server/lib/password";
import { runInTransaction } from "@/server/models/db";
import {
  countActiveUsersWithRole,
  createUser,
  findUserByEmail,
  findUserById,
  listUsers as listUserRows,
  setPassword,
  unlockUser as unlockUserRow,
  updateUser as updateUserRow,
  userCounts,
  type AdminUserRow,
} from "@/server/models/user.model";
import type { UserFormValues, UserListQuery } from "@/server/validators/user.validator";
import { recordAudit } from "./audit.service";

export const USER_PAGE_SIZE = 25;

type Actor = { id: string };
type Tx = Parameters<Parameters<typeof runInTransaction>[0]>[0];

export type UserStatus = "ACTIVE" | "DEACTIVATED" | "LOCKED";

export type AdminUser = Omit<AdminUserRow, "lockedUntil" | "lastLoginAt" | "createdAt"> & {
  status: UserStatus;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

function toAdminUser(row: AdminUserRow, now: Date): AdminUser {
  const locked = row.lockedUntil !== null && row.lockedUntil > now;
  return {
    ...row,
    status: !row.isActive ? "DEACTIVATED" : locked ? "LOCKED" : "ACTIVE",
    lockedUntil: locked ? row.lockedUntil!.toISOString() : null,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const EMAIL_TAKEN = (email: string) => ({
  path: ["email"],
  message: `${email} already has an account. Use a different email, or edit that account.`,
});

// ───────────── reads ─────────────

export async function listUsers(query: UserListQuery, now: Date = new Date()) {
  const page = query.page ?? 1;
  const { rows, total } = await listUserRows(
    { role: query.role, status: query.status, q: query.q, now },
    { skip: (page - 1) * USER_PAGE_SIZE, take: USER_PAGE_SIZE },
  );
  return {
    rows: rows.map((r) => toAdminUser(r, now)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USER_PAGE_SIZE)),
  };
}

export async function userSummary(now: Date = new Date()) {
  return userCounts(now);
}

// ───────────── writes ─────────────

/** Creates an account with a temporary password, returned once for the admin to hand over. */
export async function createAccount(values: UserFormValues, actor: Actor) {
  if (await findUserByEmail(values.email)) throw Errors.validation([EMAIL_TAKEN(values.email)]);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await runInTransaction(async (tx) => {
    const created = await createUser(
      { ...values, passwordHash, mustChangePassword: true },
      tx,
    ).catch((e: unknown) => emailTaken(e, values.email));
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "user.create",
      entity: "User",
      entityId: created.id,
      after: { name: created.name, email: created.email, role: created.role },
    });
    return created;
  });
  return { id: user.id, name: user.name, temporaryPassword };
}

function emailTaken(error: unknown, email: string): never {
  if ((error as { code?: string })?.code === "P2002") throw Errors.validation([EMAIL_TAKEN(email)]);
  throw error;
}

async function loadTarget(id: string) {
  const user = await findUserById(id);
  if (!user) throw Errors.notFound("This account");
  return user;
}

/** Re-checks the last-admin rule inside the transaction, so two admins can't race past it. */
async function assertAdminRemains(tx: Tx) {
  if ((await countActiveUsersWithRole("SYSTEM_ADMIN", tx)) === 0) {
    throw Errors.conflict(
      "This is the last active System Admin. Make another account a System Admin first.",
    );
  }
}

async function guard(
  actor: Actor,
  target: { id: string; role: Role; isActive: boolean },
  change: { role?: Role; isActive?: boolean },
) {
  const check = checkAccountChange(
    actor.id,
    target,
    change,
    await countActiveUsersWithRole("SYSTEM_ADMIN"),
  );
  if (!check.ok) throw Errors.conflict(check.reason);
}

export async function updateAccount(id: string, values: UserFormValues, actor: Actor) {
  const before = await loadTarget(id);
  await guard(actor, before, { role: values.role });
  if (values.email !== before.email) {
    const other = await findUserByEmail(values.email);
    if (other && other.id !== id) throw Errors.validation([EMAIL_TAKEN(values.email)]);
  }
  // Only a Shoe Constructor can be allowed leather rolls (D-031): a role change ends it.
  const endsRequester = before.canRequestLeatherRolls && values.role !== "SHOE_CONSTRUCTOR";
  return runInTransaction(async (tx) => {
    const after = await updateUserRow(
      id,
      endsRequester ? { ...values, canRequestLeatherRolls: false } : values,
      tx,
    ).catch((e: unknown) => emailTaken(e, values.email));
    if (before.role === "SYSTEM_ADMIN") await assertAdminRemains(tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "user.update",
      entity: "User",
      entityId: id,
      before: {
        name: before.name,
        email: before.email,
        role: before.role,
        ...(endsRequester ? { canRequestLeatherRolls: true } : {}),
      },
      after: {
        name: after.name,
        email: after.email,
        role: after.role,
        ...(endsRequester ? { canRequestLeatherRolls: false } : {}),
      },
    });
    return after;
  });
}

export async function setAccountActive(id: string, isActive: boolean, actor: Actor) {
  const before = await loadTarget(id);
  if (before.isActive === isActive) return;
  await guard(actor, before, { isActive });
  await runInTransaction(async (tx) => {
    await updateUserRow(id, { isActive }, tx);
    if (!isActive && before.role === "SYSTEM_ADMIN") await assertAdminRemains(tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: isActive ? "user.reactivate" : "user.deactivate",
      entity: "User",
      entityId: id,
      before: { email: before.email, isActive: before.isActive },
      after: { email: before.email, isActive },
    });
  });
}

/**
 * A new temporary password, shown once. The person must choose their own at next sign-in, and
 * every session they have open ends now (D-024).
 */
export async function resetAccountPassword(id: string, actor: Actor, now: Date = new Date()) {
  const user = await loadTarget(id);
  if (user.id === actor.id)
    throw Errors.conflict("Use Change password in your user menu for your own account.");
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await runInTransaction(async (tx) => {
    await setPassword(id, { passwordHash, mustChangePassword: true, sessionsValidFrom: now }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "user.password_reset",
      entity: "User",
      entityId: id,
      before: {
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        locked: user.lockedUntil !== null,
      },
      after: { email: user.email, mustChangePassword: true, locked: false, sessionsEnded: true },
    });
  });
  return { name: user.name, temporaryPassword };
}

export async function unlockAccount(id: string, actor: Actor) {
  const user = await loadTarget(id);
  await runInTransaction(async (tx) => {
    await unlockUserRow(id, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "user.unlock",
      entity: "User",
      entityId: id,
      before: {
        email: user.email,
        failedLoginCount: user.failedLoginCount,
        lockedUntil: user.lockedUntil,
      },
      after: { email: user.email, failedLoginCount: 0, lockedUntil: null },
    });
  });
}
