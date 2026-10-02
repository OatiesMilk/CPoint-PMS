import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/models/db";
import { insertAuditLog } from "@/server/models/audit-log.model";

export type AuditActor =
  { type: "USER"; userId: string } | { type: "DEVICE"; tokenId: string } | { type: "SYSTEM" };

export type AuditEntry = {
  actor: AuditActor;
  action: string; // "<entity>.<verb>", e.g. "batch.create", "user.login_failed"
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: { ip?: string | null; userAgent?: string | null };
};

const SECRET_KEYS = new Set(["passwordHash", "password", "token", "tokenHash", "secret"]);

/** Deep-copies a value for the audit trail with secrets replaced by "[REDACTED]". */
export function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") return value.toJSON(); // Decimal
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        SECRET_KEYS.has(key) ? "[REDACTED]" : redact(v),
      ]),
    );
  }
  return value;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (redact(value) as Prisma.InputJsonValue);
}

/**
 * Writes one audit row. Call it with the same transaction client as the mutation it describes,
 * so the change and its audit entry commit or roll back together.
 */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  const { actor } = entry;
  await insertAuditLog(
    {
      actorType: actor.type,
      actorUserId: actor.type === "USER" ? actor.userId : null,
      actorTokenId: actor.type === "DEVICE" ? actor.tokenId : null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: toJson(entry.before),
      after: toJson(entry.after),
      ip: entry.request?.ip ?? null,
      userAgent: entry.request?.userAgent?.slice(0, 500) ?? null,
    },
    db,
  );
}
