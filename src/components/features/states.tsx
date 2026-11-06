import type { ComponentType, ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// One style for the states every list and card can be in (ui-craft §3, Phase 30F). Pages pass
// their own words in; nothing here decides copy.

/** The page title and description while a page loads, matching `PageHeader`. */
export function SkeletonHeader() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-6 w-full max-w-md" />
    </div>
  );
}

/** Table rows while a list loads, inside the same card frame as `Table`. */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-1">
      <div className="h-9 border-b bg-muted/50" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-6 border-b px-3 last:border-0">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="ml-auto h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

/** A row of KPI tiles while a report loads, matching `KpiTile`. */
export function SkeletonTiles({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-28 flex-col gap-3 rounded-lg border bg-card p-5 shadow-1">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Why a list or card is empty, and the one next step. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon aria-hidden className="size-5 text-muted-foreground" />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A page that failed to load: what happened, that nothing changed, and Try again. */
export function ErrorState({
  title,
  children,
  onRetry,
}: {
  title: ReactNode;
  children: ReactNode;
  onRetry: () => void;
}) {
  return (
    <div className="flex max-w-xl flex-col gap-4 py-10">
      <Alert tone="danger">
        <strong className="font-semibold">{title}</strong>
        <span>{children}</span>
      </Alert>
      <div>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}
