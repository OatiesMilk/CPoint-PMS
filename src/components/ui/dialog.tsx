"use client";

import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

// Two widths, so every dialog is one of them (DESIGN.md → Dialog):
// "md" for a confirm or a short form, "lg" for a form with a list or two fields side by side.
const DIALOG_WIDTH = { md: "max-w-md", lg: "max-w-md sm:max-w-2xl" } as const;

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: React.ComponentProps<typeof Primitive.Content> & { size?: keyof typeof DIALOG_WIDTH }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-brand-ink/40",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        )}
      />
      <Primitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex w-full min-w-0 -translate-x-1/2 -translate-y-1/2 flex-col gap-4",
          DIALOG_WIDTH[size],
          "rounded-lg border bg-popover p-6 text-popover-foreground shadow-2 duration-(--dur-base)",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          className="absolute top-4 right-4 rounded-sm text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X aria-hidden className="size-4" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn("pr-6 text-xl font-semibold", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn("text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-2 flex justify-end gap-2", className)} {...props} />;
}
