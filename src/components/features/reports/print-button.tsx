"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Opens the browser's print dialog, where "Save as PDF" makes the file (D-072). On a report, pass
 * `href` when the printed page differs from the one on screen (Rolls prints every row, A-102): it
 * opens that page, which prints itself once it has loaded.
 */
export function PrintButton({
  label = "Save as PDF",
  href,
  variant = "primary",
}: {
  label?: string;
  href?: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => (href ? window.open(href, "_blank") : window.print())}
    >
      <Printer aria-hidden />
      {label}
    </Button>
  );
}

/** On a page opened with `?autoprint=1`: prints it once it is on screen. */
export function AutoPrint() {
  const wanted = useSearchParams().get("autoprint") === "1";
  useEffect(() => {
    if (!wanted) return;
    const t = window.setTimeout(() => window.print(), 400); // let the table and fonts paint first
    return () => window.clearTimeout(t);
  }, [wanted]);
  return null;
}
