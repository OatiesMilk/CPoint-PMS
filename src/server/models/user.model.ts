import type { Prisma, Role, User } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

export type { User };

export function findUserByEmail(email: string, db: Db = defaultDb()) {
  return db.user.findUnique({ where: { email } });
}

export function findUserById(id: string, db: Db = defaultDb()) {
  return db.user.findUnique({ where: { id } });
}

export function countActiveUsersWithRole(role: Role, db: Db = defaultDb()) {
  return db.user.count({ where: { role, isActive: true } });
}

export type CreateUserData = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  mustChangePassword?: boolean;
};

export function createUser(data: CreateUserData, db: Db = defaultDb()) {
  return db.user.create({ data });
}

/** Records a failed sign-in: bumps the counter and optionally locks the account. */
export function recordFailedLogin(
  id: string,
  update: { failedLoginCount: number; lockedUntil: Date | null },
  db: Db = defaultDb(),
) {
  return db.user.update({ where: { id }, data: update });
}

export function recordSuccessfulLogin(id: string, at: Date, db: Db = defaultDb()) {
  return db.user.update({
    where: { id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: at },
  });
}

/** A new password hash. Ending older sessions (`sessionsValidFrom`) is the caller's choice. */
export function setPassword(
  id: string,
  data: { passwordHash: string; mustChangePassword: boolean; sessionsValidFrom: Date },
  db: Db = defaultDb(),
) {
  return db.user.update({
    where: { id },
    data: { ...data, failedLoginCount: 0, lockedUntil: null },
  });
}

export function findFirstActiveUserWithRole(role: Role, db: Db = defaultDb()) {
  return db.user.findFirst({ where: { role, isActive: true }, orderBy: { createdAt: "asc" } });
}

// ───────────── admin (D-024) ─────────────

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminSelect }>;

export type UserListFilter = {
  role?: Role;
  status?: "active" | "deactivated" | "locked";
  q?: string;
  now: Date;
};

export async function listUsers(
  filter: UserListFilter,
  page: { skip: number; take: number },
  db: Db = defaultDb(),
) {
  const where: Prisma.UserWhereInput = {
    ...(filter.role ? { role: filter.role } : {}),
    ...(filter.status === "active"
      ? { isActive: true }
      : filter.status === "deactivated"
        ? { isActive: false }
        : filter.status === "locked"
          ? { lockedUntil: { gt: filter.now } }
          : {}),
    ...(filter.q
      ? {
          OR: [
            { name: { contains: filter.q, mode: "insensitive" } },
            { email: { contains: filter.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: adminSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      ...page,
    }),
    db.user.count({ where }),
  ]);
  return { rows, total };
}

export function updateUser(
  id: string,
  data: { name?: string; email?: string; role?: Role; isActive?: boolean },
  db: Db = defaultDb(),
) {
  return db.user.update({ where: { id }, data, select: adminSelect });
}

export function unlockUser(id: string, db: Db = defaultDb()) {
  return db.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
}

/** Active accounts per role, and how many are locked right now (admin home). */
export async function userCounts(now: Date, db: Db = defaultDb()) {
  const [byRole, locked] = await Promise.all([
    db.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } }),
    db.user.count({ where: { isActive: true, lockedUntil: { gt: now } } }),
  ]);
  return { byRole: byRole.map((r) => ({ role: r.role, count: r._count._all })), locked };
}
