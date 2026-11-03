"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, RefreshCw, Undo2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CANCEL_REASON_MAX, ROLL_MESSAGES } from "@/lib/roll-rules";

type Result =
  { ok: true } | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

type Input =
  { decision: "RETURNED"; returnedOn: string; note?: string } | { decision: "KEPT"; note: string };

/**
 * The Floor Manager's decision on a scanned roll (Phase 30C, C-36): Returned to supplier (the day
 * it went back, an optional note; it leaves stock) or Keep (a reason; it can then be ticked Fully
 * used). The dialog names the roll and says what happens. The decision can't be changed (A-27).
 */
export function ReturnDecision({
  code,
  marked,
  canKeep,
  today,
  action,
}: {
  code: string;
  /** Marked Return to supplier at Finish roll. */
  marked: boolean;
  canKeep: boolean;
  /** Manila's date, YYYY-MM-DD, the default and the latest day allowed. */
  today: string;
  /** decideReturnAction bound to the roll's id. */
  action: (input: Input) => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Which dialog: kept while it closes, so its fade-out never shows the other one (QA 30C F1).
  const [kind, setKind] = useState<"RETURNED" | "KEPT">("RETURNED");
  const [isOpen, setIsOpen] = useState(false);
  const close = () => {
    setIsOpen(false);
    setErrors({});
  };
  const [returnedOn, setReturnedOn] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stale, setStale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function check(decision: "RETURNED" | "KEPT"): Record<string, string> {
    const found: Record<string, string> = {};
    const trimmed = note.trim();
    if (decision === "RETURNED") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(returnedOn)) found.returnedOn = ROLL_MESSAGES.returnedOn;
      else if (returnedOn > today) found.returnedOn = ROLL_MESSAGES.returnedInFuture;
    } else if (!trimmed) found.note = ROLL_MESSAGES.keepReason;
    if (trimmed.length > CANCEL_REASON_MAX) found.note = ROLL_MESSAGES.noteTooLong;
    return found;
  }

  function submit(decision: "RETURNED" | "KEPT") {
    const found = check(decision);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(found.returnedOn ? "return-day" : "return-note")?.focus();
      return;
    }
    const trimmed = note.trim();
    startTransition(async () => {
      const result = await action(
        decision === "RETURNED"
          ? { decision, returnedOn, ...(trimmed ? { note: trimmed } : {}) }
          : { decision, note: trimmed },
      );
      if (result.ok) {
        toast.success(
          decision === "RETURNED"
            ? `${code} is marked as sent back to the supplier.`
            : `${code} is kept. It can be used as normal.`,
        );
        close();
        router.refresh();
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0)
        return setErrors(result.fieldErrors);
      close();
      if (result.code === "STALE" || result.code === "CONFLICT") setStale(result.error);
      else setError(result.error);
    });
  }

  const start = (decision: "RETURNED" | "KEPT") => {
    setErrors({});
    setError(null);
    setNote("");
    setReturnedOn(today);
    setKind(decision);
    setIsOpen(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant={marked ? "primary" : "secondary"} onClick={() => start("RETURNED")}>
          <Undo2 aria-hidden />
          Send back to supplier…
        </Button>
        {canKeep && (
          <Button variant="secondary" onClick={() => start("KEPT")}>
            <CircleCheck aria-hidden />
            Keep and use…
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

      <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogTitle>
            {kind === "KEPT" ? `Keep ${code}?` : `Send ${code} back to the supplier?`}
          </DialogTitle>
          <DialogDescription>
            {kind === "KEPT"
              ? "It stays in stock and can be used as normal. You can’t undo this."
              : "It will be taken out of stock. You can’t undo this."}
          </DialogDescription>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(kind);
            }}
          >
            {kind === "RETURNED" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="return-day">Day it was sent back</Label>
                <Input
                  id="return-day"
                  type="date"
                  className="w-48"
                  max={today}
                  value={returnedOn}
                  aria-invalid={!!errors.returnedOn}
                  aria-describedby={errors.returnedOn ? "return-day-error" : undefined}
                  onChange={(e) => setReturnedOn(e.target.value)}
                />
                <FieldError id="return-day-error" message={errors.returnedOn} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-note">
                {kind === "KEPT" ? "Why are you keeping it?" : "Note (optional)"}
              </Label>
              <Textarea
                id="return-note"
                rows={3}
                value={note}
                aria-invalid={!!errors.note}
                aria-describedby={errors.note ? "return-note-error" : undefined}
                placeholder={
                  kind === "KEPT"
                    ? "e.g. The cuts are near the edge and can be cut around"
                    : "e.g. Picked up by the supplier's driver, claim no. 1042"
                }
                onChange={(e) => {
                  setNote(e.target.value);
                  if (errors.note && e.target.value.trim())
                    setErrors(({ note: _, ...rest }) => rest);
                }}
              />
              <FieldError id="return-note-error" message={errors.note} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Not now
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                {kind === "KEPT" ? "Keep roll" : "Send back"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
