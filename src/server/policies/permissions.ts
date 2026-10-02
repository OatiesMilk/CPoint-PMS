import type { Role } from "@/lib/domain";

/**
 * Role × permission matrix (docs/prompts/system-rebuild.md → <roles_and_modules>).
 * Pure and dependency-free so it can be unit-tested and used to build navigation.
 */
export const PERMISSIONS = {
  "batch:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "batch:manage": ["FLOOR_MANAGER"],
  "camera:view": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "scan:read": ["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN"],
  "scan:decide": ["FLOOR_MANAGER", "QUALITY_INSPECTOR"], // review queue + overrides
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
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
