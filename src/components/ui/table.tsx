import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollRegion } from "./scroll-region";

// Dense data table (DESIGN.md → Hierarchy rules): one row height, numbers right-aligned via `numeric`.
// A table wider than its card scrolls inside it, and that scroll box takes keyboard focus (axe
// scrollable-region-focusable). `label` names it for screen readers; the default is "Table".
export function Table({
  className,
  label = "Table",
  ...props
}: React.ComponentProps<"table"> & { label?: string }) {
  return (
    <ScrollRegion label={label} className="rounded-lg border bg-card shadow-1">
      <table
        data-slot="table"
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </ScrollRegion>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("border-b bg-muted/60", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b transition-colors duration-(--dur-fast) hover:bg-accent/50",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  numeric,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 px-3 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  numeric,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "h-11 px-3 align-middle whitespace-nowrap",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
