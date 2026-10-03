import { auditDiff, type DiffRow } from "@/lib/admin-rules";
import {
  auditFacets,
  countAuditSince,
  listAuditLogs,
  type AuditRow,
} from "@/server/models/audit-log.model";
import type { AuditQuery } from "@/server/validators/audit.validator";

export const AUDIT_PAGE_SIZE = 50;

/** Manila calendar day → UTC instant at its start (Manila is UTC+8, no DST). */
const manilaDayStart = (day: string) => new Date(`${day}T00:00:00+08:00`);
const nextDay = (day: string) => new Date(manilaDayStart(day).getTime() + 86_400_000);

/** Where an entity can be looked at in the app, if anywhere. */
function entityHref(entity: string, id: string | null): string | null {
  if (!id) return null;
  switch (entity) {
    case "Batch":
      return `/batches/${id}`;
    case "Scan":
      return `/scans/${id}`;
    case "InventoryItem":
      return `/inventory/${id}`;
    case "ReworkTicket":
      return "/rework";
    case "SalvageItem":
      return "/salvage";
    case "User":
      return "/admin/users";
    case "ApiToken":
      return "/admin/tokens";
    case "CvSettings":
      return "/admin/settings?tab=thresholds";
    case "DefectType":
      return "/admin/settings?tab=defects";
    case "ShoeType":
      return "/admin/settings?tab=shoes";
    case "Supplier":
      return "/admin/settings?tab=suppliers";
    case "ComponentType":
      return "/admin/settings?tab=components";
    default:
      return null;
  }
}

/** A human handle for the entity from its own audit values: code, name, email… */
function entityLabel(row: AuditRow): string | null {
  for (const source of [row.after, row.before]) {
    if (source && typeof source === "object" && !Array.isArray(source)) {
      const v = source as Record<string, unknown>;
      const label = v.code ?? v.sku ?? v.name ?? v.email ?? v.label ?? v.item ?? v.batch;
      if (typeof label === "string" && label) return label;
    }
  }
  return null;
}

export type AuditEntry = {
  id: string;
  createdAt: string;
  actor: string;
  actorType: AuditRow["actorType"];
  action: string;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  href: string | null;
  ip: string | null;
  diff: DiffRow[];
};

export async function listAudit(query: AuditQuery) {
  const page = query.page ?? 1;
  const { rows, total } = await listAuditLogs(
    {
      actorUserId: query.actor,
      action: query.action,
      entity: query.entity,
      entityId: query.entityId,
      from: query.from ? manilaDayStart(query.from) : undefined,
      to: query.to ? nextDay(query.to) : undefined,
    },
    { skip: (page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE },
  );
  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actor:
      r.actorType === "USER"
        ? (r.actorUser?.name ?? "Deleted user")
        : r.actorType === "DEVICE"
          ? `Device: ${r.actorToken?.name ?? "revoked token"}`
          : "System",
    actorType: r.actorType,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    entityLabel: entityLabel(r),
    href: entityHref(r.entity, r.entityId),
    ip: r.ip,
    diff: auditDiff(r.before, r.after),
  }));
  return {
    entries,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}

export function auditFilterOptions() {
  return auditFacets();
}

export function auditCountLastDay(now: Date = new Date()) {
  return countAuditSince(new Date(now.getTime() - 86_400_000));
}
