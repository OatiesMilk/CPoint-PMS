import Link from "next/link";
import { cn } from "@/lib/utils";

export type ReportTab = "operations" | "quality" | "rolls";

/** Operations, Quality and Rolls (Phase 26) for the Floor Manager. */
export function ReportTabs({ current, qs }: { current: ReportTab; qs?: string }) {
  const tabs = [
    {
      id: "operations",
      label: "Operations",
      href: `/reports?view=operations${qs ? `&${qs}` : ""}`,
    },
    { id: "quality", label: "Quality", href: `/reports?view=quality${qs ? `&${qs}` : ""}` },
    { id: "rolls", label: "Rolls", href: "/reports/rolls" },
  ] as const;
  return (
    <nav aria-label="Report" className="flex gap-6 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={current === tab.id ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-1 pb-2 text-lg font-medium",
            current === tab.id
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
