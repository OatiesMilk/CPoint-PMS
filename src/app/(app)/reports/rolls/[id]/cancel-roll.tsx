"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, X } from "lucide-react";
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
import { CANCEL_REASON_MAX, ROLL_MESSAGES } from "@/lib/roll-rules";
import { cancelRollAction } from "../actions";

/** The Floor Manager cancels an open roll, with a reason. Its shots stay, out of the reports. */
export function CancelRoll({ id, code, shots }: { id: string; code: string; shots: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = reason.trim();
    if (!trimmed) return setReasonError(ROLL_MESSAGES.cancelReason);
    if (trimmed.length > CANCEL_REASON_MAX)
      return setReasonError(ROLL_MESSAGES.cancelReasonTooLong);
    setReasonError(null);
    startTransition(async () => {
      const result = await cancelRollAction(id, { reason: trimmed });
      if (result.ok) {
        toast.success(`${code} is cancelled.`);
        setOpen(false);
        setReason("");
        router.refresh();
        return;
      }
      if (result.fieldErrors?.reason) return setReasonError(result.fieldErrors.reason);
      setOpen(false);
      if (result.code === "STALE" || result.code === "CONFLICT") setStale(result.error);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="destructive"
          onClick={() => {
            setReason("");
            setReasonError(null);
            setError(null);
            setOpen(true);
          }}
        >
          <X aria-hidden />
          Cancel roll…
        </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Cancel {code}?</DialogTitle>
          <DialogDescription>
            It can’t take more shots. Its {shots} {shots === 1 ? "shot stays" : "shots stay"} on
            record but {shots === 1 ? "is" : "are"} left out of the reports. Nothing is deleted.
          </DialogDescription>
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              autoFocus
              maxLength={CANCEL_REASON_MAX + 50}
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? "cancel-reason-error" : undefined}
              placeholder="e.g. Started with the wrong supplier"
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError && e.target.value.trim()) setReasonError(null);
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
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                Cancel roll
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
