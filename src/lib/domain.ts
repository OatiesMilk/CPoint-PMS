/**
 * Domain enums shared by server and client code. Re-exported from Prisma's runtime-free enums
 * file so the database stays the single source of truth, plus human-readable labels.
 */
export {
  ActorType,
  DefectOutcome,
  RollStatus,
  InventoryCategory,
  MovementType,
  Role,
  ScanSource,
  Verdict,
} from "@/generated/prisma/enums";
import type { RollStatus, Role } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  FLOOR_MANAGER: "Floor Manager",
  QUALITY_INSPECTOR: "Quality Inspector",
  SYSTEM_ADMIN: "System Admin",
  SHOE_CONSTRUCTOR: "Shoe Constructor",
};

/** Each role's landing page after sign-in. */
export const ROLE_HOME: Record<Role, string> = {
  FLOOR_MANAGER: "/floor-manager",
  // The QI's one page is Batches (Phase 28, D-100).
  QUALITY_INSPECTOR: "/batches",
  SYSTEM_ADMIN: "/admin",
  // A constructor's one page is Capture (Phase 26, D-095).
  SHOE_CONSTRUCTOR: "/camera/capture",
};

export const ROLL_STATUS_LABELS: Record<RollStatus, string> = {
  OPEN: "Open",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
};
