"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, Pencil, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Stage } from "@/lib/domain";
import { EXPECTED_PIECES_PER_ROLL, type BatchActions } from "@/lib/stage-machine";
import { cancelBatchAction, transitionBatchAction, type ActionResult } from "../actions";

type Props = {
  id: string;
  code: string;
  currentStage: Stage;
  actions: BatchActions;
  /** Sections scanned so far. */
  scanned: number;
  /** Start, edit and cancel (batch:manage, the Floor Manager). */
  canManage: boolean;
  /** Finish roll (batch:finish, the Floor Manager and the QI). */
  canFinish: boolean;
};

type DialogKind = "finish" | "cancel" | null;

export function BatchActionsBar({
  id,
  code,
  currentStage,
  actions,
  scanned,
  canManage,
  canFinish,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showStart = canManage && actions.start.allowed;
  const showFinish = canFinish && actions.finish.allowed;
  const showEdit = canManage && actions.edit.allowed;
  const showCancel = canManage && actions.cancel.allowed;
  if (!showStart && !showFinish && !showEdit && !showCancel) return null;

  function handle(result: ActionResult, success: string) {
    if (result.ok) {
      toast.success(success);
      setDialog(null);
      setReason("");
      return;
    }
    if (result.code === "STALE") {
      setDialog(null);
      setStale(result.error);
      return;
    }
    if (result.fieldErrors?.reason) {
      setReasonError(result.fieldErrors.reason);
      return;
    }
    setDialog(null);
    setError(result.error);
  }

  function run(action: "start" | "finish") {
    setError(null);
    setStale(null);
    startTransition(async () => {
      handle(
        await transitionBatchAction(id, { action, expectedStage: currentStage }),
        action === "start"
          ? `${code} started. The camera feeds it while it is the oldest roll at Preparation.`
          : `${code} finished.`,
      );
    });
  }

  function submitCancel() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError("Enter a reason for cancelling the roll (at least 3 characters).");
      return;
    }
    setReasonError(null);
    startTransition(async () => {
      handle(
        await cancelBatchAction(id, { reason: trimmed, expectedStage: currentStage }),
        `${code} cancelled.`,
      );
    });
  }

  const spinner = pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {showStart && (
          <Button disabled={pending} onClick={() => run("start")}>
            {dialog === null && spinner}
            <Play aria-hidden />
            Start roll
          </Button>
        )}
        {showFinish && (
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              setDialog("finish");
            }}
          >
            <CircleCheck aria-hidden />
            Finish roll…
          </Button>
        )}
        {showEdit && (
          <Button asChild variant="ghost">
            <Link href={`/batches/${id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </Button>
        )}
        {showCancel && (
          <Button
            variant="destructive"
            disabled={pending}
            className="ml-6"
            onClick={() => {
              setReason("");
              setReasonError(null);
              setDialog("cancel");
            }}
          >
            Cancel roll…
          </Button>
        )}
      </div>

      {stale && (
        <Alert tone="info">
          <span>{stale}</span>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 self-start"
            onClick={() => {
              setStale(null);
              router.refresh();
            }}
          >
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <Dialog open={dialog === "finish"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogTitle>Finish {code}?</DialogTitle>
          <DialogDescription>
            Do this when the roll is used up. {scanned} section{scanned === 1 ? " was" : "s were"}{" "}
            scanned ({EXPECTED_PIECES_PER_ROLL} expected). The camera moves on to the next roll at
            Preparation, and this one can’t be restarted.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Not yet</Button>
            </DialogClose>
            <Button disabled={pending} onClick={() => run("finish")}>
              {spinner}
              Finish roll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cancel"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogTitle>Cancel {code}?</DialogTitle>
          <DialogDescription>
            The roll stops here and can’t be restarted. A planned roll goes back on the shelf. Its
            history is kept.
          </DialogDescription>
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitCancel();
            }}
          >
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              autoFocus
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? "cancel-reason-error" : undefined}
              placeholder="e.g. Roll returned to the supplier"
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError && e.target.value.trim().length >= 3) setReasonError(null);
              }}
            />
            {reasonError && (
              <p id="cancel-reason-error" className="text-sm text-reject">
                {reasonError}
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Keep roll
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={pending}>
                {spinner}
                Cancel roll
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
