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
  // Procurement (D-029, D-030). Constructors see only their own requests (scoped in the service).
  "procurement:read": ["FLOOR_MANAGER", "SYSTEM_ADMIN", "SHOE_CONSTRUCTOR"],
  "procurement:request": ["SHOE_CONSTRUCTOR"], // plus the per-user flag: canSubmitPurchaseRequest
  "procurement:decide": ["FLOOR_MANAGER"], // approve, reject, mark received
  "procurement:remark": ["FLOOR_MANAGER", "SHOE_CONSTRUCTOR"], // constructors: own requests only
  "procurement:designate": ["FLOOR_MANAGER", "SYSTEM_ADMIN"], // who may request
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

type Requester = { role: Role; canRequestMaterials: boolean };

/**
 * May this person submit purchase requests (D-030)? The role grants the ability and the per-user
 * flag turns it on. Pages, actions and API routes all ask this one function.
 */
export function canSubmitPurchaseRequest(user: Requester): boolean {
  return can(user.role, "procurement:request") && user.canRequestMaterials;
}

/**
 * Who may take an action on a request, ignoring its status (`transition` checks that). Cancel is
 * the requester's own, and only while they're still a designated requester.
 */
export function mayActOnRequest(
  user: Requester & { id: string },
  request: { requestedById: string },
  action: PurchaseAction,
): boolean {
  if (action === "cancel")
    return request.requestedById === user.id && canSubmitPurchaseRequest(user);
  return can(user.role, "procurement:decide");
}

/** Remarks: the Floor Manager on any request; a designated requester on their own. */
export function mayRemarkOnRequest(
  user: Requester & { id: string },
  request: { requestedById: string },
): boolean {
  if (!can(user.role, "procurement:remark")) return false;
  if (user.role === "SHOE_CONSTRUCTOR")
    return request.requestedById === user.id && user.canRequestMaterials;
  return true;
}
