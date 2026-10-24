"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Aperture,
  Boxes,
  CalendarCheck,
  Camera,
  ChartColumn,
  ChevronsUpDown,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Package,
  ScanLine,
  ScrollText,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
  Gauge,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import logo from "../../../../public/images/cpoint-logo.jpg";

// Mirrors NavIcon / NavSection in src/server/policies/navigation.ts (components can't import server code).
type NavIcon =
  | "overview"
  | "production"
  | "attendance"
  | "batches"
  | "camera"
  | "capture"
  | "scans"
  | "inventory"
  | "reports"
  | "users"
  | "settings"
  | "tokens"
  | "audit";
export type SidebarItem = { label: string; href: string; icon: NavIcon; phase?: number };
export type SidebarSection = { title: string | null; items: SidebarItem[] };

const ICONS: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  production: Gauge,
  attendance: CalendarCheck,
  batches: Boxes,
  camera: Camera,
  capture: Aperture,
  scans: ScanLine,
  inventory: Package,
  reports: ChartColumn,
  users: Users,
  settings: Settings,
  tokens: KeyRound,
  audit: ScrollText,
};

type Props = {
  sections: SidebarSection[];
  user: { name: string; email: string; roleLabel: string };
  signOutAction: () => Promise<void>;
};

/** Sections match their sub-pages; a role's home (e.g. /admin) only matches itself. */
function isActive(pathname: string, href: string, exact = false) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

/** The one item to mark: the longest match, so /camera/capture marks Capture, not Camera too. */
function activeHref(pathname: string, sections: SidebarSection[]): string | null {
  let best: string | null = null;
  for (const item of sections.flatMap((s) => s.items)) {
    if (item.phase || !isActive(pathname, item.href, item.icon === "overview")) continue;
    if (!best || item.href.length > best.length) best = item.href;
  }
  return best;
}

export function Sidebar({ sections, user, signOutAction }: Props) {
  const pathname = usePathname();
  const current = activeHref(pathname, sections);

  return (
    <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:w-60">
      <div className="flex items-center justify-center gap-2.5 px-2 py-4 lg:justify-start lg:px-4">
        <Image src={logo} alt="" className="size-8 rounded-md" priority />
        <div className="hidden leading-tight lg:block">
          <p className="font-semibold">CPoint</p>
          <p className="text-xs text-muted-foreground">Product Monitoring</p>
        </div>
      </div>

      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-1.5 py-2 lg:px-2"
      >
        {sections.map((section, index) => (
          <div key={section.title ?? index} className="flex flex-col gap-0.5">
            {section.title && (
              <p className="hidden px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:block">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                if (item.phase) {
                  // Not built yet: visible so the plan is clear, but not a dead link.
                  return (
                    <li
                      key={item.href}
                      title={`Arrives in Phase ${item.phase}`}
                      className="flex h-8 items-center justify-center gap-2.5 rounded-md text-muted-foreground lg:justify-start lg:px-2"
                    >
                      <Icon aria-hidden className="size-4 opacity-70" />
                      <span className="sr-only flex-1 lg:not-sr-only">{item.label}</span>
                      <span className="hidden rounded-sm bg-muted px-1.5 text-xs lg:inline">
                        <span className="sr-only">available in </span>Phase {item.phase}
                      </span>
                    </li>
                  );
                }
                const active = item.href === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-8 items-center justify-center gap-2.5 rounded-md transition-colors duration-(--dur-fast) lg:justify-start lg:px-2",
                        "hover:bg-accent",
                        active && "bg-sidebar-active font-medium",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-indicator"
                        />
                      )}
                      <Icon aria-hidden className="size-4 shrink-0" />
                      <span className="sr-only lg:not-sr-only">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col items-center gap-1 border-t border-sidebar-border p-1.5 lg:flex-row lg:p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            title={user.name}
            className="flex min-w-0 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent lg:flex-1 lg:justify-start"
          >
            <UserRound aria-hidden className="size-4 shrink-0 lg:hidden" />
            <span className="sr-only min-w-0 flex-1 lg:not-sr-only">
              <span className="block truncate font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.roleLabel}</span>
            </span>
            <ChevronsUpDown aria-hidden className="hidden size-4 text-muted-foreground lg:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="max-w-[calc(100vw-1rem)]">
            <DropdownMenuLabel>
              <span className="block font-medium">{user.name}</span>
              <span className="block text-sm text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account/password">
                <LockKeyhole aria-hidden />
                Change password
              </Link>
            </DropdownMenuItem>
            <form action={signOutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut aria-hidden />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>
    </aside>
  );
}
