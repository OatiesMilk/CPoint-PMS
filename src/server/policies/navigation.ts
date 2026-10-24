import { ROLE_HOME, type Role } from "@/lib/domain";
import { can, type Permission } from "./permissions";

export type NavIcon =
  | "overview"
  | "production"
  | "attendance"
  | "camera"
  | "capture"
  | "scans"
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

const SECTIONS: { title: string; items: Definition[] }[] = [
  {
    title: "Production",
    items: [
      {
        label: "Production",
        href: "/production",
        icon: "production",
        permission: "production:read",
      },
      {
        label: "Attendance",
        href: "/attendance",
        icon: "attendance",
        permission: "attendance:read",
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: "inventory",
        permission: "inventory:read",
      },
    ],
  },
  {
    title: "Quality",
    items: [
      { label: "Camera", href: "/camera", icon: "camera", permission: "camera:view" },
      { label: "Scans", href: "/scans", icon: "scans", permission: "scan:read" },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: "reports",
        permission: "report:quality",
      },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: "users", permission: "user:manage" },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        permission: "settings:manage",
      },
      {
        label: "API tokens",
        href: "/admin/tokens",
        icon: "tokens",
        permission: "token:manage",
      },
      {
        label: "Audit log",
        href: "/admin/audit",
        icon: "audit",
        permission: "audit:read",
      },
    ],
  },
];

/**
 * The sidebar for a person: their home first, then every section they have at least one permission
 * in. A Shoe Constructor has one page, Capture (Phase 26, D-095), which is also their home; without
 * camera access it says who grants it. Nobody else captures.
 */
export function navigationFor(user: { role: Role; canCapture?: boolean }): NavSection[] {
  const role = user.role;
  if (role === "SHOE_CONSTRUCTOR") {
    return [{ title: null, items: [{ label: "Capture", href: ROLE_HOME[role], icon: "capture" }] }];
  }
  const allowed = (item: { permission: Permission }) => can(role, item.permission);
  const home: NavSection = {
    title: null,
    items: [{ label: "Overview", href: ROLE_HOME[role], icon: "overview" }],
  };
  const sections = SECTIONS.map((section) => ({
    title: section.title,
    items: section.items
      .filter(allowed)
      .map(({ label, href, icon, phase }) => ({ label, href, icon, phase })),
  })).filter((section) => section.items.length > 0);
  return [home, ...sections];
}
