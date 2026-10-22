"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, RefreshCw } from "lucide-react";
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
import { correctionReasonSchema, pairsSchema } from "@/server/validators/production.validator";
import { correctCheckInAction, saveCheckInAction } from "./actions";

type Props = {
  mode: "enter" | "correct";
  slot: { slotAt: string; time: string; since: string };
  shoeTypes: { id: string; name: string }[];
  /** "14 of 16 Shoe Constructors present", or null when attendance isn't taken. */
  workforceLine: string | null;
  /** For a correction: the saved check-in. */
  checkIn?: { id: string; updatedAt: string; counts: { shoeTypeId: string; pairs: number }[] };
  /** Open as soon as the page loads (the QI home's Enter count link). */
  autoOpen?: boolean;
};

/**
 * Enter count / Correct (D-084). One whole-number field per active shoe type, the constructors
 * present read-only from attendance (never blocking), optional notes; a correction needs a reason.
 */
export function CheckInDialog({ mode, slot, shoeTypes, workforceLine, checkIn, autoOpen }: Props) {
  const router = useRouter();
  // The QI home links with ?enter=next, which opens the due check-in straight away.
  const [open, setOpen] = useState(autoOpen ?? false);
  const [pending, startTransition] = useTransition();
  const initial = () =>
    Object.fromEntries(
      shoeTypes.map((t) => [
        t.id,
        String(checkIn?.counts.find((c) => c.shoeTypeId === t.id)?.pairs ?? ""),
      ]),
    );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setValues(initial());
    setNotes("");
    setReason("");
    setErrors({});
    setFormError(null);
  }

  function validate(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const t of shoeTypes) {
      const r = pairsSchema(t.name, slot.since).safeParse(values[t.id]);
      if (!r.success) out[`counts.${t.id}`] = r.error.issues[0].message;
    }
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
    const counts = shoeTypes.map((t) => ({ shoeTypeId: t.id, pairs: values[t.id] }));
    startTransition(async () => {
      const result =
        mode === "enter"
          ? await saveCheckInAction({ slotAt: slot.slotAt, counts, notes })
          : await correctCheckInAction(checkIn!.id, {
              expectedUpdatedAt: checkIn!.updatedAt,
              counts,
              reason,
            });
      if (result.ok) {
        toast.success(
          mode === "enter"
            ? `${slot.time} check-in saved.`
            : `${slot.time} check-in corrected. Both counts are kept in the audit log.`,
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
    fieldId: key === "reason" ? "checkin-reason" : `pairs-${key.replace("counts.", "")}`,
    message,
  }));

  return (
    <>
      <Button
        size="sm"
        variant={mode === "enter" ? "primary" : "ghost"}
        onClick={() => {
          reset();
          setStale(null);
          setOpen(true);
        }}
      >
        {mode === "correct" && <Pencil aria-hidden />}
        {mode === "enter" ? "Enter count" : "Correct"}
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>
            {mode === "enter" ? `${slot.time} check-in` : `Correct the ${slot.time} check-in`}
          </DialogTitle>
          <DialogDescription>
            Count the pairs that left Finishing since {slot.since}. Only what finished since then,
            not a running total.
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
            {shoeTypes.map((t) => {
              const key = `counts.${t.id}`;
              const id = `pairs-${t.id}`;
              return (
                <div key={t.id} className="flex flex-col gap-1.5">
                  <Label htmlFor={id}>
                    {t.name} finished since {slot.since}
                  </Label>
                  <div className="relative max-w-48">
                    <Input
                      id={id}
                      inputMode="numeric"
                      autoComplete="off"
                      className="pr-14"
                      value={values[t.id] ?? ""}
                      aria-invalid={!!errors[key]}
                      aria-describedby={errors[key] ? `${id}-error` : undefined}
                      onChange={(e) => {
                        const value = e.target.value;
                        setValues((v) => ({ ...v, [t.id]: value }));
                        if (errors[key] && pairsSchema(t.name, slot.since).safeParse(value).success)
                          setErrors(({ [key]: _gone, ...rest }) => rest);
                      }}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                      pairs
                    </span>
                  </div>
                  <FieldError id={`${id}-error`} message={errors[key]} />
                </div>
              );
            })}
            <p className="text-sm">
              <span className="text-muted-foreground">Shoe Constructors present today: </span>
              {workforceLine ?? "Attendance not taken yet. Ask the Floor Manager."}
            </p>
            {mode === "enter" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="checkin-notes">
                  Notes <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="checkin-notes"
                  rows={2}
                  value={notes}
                  placeholder="e.g. Sole press down for 30 minutes"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="checkin-reason">Why are you correcting it?</Label>
                <Textarea
                  id="checkin-reason"
                  rows={2}
                  value={reason}
                  placeholder="e.g. Counted one rack twice"
                  aria-invalid={!!errors.reason}
                  aria-describedby={errors.reason ? "checkin-reason-error" : undefined}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (errors.reason && correctionReasonSchema.safeParse(e.target.value).success)
                      setErrors(({ reason: _gone, ...rest }) => rest);
                  }}
                />
                <FieldError id="checkin-reason-error" message={errors.reason} />
              </div>
            )}
            {formError && <Alert tone="danger">{formError}</Alert>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Not now
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                {mode === "enter" ? "Save count" : "Save correction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
