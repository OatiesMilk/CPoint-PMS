"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, RefreshCw, Undo2 } from "lucide-react";
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
import { STAGE_LABELS, type Stage } from "@/lib/domain";
import {
  nextStage,
  openRepairsNote,
  transitionLabel,
  type BatchActions,
  type TransitionAction,
} from "@/lib/stage-machine";
import { cancelBatchAction, transitionBatchAction, type ActionResult } from "../actions";

type Props = {
  id: string;
  code: string;
  currentStage: Stage;
  actions: BatchActions;
  /** Sections still at the repair station; completing is allowed and tags the batch (D-022). */
  openRepairs: number;
};

type DialogKind = "complete" | "move_back" | "cancel" | null;

export function BatchActionsBar({ id, code, currentStage, actions, openRepairs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const primary: TransitionAction | null = actions.start.allowed
    ? "start"
    : actions.advance.allowed
      ? "advance"
      : actions.complete.allowed
        ? "complete"
        : null;

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

  function run(action: TransitionAction, withReason?: string) {
    setError(null);
    setStale(null);
    const success =
      action === "start"
        ? `${code}: production started at Preparation.`
        : action === "complete"
          ? `${code} completed.`
          : action === "advance"
            ? `${code} moved to ${STAGE_LABELS[nextStage(currentStage) ?? currentStage]}.`
            : `${code} moved back.`;
    startTransition(async () => {
      handle(
        await transitionBatchAction(id, {
          action,
          expectedStage: currentStage,
          reason: withReason,
        }),
        success,
      );
    });
  }

  function submitReason(kind: "move_back" | "cancel") {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError(
        kind === "cancel" ? "Say why the batch is cancelled." : "Say why the batch is moving back.",
      );
      return;
    }
    setReasonError(null);
    if (kind === "move_back") return run("move_back", trimmed);
    startTransition(async () => {
      handle(
        await cancelBatchAction(id, { reason: trimmed, expectedStage: currentStage }),
        `${code} cancelled.`,
      );
    });
  }

  function openDialog(kind: DialogKind) {
    setReason("");
    setReasonError(null);
    setDialog(kind);
  }

  const spinner = pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {primary && (
          <Button
            disabled={pending}
            onClick={() => (primary === "complete" ? openDialog("complete") : run(primary))}
          >
            {dialog === null && spinner}
            {transitionLabel(primary, currentStage)}
          </Button>
        )}
        {actions.moveBack.allowed && (
          <Button variant="secondary" disabled={pending} onClick={() => openDialog("move_back")}>
            <Undo2 aria-hidden />
            Move back…
          </Button>
        )}
        {actions.edit.allowed && (
          <Button asChild variant="ghost">
            <Link href={`/batches/${id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </Button>
        )}
        {actions.cancel.allowed && (
          <Button
            variant="destructive"
            disabled={pending}
            className="ml-6"
            onClick={() => openDialog("cancel")}
          >
            Cancel batch…
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

      <Dialog open={dialog === "complete"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogTitle>Complete {code}?</DialogTitle>
          <DialogDescription>
            This closes Finishing and marks the batch as completed. It can’t be moved back
            afterwards.
          </DialogDescription>
          {openRepairs > 0 && <Alert tone="info">{openRepairsNote(openRepairs)}</Alert>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Not yet</Button>
            </DialogClose>
            <Button disabled={pending} onClick={() => run("complete")}>
              {spinner}
              Complete batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(["move_back", "cancel"] as const).map((kind) => (
        <Dialog key={kind} open={dialog === kind} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogTitle>
              {kind === "cancel"
                ? `Cancel ${code}?`
                : `Move ${code} back to ${transitionLabel("move_back", currentStage).replace("Move back to ", "")}?`}
            </DialogTitle>
            <DialogDescription>
              {kind === "cancel"
                ? "The batch stops here and can’t be restarted. Its stage history is kept."
                : "The current stage closes and the previous one reopens. The reason is kept in the timeline."}
            </DialogDescription>
            <form
              className="flex flex-col gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                submitReason(kind);
              }}
            >
              <Label htmlFor={`${kind}-reason`}>Reason</Label>
              <Textarea
                id={`${kind}-reason`}
                rows={3}
                value={reason}
                autoFocus
                aria-invalid={!!reasonError}
                aria-describedby={reasonError ? `${kind}-reason-error` : undefined}
                placeholder={
                  kind === "cancel"
                    ? "e.g. Roll returned to the supplier"
                    : "e.g. Stitching redone on 40 pairs"
                }
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError && e.target.value.trim().length >= 3) setReasonError(null);
                }}
              />
              {reasonError && (
                <p id={`${kind}-reason-error`} className="text-sm text-reject">
                  {reasonError}
                </p>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {kind === "cancel" ? "Keep batch" : "Don’t move"}
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant={kind === "cancel" ? "destructive" : "primary"}
                  disabled={pending}
                >
                  {spinner}
                  {kind === "cancel" ? "Cancel batch" : "Move back"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
