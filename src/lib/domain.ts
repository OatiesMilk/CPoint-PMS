/**
 * Domain enums shared by server and client code. Re-exported from Prisma's runtime-free enums
 * file so the database stays the single source of truth, plus human-readable labels.
 */
export {
  ActorType,
  BatchStatus,
  InventoryCategory,
  MovementType,
  PurchasePriority,
  PurchaseRequestStatus,
  ReworkStatus,
  Role,
  SalvageStatus,
  ScanSource,
  ScanStatus,
  Stage,
  Verdict,
} from "@/generated/prisma/enums";
import type { BatchStatus, Role, Stage } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  FLOOR_MANAGER: "Floor Manager",
  QUALITY_INSPECTOR: "Quality Inspector",
  SYSTEM_ADMIN: "System Admin",
  SHOE_CONSTRUCTOR: "Shoe Constructor",
};

/** Each role's landing page after sign-in. */
export const ROLE_HOME: Record<Role, string> = {
  FLOOR_MANAGER: "/floor-manager",
  QUALITY_INSPECTOR: "/quality-inspector",
  SYSTEM_ADMIN: "/admin",
  SHOE_CONSTRUCTOR: "/constructor",
};

export const STAGE_ORDER: readonly Stage[] = [
  "PREPARATION",
  "UPPER_MAKING",
  "SOLEING",
  "FINISHING",
] as const;

export const STAGE_LABELS: Record<Stage, string> = {
  PREPARATION: "Preparation",
  UPPER_MAKING: "Upper Making",
  SOLEING: "Sole-ing",
  FINISHING: "Finishing",
};

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
