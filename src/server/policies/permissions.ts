import type { Role } from "@/lib/domain";

/**
 * Role × permission matrix (docs/prompts/system-rebuild.md → <roles_and_modules>). Each role sees
 * only its own modules (Phase 28, D-100, C-18): the constructor Capture, the QI Batches, the Floor
 * Manager Batches, Attendance, Reports and Inventory, the System Admin the administration pages
 * only (Overview, Users, Settings, API tokens, Audit log; no Camera page since D-119).
 * Pure and dependency-free so it can be unit-tested and used to build navigation.
 */
export const PERMISSIONS = {
  // Rolls in Reports (Phase 26, D-095): the Floor Manager reads every roll and may cancel an open
  // one with a reason. Starting and finishing happen at Capture (camera:capture).
  "roll:read": ["FLOOR_MANAGER"],
  "roll:manage": ["FLOOR_MANAGER"],
  // Capture on their own phones (C-23): only Shoe Constructors the System Admin allows
  // (canCapture, checked by canCaptureFor). Starting, finishing and cancelling an empty roll come
  // with it. The QI and the Floor Manager no longer capture (C-18).
  "camera:capture": ["SHOE_CONSTRUCTOR"],
  "camera:operators": ["SYSTEM_ADMIN"], // Users → More actions → May capture (amends D-075)
  // A section's page, reached from its roll in Reports → Rolls (A-26). There is no Scans list.
  "scan:read": ["FLOOR_MANAGER"],
  "inventory:read": ["FLOOR_MANAGER"],
  // Storage locations (Phase 32, D-128): the Floor Manager adds them, prints their labels and
  // places and moves rolls (A-56); a constructor with camera access finds rolls and puts one back
  // where it was (canFindRolls).
  "location:read": ["FLOOR_MANAGER", "SHOE_CONSTRUCTOR"],
  "location:manage": ["FLOOR_MANAGER"],
  "roll:move": ["FLOOR_MANAGER"],
  "inventory:manage": ["FLOOR_MANAGER"],
  "report:production": ["FLOOR_MANAGER"],
  "report:quality": ["FLOOR_MANAGER"],
  "user:manage": ["SYSTEM_ADMIN"],
  "settings:manage": ["SYSTEM_ADMIN"], // defect types, the CV rule, suppliers, the lunch break
  "token:manage": ["SYSTEM_ADMIN"],
  "audit:read": ["SYSTEM_ADMIN"],
  "system:health": ["SYSTEM_ADMIN"],
  // Attendance, a one-day log book (D-077): the Floor Manager's alone since D-100.
  "attendance:read": ["FLOOR_MANAGER"],
  "attendance:manage": ["FLOOR_MANAGER"],
  // Batches (Phase 27, D-097 to D-099; before it production progression, D-083 to D-086): the
  // QI finishes each batch, the Floor Manager plans how often and the quota, and the Admin sets
  // the lunch break (settings:manage) without seeing Batches (D-100). The Floor Manager may finish
  // a batch only on a day no Quality Inspector is present (D-088): mayEnterCheckIns decides.
  "production:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "production:checkin": ["QUALITY_INSPECTOR", "FLOOR_MANAGER"],
  "production:plan": ["FLOOR_MANAGER"],
  // The Inspection queue (Phase 33, D-129, A-58, A-84): the Floor Manager marks a batch Urgent
  // or voids one that won't be inspected; who inspects follows production:checkin.
  "production:prioritise": ["FLOOR_MANAGER"],
  // Stages, repairs and the work in progress board (Phase 34, D-130): the Floor Manager assigns
  // constructors to stages and may count any stage or change a repair; a constructor counts the
  // stage they are assigned to today and marks its repairs Back for inspection (the service checks
  // the assignment, mayCountStage); the Floor Manager and the QI read the board.
  "stage:assign": ["FLOOR_MANAGER"],
  "stage:count": ["FLOOR_MANAGER", "SHOE_CONSTRUCTOR"],
  "stage:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"],
  "repair:update": ["FLOOR_MANAGER", "SHOE_CONSTRUCTOR"],
  "repair:manage": ["FLOOR_MANAGER"],
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
 * May this person use Find roll and read the storage locations (Phase 32, D-128)? The Floor
 * Manager, and a Shoe Constructor the System Admin has allowed to capture.
 */
export function canFindRolls(user: { role: Role; canCapture: boolean }): boolean {
  if (!can(user.role, "location:read")) return false;
  return user.role !== "SHOE_CONSTRUCTOR" || canCaptureFor(user);
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
  if (role !== "FLOOR_MANAGER") return "The Quality Inspector finishes each batch.";
  if (qiPresent === null)
    return "Take today's attendance first. You can finish batches only when it shows no Quality Inspector present.";
  return "A Quality Inspector is present today, so they finish the batches.";
}
