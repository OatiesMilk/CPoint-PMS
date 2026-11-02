"use client";

import { useRef, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { lunchProblem } from "@/lib/production-rules";
import { lunchBreakSchema } from "@/server/validators/production.validator";
import { saveLunchBreakAction } from "./actions";

const FIELD_IDS: Record<string, string> = { startTime: "lunch-start", endTime: "lunch-end" };

/**
 * The lunch break (C-3, C-25, C-40, A-4): the same on every working day, it pauses the batch it
 * falls in, and a batch whose working time runs out at its start ends when it ends (C-26). Optional,
 * inside the shift, and a change applies from tomorrow.
 */
export function LunchBreakForm({
  initial,
  shift,
  tomorrow,
}: {
  initial: { startTime: string | null; endTime: string | null };
  shift: { shiftStart: string; shiftEnd: string } | null;
  tomorrow: string;
}) {
  const [none, setNone] = useState(initial.startTime === null);
  const [startTime, setStartTime] = useState(initial.startTime ?? "11:00");
  const [endTime, setEndTime] = useState(initial.endTime ?? "12:00");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function check(): Record<string, string> {
    const parsed = lunchBreakSchema.safeParse({ none, startTime, endTime });
    const found: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!found[key]) found[key] = issue.message;
      }
      return found;
    }
    if (!none) {
      const problem = lunchProblem({ startTime, endTime }, shift);
      if (problem) found[problem.field] = problem.message;
    }
    return found;
  }

  function submit() {
    setFormError(null);
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const result = await saveLunchBreakAction({ none, startTime, endTime });
      if (result.ok) {
        toast.success(
          none
            ? `No lunch break from ${formatAttendanceDay(result.effectiveFrom)}.`
            : `Lunch ${startTime} to ${endTime} saved. It applies from ${formatAttendanceDay(result.effectiveFrom)}.`,
        );
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

  const describedBy = (key: string) => (errors[key] ? `${FIELD_IDS[key]}-error` : undefined);

  return (
    <form
      ref={formRef}
      noValidate
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="lunch-break-form"
    >
      <FormErrorSummary
        errors={Object.entries(errors).map(([k, message]) => ({
          fieldId: FIELD_IDS[k] ?? k,
          message,
        }))}
        outcome="saved"
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-(--primary)"
          checked={none}
          onChange={(e) => {
            setNone(e.target.checked);
            setErrors({});
          }}
        />
        No lunch break
      </label>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lunch-start">Lunch starts</Label>
          <Input
            id="lunch-start"
            type="time"
            value={startTime}
            disabled={none}
            aria-invalid={!!errors.startTime}
            aria-describedby={describedBy("startTime")}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <FieldError id="lunch-start-error" message={errors.startTime} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lunch-end">Lunch ends</Label>
          <Input
            id="lunch-end"
            type="time"
            value={endTime}
            disabled={none}
            aria-invalid={!!errors.endTime}
            aria-describedby={describedBy("endTime")}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <FieldError id="lunch-end-error" message={errors.endTime} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        The same on every working day.{" "}
        {shift ? `It must sit inside the shift (${shift.shiftStart} to ${shift.shiftEnd}). ` : ""}
        Applies from tomorrow, {formatAttendanceDay(tomorrow)}.
      </p>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save lunch break
        </Button>
      </div>
    </form>
  );
}
