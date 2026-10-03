import type { Prisma } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

export function insertAuditLog(data: Prisma.AuditLogUncheckedCreateInput, db: Db = defaultDb()) {
  return db.auditLog.create({ data });
}

// ───────────── viewer (D-024) ─────────────

export type AuditFilter = {
  actorUserId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
};

const auditSelect = {
  id: true,
  actorType: true,
  action: true,
  entity: true,
  entityId: true,
  before: true,
  after: true,
  ip: true,
  createdAt: true,
  actorUser: { select: { id: true, name: true } },
  actorToken: { select: { name: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;

export async function listAuditLogs(
  filter: AuditFilter,
  page: { skip: number; take: number },
  db: Db = defaultDb(),
) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.entity ? { entity: filter.entity } : {}),
    ...(filter.entityId ? { entityId: filter.entityId } : {}),
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lt: filter.to } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      select: auditSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...page,
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total };
}

/** The actions and entities that occur, for the filter pickers. */
export async function auditFacets(db: Db = defaultDb()) {
  const [actions, entities, actors] = await Promise.all([
    db.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    db.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    actions: actions.map((a) => a.action),
    entities: entities.map((e) => e.entity),
    actors,
  };
}

export function countAuditSince(since: Date, db: Db = defaultDb()) {
  return db.auditLog.count({ where: { createdAt: { gte: since } } });
}
