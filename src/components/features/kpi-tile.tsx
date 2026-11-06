import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One key figure (Phase 30F): a small muted label, the figure large and quiet, then one or two
 * short lines of context. Tiles in a row share one height through the grid.
 */
export function KpiTile({
  label,
  value,
  children,
  className,
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "children">) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-1 rounded-lg border bg-card p-5 text-card-foreground shadow-1",
        className,
      )}
      {...props}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-kpi font-semibold tracking-tight">{value}</p>
      {children && (
        <div className="mt-auto flex flex-col gap-0.5 pt-1 text-sm text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
