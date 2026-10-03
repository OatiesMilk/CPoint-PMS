"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Camera,
  ChartColumn,
  ChevronsUpDown,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Package,
  Recycle,
  ScanLine,
  ScrollText,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
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
export type SidebarItem = { label: string; href: string; icon: NavIcon; phase?: number };
export type SidebarSection = { title: string | null; items: SidebarItem[] };

const ICONS: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  batches: Boxes,
  camera: Camera,
  scans: ScanLine,
  review: ClipboardCheck,
  rework: Wrench,
  salvage: Recycle,
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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ sections, user, signOutAction }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Image src={logo} alt="" className="size-8 rounded-md" priority />
        <div className="leading-tight">
          <p className="font-semibold">CPoint</p>
          <p className="text-xs text-muted-foreground">Product Monitoring</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
        {sections.map((section, index) => (
          <div key={section.title ?? index} className="flex flex-col gap-0.5">
            {section.title && (
              <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
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
                      className="flex h-8 items-center gap-2.5 rounded-md px-2 text-muted-foreground"
                    >
                      <Icon aria-hidden className="size-4 opacity-70" />
                      <span className="flex-1">{item.label}</span>
                      <span className="rounded-sm bg-muted px-1.5 text-xs">
                        <span className="sr-only">available in </span>Phase {item.phase}
                      </span>
                    </li>
                  );
                }
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-8 items-center gap-2.5 rounded-md px-2 transition-colors duration-(--dur-fast)",
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
                      <Icon aria-hidden className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-1 border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.roleLabel}</span>
            </span>
            <ChevronsUpDown aria-hidden className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
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
