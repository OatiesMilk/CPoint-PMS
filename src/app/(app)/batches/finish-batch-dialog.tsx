"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, Pencil, RefreshCw } from "lucide-react";
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
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { cn } from "@/lib/utils";
import { correctionReasonSchema, parseBatchCounts } from "@/server/validators/production.validator";
import { correctBatchAction, finishBatchAction } from "./actions";

type Props = {
  mode: "finish" | "correct";
  /**
   * The batch by its code (Phase 33). `batchId` when it is queued; `dayLabel` for a batch from an
   * earlier day, inspected from the queue.
   */
  batch: {
    code: string;
    times: string;
    slotAt?: string;
    batchId?: string | null;
    dayLabel?: string;
  };
  /** "14 of 16", or null when attendance isn't taken; left out from the queue (another day). */
  workforceLine?: string | null;
  /** The button's word: "Finish batch" on Today, "Inspect" in the queue. */
  buttonLabel?: string;
  /** For a correction: the saved batch. */
  checkIn?: {
    id: string;
    updatedAt: string;
    pairs: number;
    failedPairs: number;
  };
  /** Open as soon as the page loads (a notice's or the home's Finish batch link). */
  autoOpen?: boolean;
  /** The phone's bottom action (D-096): full width, fixed above the safe area below 640 px. */
  primary?: boolean;
};

const FIELD_IDS = { pairs: "batch-pairs", failedPairs: "batch-failed", reason: "batch-reason" };

/**
 * Finish batch / Correct (C-27, D-098): "Pairs finished in B-261116-2 (10:00–13:00)" and "Of these,
 * failed inspection" (0 to start), both with the numeric keypad, optional notes; a correction needs
 * a reason. No rolls: the QI only counts pairs (Phase 30E, D-111). A sheet at the bottom of a phone
 * (D-096), a dialog on a desk.
 */
