"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ReworkStatus } from "@/lib/domain";
import { REWORK_MOVES, REWORK_UNDO, type ReworkMove } from "@/lib/outcome-rules";
import { moveReworkAction } from "./actions";

const PRIMARY: Partial<Record<ReworkStatus, ReworkMove>> = { OPEN: "start", IN_PROGRESS: "done" };
const DONE_TOAST: Record<ReworkMove, string> = {
  start: "started",
  done: "marked done. It now counts as usable.",
  reopen: "reopened",
  unstart: "back to waiting",
};

/** One primary move per card; every move offers Undo for 6 s (reversible, so no confirm dialog). */
export function ReworkCardActions({
  id,
  status,
  label,
}: {
  id: string;
  status: ReworkStatus;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(move: ReworkMove, expectedStatus: ReworkStatus, withUndo = true) {
    setError(null);
    startTransition(async () => {
      const result = await moveReworkAction(id, { move, expectedStatus });
      if (!result.ok) {
        setError(result.error);
        if (result.code === "STALE") router.refresh();
        return;
      }
      const undo = REWORK_UNDO[move];
      toast.success(`${label}: ${DONE_TOAST[move]}`, {
        duration: 6000,
        action:
          withUndo && undo
            ? { label: "Undo", onClick: () => run(undo, REWORK_MOVES[move].to, false) }
            : undefined,
      });
    });
  }

  const primary = PRIMARY[status];
  const spinner = pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {primary && (
          <Button size="sm" disabled={pending} onClick={() => run(primary, status)}>
            {spinner}
            {REWORK_MOVES[primary].label}
          </Button>
        )}
        {status === "IN_PROGRESS" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run("unstart", status)}
          >
            Back to waiting
          </Button>
        )}
        {status === "DONE" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run("reopen", status)}
          >
            {spinner}
            Reopen
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-reject">{error}</p>}
    </div>
  );
}
