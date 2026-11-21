import * as React from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { ScrollRegion } from "./scroll-region";

// Dense data table (DESIGN.md → Hierarchy rules): one row height, numbers right-aligned via `numeric`.
// A table wider than its card scrolls inside it, and that scroll box takes keyboard focus (axe
// scrollable-region-focusable). `label` names it for screen readers; the default is "Table".
// `dense` takes the cells' side padding from 10 to 8 px, for the widest tables (Phase 30F-2).
export function Table({
  className,
  label = "Table",
  dense = false,
  ...props
}: React.ComponentProps<"table"> & { label?: string; dense?: boolean }) {
  return (
    <ScrollRegion label={label} className="rounded-lg border bg-card shadow-1">
      <table
        data-slot="table"
        className={cn(
          "w-full border-collapse text-sm",
          dense && "[&_td]:px-2 [&_th]:px-2",
          className,
        )}
        {...props}
      />
    </ScrollRegion>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("border-b bg-muted/50", className)} {...props} />;
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
        "h-9 px-2.5 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase",
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
        "h-11 px-2.5 align-middle whitespace-nowrap",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

// The last column of a table whose rows open a page of their own: a visible "View" so nobody has
// to guess that the first cell is a link. The header is named for screen readers only.
export function TableActionsHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <TableHead className={cn("text-right", className)} {...props}>
      <span className="sr-only">Actions</span>
    </TableHead>
  );
}

// "View" with an eye, never the icon alone (ui-craft: icons need a word). `what` finishes the
// accessible name for screen readers, e.g. "View roll LR-MLT-008".
export function TableViewLink({ href, what }: { href: string; what: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="print:hidden">
      <Link href={href}>
        <Eye aria-hidden />
        View<span className="sr-only"> {what}</span>
      </Link>
    </Button>
  );
}
