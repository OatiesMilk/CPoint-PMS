"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog for the label sheet (A4, no margins scaled: "Actual size"). */
export function PrintLabelsButton({ count }: { count: number }) {
  return (
    <Button type="button" onClick={() => window.print()} disabled={count === 0}>
      <Printer aria-hidden />
      {count === 1 ? "Print 1 label" : `Print ${count} labels`}
    </Button>
  );
}
