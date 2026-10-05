import { ROLE_HOME, type Role } from "@/lib/domain";
import { can, type Permission } from "./permissions";

export type NavIcon =
  | "overview"
  | "batches"
  | "camera"
  | "scans"
  | "review"
  | "rework"
  | "salvage"
  | "inventory"
  | "procurement"
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
      { label: "Batches", href: "/batches", icon: "batches", permission: "batch:read" },
      {
        label: "Inventory",
        href: "/inventory",
        icon: "inventory",
        permission: "inventory:read",
      },
      {
        label: "Procurement",
        href: "/procurement",
        icon: "procurement",
        permission: "procurement:read",
      },
    ],
  },
  {
    title: "Quality",
    items: [
      { label: "Camera", href: "/camera", icon: "camera", permission: "camera:view" },
      { label: "Scans", href: "/scans", icon: "scans", permission: "scan:read" },
      {
        label: "Review queue",
        href: "/review",
        icon: "review",
        permission: "scan:decide",
      },
      { label: "Rework", href: "/rework", icon: "rework", permission: "rework:manage" },
      { label: "Salvage", href: "/salvage", icon: "salvage", permission: "salvage:read" },
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

/** The sidebar for a role: its home first, then every section it has at least one permission in. */
export function navigationFor(role: Role): NavSection[] {
  const home: NavSection = {
    title: null,
    items: [
      {
        label: role === "SHOE_CONSTRUCTOR" ? "Home" : "Overview",
        href: ROLE_HOME[role],
        icon: "overview",
      },
    ],
  };
  const sections = SECTIONS.map((section) => ({
    title: section.title,
    items: section.items
      .filter((item) => can(role, item.permission))
      .map(({ label, href, icon, phase }) => ({ label, href, icon, phase })),
  })).filter((section) => section.items.length > 0);
  return [home, ...sections];
}
