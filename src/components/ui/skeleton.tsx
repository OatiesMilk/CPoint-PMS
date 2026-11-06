import * as React from "react";
import { cn } from "@/lib/utils";

/** A placeholder block (shadcn Skeleton, restyled with tokens). The loading root carries role="status". */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
