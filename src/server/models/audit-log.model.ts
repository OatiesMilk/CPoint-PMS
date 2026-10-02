import type { Prisma } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

export function insertAuditLog(data: Prisma.AuditLogUncheckedCreateInput, db: Db = defaultDb()) {
  return db.auditLog.create({ data });
}
