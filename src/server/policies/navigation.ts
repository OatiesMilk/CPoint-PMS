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
        phase: 5,
      },
    ],
  },
  {
    title: "Quality",
    items: [
      { label: "Camera", href: "/camera", icon: "camera", permission: "camera:view", phase: 3 },
      { label: "Scans", href: "/scans", icon: "scans", permission: "scan:read", phase: 3 },
      {
        label: "Review queue",
        href: "/review",
        icon: "review",
        permission: "scan:decide",
        phase: 3,
      },
      { label: "Rework", href: "/rework", icon: "rework", permission: "rework:manage", phase: 4 },
      { label: "Salvage", href: "/salvage", icon: "salvage", permission: "salvage:read", phase: 4 },
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
        phase: 7,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: "users", permission: "user:manage", phase: 6 },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        permission: "settings:manage",
        phase: 6,
      },
      {
        label: "API tokens",
        href: "/admin/tokens",
        icon: "tokens",
        permission: "token:manage",
        phase: 3,
      },
      {
        label: "Audit log",
        href: "/admin/audit",
        icon: "audit",
        permission: "audit:read",
        phase: 6,
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
