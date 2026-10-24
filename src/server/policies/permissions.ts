import type { Role } from "@/lib/domain";

/**
 * Role × permission matrix (docs/prompts/system-rebuild.md → <roles_and_modules>).
 * Pure and dependency-free so it can be unit-tested and used to build navigation.
 */
export const PERMISSIONS = {
  // Rolls in Reports (Phase 26, D-095): the Floor Manager reads every roll and may cancel an open
  // one with a reason. Starting and finishing happen at Capture (camera:capture).
  "roll:read": ["FLOOR_MANAGER"],
  "roll:manage": ["FLOOR_MANAGER"],
  "camera:view": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  // Capture on their own phones (C-23): only Shoe Constructors the System Admin allows
  // (canCapture, checked by canCaptureFor). Starting, finishing and cancelling an empty roll come
  // with it. The QI and the Floor Manager no longer capture (C-18).
  "camera:capture": ["SHOE_CONSTRUCTOR"],
  "camera:operators": ["SYSTEM_ADMIN"], // Users → More actions → May capture (amends D-075)
  "scan:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "inventory:read": ["FLOOR_MANAGER", "SYSTEM_ADMIN"],
  "inventory:manage": ["FLOOR_MANAGER"],
  "report:production": ["FLOOR_MANAGER"],
  "report:quality": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "user:manage": ["SYSTEM_ADMIN"],
  "settings:manage": ["SYSTEM_ADMIN"], // defect types, the CV rule, shoe types, suppliers
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
 * May this person capture (D-075, D-095)? A Shoe Constructor the System Admin has allowed. The
 * Capture page, the capture and roll APIs and the nav all ask this, fresh on every request.
 */
export function canCaptureFor(user: { role: Role; canCapture: boolean }): boolean {
  return can(user.role, "camera:capture") && user.canCapture;
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
