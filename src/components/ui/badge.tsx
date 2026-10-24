import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-sm font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        info: "bg-info-soft text-info",
        success: "bg-pass-soft text-pass",
        warning: "bg-caution-soft text-caution",
        danger: "bg-reject-soft text-reject",
        brand: "bg-brand-yellow text-brand-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** Always pair the tone with a label (and ideally an icon): color never carries meaning alone. */
export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
