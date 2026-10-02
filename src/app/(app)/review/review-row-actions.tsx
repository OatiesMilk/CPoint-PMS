"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideScanAction } from "../scans/actions";

/** Quick decision buttons for a NEEDS_REVIEW scan. Each is one click; the camera never decided. */
export function ReviewRowActions({ scanId, label }: { scanId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(verdict: "PASS" | "REWORK" | "REJECT") {
    setError(null);
    startTransition(async () => {
      const result = await decideScanAction(scanId, { verdict, expectedFinalVerdict: null });
      if (result.ok)
        toast.success(
          `${label}: ${verdict === "PASS" ? "passed" : verdict === "REWORK" ? "sent to rework" : "rejected"}.`,
        );
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5" role="group" aria-label={`Decide ${label}`}>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("PASS")}>
          Pass
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("REWORK")}>
          Rework
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => decide("REJECT")}>
          Reject
        </Button>
      </div>
      {error && <p className="text-sm text-reject">{error}</p>}
    </div>
  );
}
