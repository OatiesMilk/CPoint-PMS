import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-3 rounded-md px-4 py-3 text-base", {
  variants: {
    tone: {
      info: "bg-info-soft text-foreground [&>svg]:text-info",
      danger: "bg-reject-soft text-foreground [&>svg]:text-reject",
      success: "bg-pass-soft text-foreground [&>svg]:text-pass",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons = { info: Info, danger: CircleAlert, success: CircleCheck };

/** Inline message. Danger alerts are announced to screen readers immediately. */
export function Alert({
  tone = "info",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon = icons[tone ?? "info"];
  return (
    <div
      data-slot="alert"
      role={tone === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
