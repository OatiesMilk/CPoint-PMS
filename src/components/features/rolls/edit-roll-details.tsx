"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil } from "lucide-react";
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
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import {
  areaEditable,
  planRollEdit,
  type RollEditCurrent,
  type RollEditField,
} from "@/lib/roll-rules";

type Result =
  { ok: true } | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

const REASON_MESSAGE = "Say why you are correcting this roll, at least 5 characters.";

/**
 * Edit details (the Floor Manager, Phase 35B, A-104): a roll's tag number, the day it was received,
 * its return note (once a decision exists) and its area until Finish roll, always with a reason. The
 * area is shown but fixed after Finish roll, with the reason why. Only changed fields are sent.
 */
export function EditRollDetails({
  code,
  updatedAt,
  current,
  today,
  action,
}: {
  code: string;
  updatedAt: string;
  current: RollEditCurrent;
  /** Manila's date, for "not after today". */
  today: string;
  /** updateRollAction bound to the roll's id. */
  action: (input: Record<string, unknown>) => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const start = () => ({
    tagCode: current.tagCode ?? "",
    receivedOn: current.receivedOn ?? "",
    areaSqFt: current.areaSqFt === null ? "" : String(current.areaSqFt),
    returnNote: current.returnNote ?? "",
  });
  const [values, setValues] = useState(start);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Partial<Record<RollEditField | "reason" | "form", string>>>(
    {},
  );
  const [stale, setStale] = useState<string | null>(null);

  const showArea = current.fromInventory && current.areaSqFt !== null;
  const areaOpen = areaEditable(current);
  const showReceived = current.receivedOn !== null;
  const showNote = current.returnDecision !== null;
  const initial = start();

  function changed(): Record<string, string> {
    const out: Record<string, string> = {};
    (Object.keys(initial) as RollEditField[]).forEach((key) => {
      const hidden =
        (key === "areaSqFt" && (!showArea || !areaOpen)) ||
        (key === "receivedOn" && !showReceived) ||
        (key === "returnNote" && !showNote);
      if (!hidden && values[key] !== initial[key]) out[key] = values[key];
    });
    return out;
  }

  function submit() {
    const edits = changed();
    const found: typeof errors = {};
    const plan = planRollEdit(current, edits, today);
    if (!plan.ok) Object.assign(found, plan.errors);
    if (reason.trim().length < 5) found.reason = REASON_MESSAGE;
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const result = await action({
        ...edits,
        reason: reason.trim(),
        expectedUpdatedAt: updatedAt,
      });
      if (result.ok) {
        toast.success(`${code} corrected. The old and new values are kept in the audit log.`);
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
        setErrors(result.fieldErrors);
        focusFirstInvalid(formRef.current);
        return;
      }
      if (result.code === "STALE" || result.code === "CONFLICT") {
        setOpen(false);
        setStale(result.error);
        return;
      }
      setErrors({ form: result.error });
    });
  }

  const field = (
    key: RollEditField,
    label: string,
    node: (props: { id: string; invalid: boolean; describedBy?: string }) => React.ReactNode,
    hint?: string,
  ) => {
    const id = `roll-edit-${key}`;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {node({ id, invalid: !!errors[key], describedBy: errors[key] ? `${id}-error` : undefined })}
        {hint && !errors[key] && <p className="text-sm text-muted-foreground">{hint}</p>}
        <FieldError id={`${id}-error`} message={errors[key]} />
      </div>
    );
  };

  const set = (key: RollEditField, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors(({ [key]: _gone, form: _form, ...rest }) => rest);
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="secondary"
          onClick={() => {
            setValues(start());
            setReason("");
            setErrors({});
            setStale(null);
            setOpen(true);
          }}
        >
          <Pencil aria-hidden />
          Edit details
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
            Refresh
          </Button>
        </Alert>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Edit details of {code}</DialogTitle>
          <DialogDescription>
            Correct a mistake in what was entered. The supplier and the leather item stay as they
            are, and its place changes with Move. Both the old and the new value go in the audit
            log.
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
            {field("tagCode", "Tag number", ({ id, invalid, describedBy }) => (
              <Input
                id={id}
                value={values.tagCode}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(e) => set("tagCode", e.target.value)}
              />
            ))}
            {showReceived &&
              field("receivedOn", "Received on", ({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  type="date"
                  max={today}
                  value={values.receivedOn}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(e) => set("receivedOn", e.target.value)}
                />
              ))}
            {showArea &&
              field(
                "areaSqFt",
                "Area (sq ft)",
                ({ id, invalid, describedBy }) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    value={values.areaSqFt}
                    disabled={!areaOpen}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    onChange={(e) => set("areaSqFt", e.target.value)}
                  />
                ),
                areaOpen
                  ? undefined
                  : "Fixed after Finish roll: the defect share and the return mark were worked out from it.",
              )}
            {showNote &&
              field("returnNote", "Return note", ({ id, invalid, describedBy }) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={values.returnNote}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(e) => set("returnNote", e.target.value)}
                />
              ))}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roll-edit-reason">Why are you correcting it?</Label>
              <Textarea
                id="roll-edit-reason"
                rows={2}
                value={reason}
                placeholder="e.g. The tag was read upside down"
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? "roll-edit-reason-error" : undefined}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errors.reason && e.target.value.trim().length >= 5)
                    setErrors(({ reason: _gone, ...rest }) => rest);
                }}
              />
              <FieldError id="roll-edit-reason-error" message={errors.reason} />
            </div>
            {errors.form && <Alert tone="danger">{errors.form}</Alert>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Not now
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                Save correction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
