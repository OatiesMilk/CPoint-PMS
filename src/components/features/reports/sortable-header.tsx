"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A column header that sorts its table (Phase 35): the label is a link that sets
 * `?sort=<table>.<column>&dir=asc|desc` and keeps every other param; a second click reverses it.
 * One sort per page, so choosing another column replaces it. `aria-sort` names the order.
 */
export function SortableHeader({
  table,
  column,
  numeric,
  className,
  children,
}: {
  table: string;
  column: string;
  numeric?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("sort") === `${table}.${column}`;
  const dir = params.get("dir") === "desc" ? "desc" : "asc";
  const next = new URLSearchParams(params);
  next.set("sort", `${table}.${column}`);
  next.set("dir", active && dir === "asc" ? "desc" : "asc");
  next.delete("page");
  const Arrow = dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <TableHead
      numeric={numeric}
      className={className}
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : undefined}
    >
      <Link
        href={`${pathname}?${next.toString()}`}
        scroll={false}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
          active && "text-foreground",
        )}
      >
        {children}
        {active && <Arrow aria-hidden className="size-3.5 shrink-0" />}
        <span className="sr-only">
          {active
            ? `, sorted ${dir === "desc" ? "high to low" : "low to high"}. Select to reverse`
            : ". Select to sort"}
        </span>
      </Link>
    </TableHead>
  );
}
