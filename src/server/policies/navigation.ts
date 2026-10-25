import { ROLE_HOME, type Role } from "@/lib/domain";
import { can, type Permission } from "./permissions";

export type NavIcon =
  | "overview"
  | "production"
  | "attendance"
  | "camera"
  | "capture"
  | "inventory"
  | "reports"
  | "users"
  | "settings"
  | "tokens"
  | "audit";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** Roadmap phase that builds it. Items not built yet render as non-clickable "Phase N" entries. */
  phase?: number;
};

export type NavSection = { title: string | null; items: NavItem[] };

type Definition = NavItem & { permission: Permission };

const BATCHES: Definition = {
  label: "Batches",
  href: "/batches",
  icon: "production",
  permission: "production:read",
};

/**
 * Each role's sidebar, in order (Phase 28, D-100, C-18). One flat list: the longest has six items.
 * Every item still needs its permission, so the sidebar and the page guards can't drift apart.
 */
const MENUS: Record<Role, Definition[]> = {
  // A constructor's one page is Capture (Phase 26, D-095); without camera access it says who
  // grants it, so it isn't filtered by canCapture.
  SHOE_CONSTRUCTOR: [
    {
      label: "Capture",
      href: ROLE_HOME.SHOE_CONSTRUCTOR,
      icon: "capture",
      permission: "camera:capture",
    },
  ],
  // Batches is the QI's home and only page.
  QUALITY_INSPECTOR: [BATCHES],
  FLOOR_MANAGER: [
    { label: "Overview", href: ROLE_HOME.FLOOR_MANAGER, icon: "overview", permission: "roll:read" },
    BATCHES,
    { label: "Attendance", href: "/attendance", icon: "attendance", permission: "attendance:read" },
    { label: "Reports", href: "/reports", icon: "reports", permission: "report:production" },
    { label: "Inventory", href: "/inventory", icon: "inventory", permission: "inventory:read" },
  ],
  SYSTEM_ADMIN: [
    {
      label: "Overview",
      href: ROLE_HOME.SYSTEM_ADMIN,
      icon: "overview",
      permission: "system:health",
    },
    { label: "Users", href: "/admin/users", icon: "users", permission: "user:manage" },
    { label: "Settings", href: "/admin/settings", icon: "settings", permission: "settings:manage" },
    { label: "Camera", href: "/camera", icon: "camera", permission: "camera:view" },
    { label: "API tokens", href: "/admin/tokens", icon: "tokens", permission: "token:manage" },
    { label: "Audit log", href: "/admin/audit", icon: "audit", permission: "audit:read" },
  ],
};

/** The sidebar for a person: their role's list, home first, in one section without a heading. */
export function navigationFor(user: { role: Role; canCapture?: boolean }): NavSection[] {
  const items = MENUS[user.role]
    .filter((item) => can(user.role, item.permission))
    .map(({ label, href, icon, phase }) => ({ label, href, icon, phase }));
  return [{ title: null, items }];
}
