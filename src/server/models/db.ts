import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/lib/prisma";

/** Either the shared client or an interactive-transaction client. Model functions accept both. */
export type Db = PrismaClient | Prisma.TransactionClient;

export function defaultDb(): Db {
  return getPrisma();
}

/**
 * Runs `fn` in one database transaction. Services wrap a mutation and its audit entry in this
 * so both commit or roll back together.
 */
export function runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(fn);
}
