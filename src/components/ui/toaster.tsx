"use client";

import { Toaster as Sonner } from "sonner";

/** Transient confirmations (DESIGN.md → Patterns). Styled with tokens; follows the app theme. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-border !bg-popover !text-popover-foreground !shadow-2 !font-sans !text-base",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