export function FinishBatchDialog({
  mode,
  batch,
  workforceLine,
  checkIn,
  autoOpen,
  primary,
  buttonLabel = "Finish batch",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen ?? false);
  // Batches is the QI's home (Phase 28), so a notice's Finish batch link can arrive while this
  // page is already open: open when the link asks, not only on the first render.
  const [askedToOpen, setAskedToOpen] = useState(autoOpen ?? false);
  if ((autoOpen ?? false) !== askedToOpen) {
    setAskedToOpen(autoOpen ?? false);
    if (autoOpen) setOpen(true);
  }
  const [pending, startTransition] = useTransition();
  const [pairs, setPairs] = useState(checkIn ? String(checkIn.pairs) : "");
  const [failed, setFailed] = useState(checkIn ? String(checkIn.failedPairs) : "0");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setPairs(checkIn ? String(checkIn.pairs) : "");
    setFailed(checkIn ? String(checkIn.failedPairs) : "0");
    setNotes("");
    setReason("");
    setErrors({});
    setFormError(null);
  }

  function validate(): Record<string, string> {
    const parsed = parseBatchCounts(batch.code, { pairs, failedPairs: failed });
    const out: Record<string, string> = parsed.ok ? {} : { ...parsed.errors };
    if (mode === "correct") {
      const r = correctionReasonSchema.safeParse(reason);
      if (!r.success) out.reason = r.error.issues[0].message;
    }
    return out;
  }

  function submit() {
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const result =
        mode === "finish"
          ? await finishBatchAction({
              ...(batch.batchId ? { batchId: batch.batchId } : { slotAt: batch.slotAt }),
              pairs,
              failedPairs: failed,
              notes,
            })
          : await correctBatchAction(checkIn!.id, {
              expectedUpdatedAt: checkIn!.updatedAt,
              pairs,
              failedPairs: failed,
              reason,
            });
      if (result.ok) {
        toast.success(
          mode === "finish"
            ? `${batch.code} finished.`
            : `${batch.code} corrected. Both counts are kept in the audit log.`,
        );
        setOpen(false);
        reset();
        return;
      }
      if (result.code === "STALE") {
        setOpen(false);
        setStale(result.error);
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
        setErrors(result.fieldErrors);
        focusFirstInvalid(formRef.current);
        return;
      }
      setFormError(result.error);
    });
  }

  const summary = Object.entries(errors).map(([key, message]) => ({
    fieldId: FIELD_IDS[key as keyof typeof FIELD_IDS] ?? key,
    message,
  }));

  /** Clears a field's message as soon as what's typed is fine. */
  function recheck(next: { pairs: string; failed: string }) {
    if (!errors.pairs && !errors.failedPairs) return;
    const parsed = parseBatchCounts(batch.code, {
      pairs: next.pairs,
      failedPairs: next.failed,
    });
    const now = parsed.ok ? {} : parsed.errors;
    setErrors(({ pairs: _p, failedPairs: _f, ...rest }) => ({
      ...rest,
      ...(errors.pairs && now.pairs ? { pairs: now.pairs } : {}),
      ...(errors.failedPairs && now.failedPairs ? { failedPairs: now.failedPairs } : {}),
    }));
  }

  const numberField = (
    key: "pairs" | "failedPairs",
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => {
    const id = FIELD_IDS[key];
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={id} className="text-base">
          {label}
        </Label>
        <div className="relative">
          <Input
            id={id}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            className="h-12 pr-16 text-xl tabular-nums"
            value={value}
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? `${id}-error` : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
            pairs
          </span>
        </div>
        <FieldError id={`${id}-error`} message={errors[key]} />
      </div>
    );
  };

  return (
    <>
      <Button
        variant={mode === "finish" ? "primary" : "secondary"}
        // One size on every card; the phone's bottom bar is full width and h-11 (D-096).
        className={cn("sm:w-full", primary && "max-sm:h-11 max-sm:w-full")}
        onClick={() => {
          reset();
          setStale(null);
          setOpen(true);
        }}
      >
        {mode === "correct" ? <Pencil aria-hidden /> : <CircleCheck aria-hidden />}
        {mode === "finish" ? buttonLabel : "Correct"}
        <span className="sr-only"> {batch.code}</span>
      </Button>
      {stale && (
        <Alert tone="info" className="mt-2">
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
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Drop ?finish= on close, so the same notice link opens it again later.
          if (!next && autoOpen) router.replace("/batches", { scroll: false });
        }}
      >
        <DialogContent
          size="lg"
          className={cn(
            "max-h-[90dvh] overflow-x-hidden overflow-y-auto",
            // A sheet at the bottom of a phone (D-096).
            "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none",
            "max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          )}
        >
          <DialogTitle>
            {mode === "finish" ? `Finish ${batch.code}` : `Correct ${batch.code}`}
          </DialogTitle>
          <DialogDescription>
            {batch.code} · {batch.dayLabel ? `${batch.dayLabel}, ` : ""}
            {batch.times}. Count the pairs that left Finishing in this batch, not a running total.
          </DialogDescription>
          <form
            ref={formRef}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <FormErrorSummary errors={summary} outcome="saved" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] items-start gap-4">
              {numberField(
                "pairs",
                `Pairs finished in ${batch.code} (${batch.times.split(",")[0]})`,
                pairs,
                (v) => {
                  setPairs(v);
                  recheck({ pairs: v, failed });
                },
              )}
              {numberField("failedPairs", "Of these, failed inspection", failed, (v) => {
                setFailed(v);
                recheck({ pairs, failed: v });
              })}
            </div>
            {workforceLine !== undefined && (
              <p className="text-sm">
                <span className="text-muted-foreground">Shoe Constructors present today: </span>
                {workforceLine ?? "Attendance not taken yet. Ask the Floor Manager."}
              </p>
            )}
            {mode === "finish" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="batch-notes">
                  Notes <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="batch-notes"
                  rows={2}
                  value={notes}
                  placeholder="e.g. Sole press down for 30 minutes"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="batch-reason">Why are you correcting it?</Label>
                <Textarea
                  id="batch-reason"
                  rows={2}
                  value={reason}
                  placeholder="e.g. Counted one rack twice"
                  aria-invalid={!!errors.reason}
                  aria-describedby={errors.reason ? "batch-reason-error" : undefined}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (errors.reason && correctionReasonSchema.safeParse(e.target.value).success)
                      setErrors(({ reason: _gone, ...rest }) => rest);
                  }}
                />
                <FieldError id="batch-reason-error" message={errors.reason} />
              </div>
            )}
            {formError && <Alert tone="danger">{formError}</Alert>}
            <DialogFooter className="max-sm:flex-col-reverse">
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="max-sm:h-11">
                  Not now
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending} className="max-sm:h-11">
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                {mode === "finish" ? `Finish ${batch.code}` : "Save correction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
