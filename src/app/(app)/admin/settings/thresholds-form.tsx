"use client";

import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { useState, useTransition } from "react";
import { CircleCheck, CircleX, LoaderCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeThresholds, validateThresholds } from "@/lib/admin-rules";
import { saveThresholdsAction } from "./actions";

/**
 * The two decision thresholds (D-011), edited as percentages with a live description of the
 * resulting bands, so the admin sees what a change means before saving.
 */
export function ThresholdsForm({ reject, rework }: { reject: number; rework: number }) {
  const [values, setValues] = useState({
    rejectPercent: String(Math.round(reject * 1000) / 10),
    reworkPercent: String(Math.round(rework * 1000) / 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const r = Number(values.rejectPercent) / 100;
  const w = Number(values.reworkPercent) / 100;
  const valid =
    values.rejectPercent !== "" &&
    values.reworkPercent !== "" &&
    validateThresholds({ rejectAtOrAbove: r, reworkAtOrAbove: w }).length === 0;
  const bands = valid ? describeThresholds({ rejectAtOrAbove: r, reworkAtOrAbove: w }) : null;
  const changed = Math.abs(r - reject) > 1e-9 || Math.abs(w - rework) > 1e-9;

  const field = (key: "rejectPercent" | "reworkPercent", label: string, hint: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={key}>{label}</Label>
      <div className="relative w-40">
        <Input
          id={key}
          inputMode="decimal"
          autoComplete="off"
          className="pr-8"
          value={values[key]}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : `${key}-hint`}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
      {errors[key] ? (
        <p id={`${key}-error`} className="text-sm text-reject">
          {errors[key]}
        </p>
      ) : (
        <p id={`${key}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setFormError(null);
        startTransition(async () => {
          const result = await saveThresholdsAction(values);
          if (result.ok) {
            setErrors({});
            toast.success("Thresholds saved. New scans use them from now on.");
          } else if (result.fieldErrors) {
            setErrors(result.fieldErrors);
            focusFirstInvalid(form);
          } else setFormError(result.error);
        });
      }}
    >
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="flex gap-8">
        {field(
          "rejectPercent",
          "Reject at or above",
          "The camera’s confidence for any active defect.",
        )}
        {field("reworkPercent", "Rework at or above", "Must be lower than Reject.")}
      </div>

      <div className="rounded-lg border bg-card p-4" aria-live="polite">
        <p className="mb-3 text-sm font-medium">What the camera will decide</p>
        {bands ? (
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center gap-2">
              <CircleX aria-hidden className="size-4 text-reject" />
              <span className="w-20 font-medium">Reject</span> {bands.reject}
            </li>
            <li className="flex items-center gap-2">
              <Wrench aria-hidden className="size-4 text-rework" />
              <span className="w-20 font-medium">Rework</span> {bands.rework}
            </li>
            <li className="flex items-center gap-2">
              <CircleCheck aria-hidden className="size-4 text-pass" />
              <span className="w-20 font-medium">Pass</span> {bands.pass}, or no defect found
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Enter two values between 0 and 100, with Rework below Reject.
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          An unknown defect class always goes to the review queue. Scans already taken keep the
          thresholds they were decided with.
        </p>
      </div>

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="submit" disabled={pending || !changed}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save thresholds
        </Button>
        {!changed && <span className="text-sm text-muted-foreground">No changes yet.</span>}
      </div>
    </form>
  );
}
