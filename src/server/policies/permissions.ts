import type { Role } from "@/lib/domain";

/**
 * Role × permission matrix (docs/prompts/system-rebuild.md → <roles_and_modules>).
 * Pure and dependency-free so it can be unit-tested and used to build navigation.
 */
export const PERMISSIONS = {
  "batch:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "batch:manage": ["FLOOR_MANAGER"],
  // Finish a roll once it is used up (D-082). Start, edit and cancel stay with batch:manage.
  "batch:finish": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "camera:view": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "camera:manage": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"], // choose the batch the camera feeds
  // Scan from the Capture page (D-066). A Shoe Constructor also needs canCapture (canCaptureFor).
  "camera:capture": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "camera:operators": ["FLOOR_MANAGER", "SYSTEM_ADMIN"], // which constructors may capture (D-075)
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
  // Attendance, a one-day log book (D-077): the Floor Manager takes it, the Admin views it.
  "attendance:read": ["FLOOR_MANAGER", "SYSTEM_ADMIN"],
  "attendance:manage": ["FLOOR_MANAGER"],
  // Production progression (D-083 to D-086): the QI counts pairs at each check-in, the Floor
  // Manager sets the schedule and the quota, and the Admin views. The Floor Manager may enter a
  // check-in only on a day no Quality Inspector is present (D-088): mayEnterCheckIns decides.
  "production:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "production:checkin": ["QUALITY_INSPECTOR", "FLOOR_MANAGER"],
  "production:plan": ["FLOOR_MANAGER"],
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

/**
 * May this person capture at the camera (D-075)? The QI and the Floor Manager always can; a Shoe
 * Constructor only when the Floor Manager or the System Admin has allowed it (the station
 * operator). The Capture page, the capture API, the current-batch API and the nav all ask this.
 */
export function canCaptureFor(user: { role: Role; canCapture: boolean }): boolean {
  if (can(user.role, "camera:capture")) return true;
  return user.role === "SHOE_CONSTRUCTOR" && user.canCapture;
}

/**
 * May this person enter or correct today's check-ins (D-084, D-088)? The Quality Inspector always
 * can. The Floor Manager only when today's attendance is taken and no Quality Inspector is marked
 * present (`qiPresent === false`); unknown attendance (`null`) isn't enough. The page, the
 * actions, the API and the service all ask this one function.
 */
export function mayEnterCheckIns(role: Role, qiPresent: boolean | null): boolean {
  if (role === "QUALITY_INSPECTOR") return true;
  return role === "FLOOR_MANAGER" && qiPresent === false;
}

/** Why the Floor Manager can't enter today's check-ins, in one sentence; null when they can. */
export function checkInCoverReason(role: Role, qiPresent: boolean | null): string | null {
  if (mayEnterCheckIns(role, qiPresent)) return null;
  if (role !== "FLOOR_MANAGER") return "The Quality Inspector enters the count at each check-in.";
  if (qiPresent === null)
    return "Take today's attendance first. You can enter check-ins only when it shows no Quality Inspector present.";
  return "A Quality Inspector is present today, so they enter the check-ins.";
}
