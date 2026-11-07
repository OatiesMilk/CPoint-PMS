import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One key figure (Phase 30F): a small muted label, the figure large and quiet, then one or two
 * short lines of context. Tiles in a row share one height through the grid.
 */
export function KpiTile({
  label,
  value,
  valueTestId,
  children,
  className,
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  /** `data-testid` on the figure itself, for tests that read the number. */
  valueTestId?: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "children">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex h-full flex-col gap-1 rounded-lg border bg-card p-5 text-card-foreground shadow-1",
        className,
      )}
      {...props}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-kpi font-semibold tracking-tight tabular-nums" data-testid={valueTestId}>
        {value}
      </p>
      {children && (
        <div className="mt-auto flex flex-col gap-0.5 pt-1 text-sm text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * A key figure inside a card (Phase 30F-2): the same label, figure and context as `KpiTile`,
 * without a surface of its own. Use a `dl` around a group of them.
 */
export function Stat({
  label,
  value,
  valueTestId,
  children,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  valueTestId?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-kpi font-semibold tracking-tight tabular-nums" data-testid={valueTestId}>
        {value}
      </dd>
      {children && <dd className="text-sm text-muted-foreground">{children}</dd>}
    </div>
  );
}
