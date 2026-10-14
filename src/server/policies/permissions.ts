import type { Role } from "@/lib/domain";
import type { PurchaseAction } from "@/lib/procurement-rules";

/**
 * Role × permission matrix (docs/prompts/system-rebuild.md → <roles_and_modules>).
 * Pure and dependency-free so it can be unit-tested and used to build navigation.
 */
export const PERMISSIONS = {
  "batch:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "batch:manage": ["FLOOR_MANAGER"],
  "camera:view": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "camera:manage": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"], // choose the batch the camera feeds
  "scan:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "scan:decide": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"], // override the camera's automatic calls
  "scan:review": ["QUALITY_INSPECTOR"], // decide scans the camera flagged (D-028)
  "rework:manage": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "salvage:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "salvage:manage": ["FLOOR_MANAGER"],
  "inventory:read": ["FLOOR_MANAGER", "SYSTEM_ADMIN"],
  "inventory:manage": ["FLOOR_MANAGER"],
  "report:production": ["FLOOR_MANAGER"],
  "report:quality": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "user:manage": ["SYSTEM_ADMIN"],
  "settings:manage": ["SYSTEM_ADMIN"], // defect types, CV thresholds, shoe types, suppliers
  "token:manage": ["SYSTEM_ADMIN"],
  "audit:read": ["SYSTEM_ADMIN"],
  "system:health": ["SYSTEM_ADMIN"],
  // Procurement (D-029, D-031). Constructors see only their own requests (scoped in the service).
  "procurement:read": ["FLOOR_MANAGER", "SYSTEM_ADMIN", "SHOE_CONSTRUCTOR"],
  // Constructors ask; the Floor Manager can raise a restock request too (D-045). A constructor's
  // leather rolls also need canRequestLeatherRollsFor.
  "procurement:request": ["SHOE_CONSTRUCTOR", "FLOOR_MANAGER"],
  "procurement:decide": ["FLOOR_MANAGER"], // decide items, order, record deliveries, close short
  "procurement:remark": ["FLOOR_MANAGER", "SHOE_CONSTRUCTOR"], // constructors: own requests only
  "procurement:designate": ["FLOOR_MANAGER", "SYSTEM_ADMIN"], // who may request leather rolls
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/**
 * The permission a person needs to decide a scan (D-028). A scan the camera flagged (an unknown
 * defect class) belongs to the Quality Inspector for its whole life, before and after it's
 * resolved; any other scan can be overridden with `scan:decide`.
 */
export function requiredDecisionPermission(scan: { aiVerdict: string }): Permission {
  return scan.aiVerdict === "NEEDS_REVIEW" ? "scan:review" : "scan:decide";
}

type Requester = { role: Role; canRequestLeatherRolls: boolean };

/**
 * May this person ask for leather rolls (D-031)? Every Shoe Constructor can request the other
 * materials; leather rolls also need the per-user flag, which the Floor Manager or the System
 * Admin sets. The Floor Manager needs no extra OK for their own request (D-045). Pages, actions,
 * the API and the service all ask this one function.
 */
export function canRequestLeatherRollsFor(user: Requester): boolean {
  if (!can(user.role, "procurement:request")) return false;
  return user.role === "FLOOR_MANAGER" || user.canRequestLeatherRolls;
}

/**
 * Who may take an action on a request; `transition` checks whether its status allows it. A
 * pending request is cancelled by whoever sent it. Once it is approved or ordered, only the Floor
 * Manager cancels it (D-043).
 */
export function mayActOnRequest(
  user: Requester & { id: string },
  request: { requestedById: string; status: string },
  action: PurchaseAction,
): boolean {
  if (action === "cancel" && request.status === "PENDING")
    return request.requestedById === user.id && can(user.role, "procurement:request");
  return can(user.role, "procurement:decide");
}

/** Remarks: the Floor Manager on any request; a Shoe Constructor on their own. */
export function mayRemarkOnRequest(
  user: Requester & { id: string },
  request: { requestedById: string },
): boolean {
  if (!can(user.role, "procurement:remark")) return false;
  if (user.role === "SHOE_CONSTRUCTOR") return request.requestedById === user.id;
  return true;
}

/** Copy to a new request (D-044): your own request, once it's rejected or cancelled. */
export function mayCopyRequest(
  user: Requester & { id: string },
  request: { requestedById: string; status: string },
): boolean {
  if (!can(user.role, "procurement:request") || request.requestedById !== user.id) return false;
  return request.status === "REJECTED" || request.status === "CANCELLED";
}
