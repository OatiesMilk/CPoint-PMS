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
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CANCEL_REASON_MAX, ROLL_MESSAGES } from "@/lib/roll-rules";

/** What removeRollAction answers (an ActionResult). */
type RemoveResult =
  { ok: true } | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

/**
 * Remove a roll (the Floor Manager, Phase 30A): damaged, lost or added by mistake. The dialog names
 * the roll and asks why. A roll from Inventory leaves stock; its shots stay, out of the reports.
 */
export function RemoveRoll({
  code,
  shots,
  fromInventory,
  action,
  size = "md",
}: {
  code: string;
  shots: number;
  fromInventory: boolean;
  /** removeRollAction bound to the roll's id. */
  action: (input: { reason: string }) => Promise<RemoveResult>;
  size?: "md" | "sm";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldId = `remove-reason-${code}`;

  function submit() {
    const trimmed = reason.trim();
    if (!trimmed) return setReasonError(ROLL_MESSAGES.removeReason);
    if (trimmed.length > CANCEL_REASON_MAX)
      return setReasonError(ROLL_MESSAGES.removeReasonTooLong);
    setReasonError(null);
    startTransition(async () => {
      const result = await action({ reason: trimmed });
      if (result.ok) {
        toast.success(fromInventory ? `${code} is removed and left stock.` : `${code} is removed.`);
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
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant={size === "sm" ? "ghost" : "destructive"}
          size={size}
          aria-label={size === "sm" ? `Remove ${code}` : undefined}
          onClick={() => {
            setReason("");
            setReasonError(null);
            setError(null);
            setOpen(true);
          }}
        >
          <X aria-hidden />
          {size === "sm" ? "Remove" : "Remove roll…"}
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
          <DialogTitle>Remove {code}?</DialogTitle>
          <DialogDescription>
            {fromInventory ? "It leaves stock and can’t be scanned or ticked. " : ""}
            {shots > 0
              ? `Its ${shots} ${shots === 1 ? "shot stays" : "shots stay"} on record but ${shots === 1 ? "is" : "are"} left out of the reports. `
              : ""}
            Nothing is deleted.
          </DialogDescription>
          <form
            noValidate
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Label htmlFor={fieldId}>Reason</Label>
            <Textarea
              id={fieldId}
              rows={3}
              value={reason}
              autoFocus
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? `${fieldId}-error` : undefined}
              placeholder="e.g. Water damage in storage"
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError && e.target.value.trim()) setReasonError(null);
              }}
            />
            <FieldError id={`${fieldId}-error`} message={reasonError ?? undefined} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Keep roll
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                Remove roll
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
