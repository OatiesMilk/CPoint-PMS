import type { Role, User } from "@/generated/prisma/client";
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

export function findFirstActiveUserWithRole(role: Role, db: Db = defaultDb()) {
  return db.user.findFirst({ where: { role, isActive: true }, orderBy: { createdAt: "asc" } });
}
