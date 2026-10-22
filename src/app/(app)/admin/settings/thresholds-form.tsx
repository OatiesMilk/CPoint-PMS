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

type FieldKey = "rejectPercent" | "reworkPercent" | "foundPercent";
const FIELD_KEYS: FieldKey[] = ["rejectPercent", "reworkPercent", "foundPercent"];
const FIELD_FOR = {
  rejectAtOrAbove: "rejectPercent",
  reworkAtOrAbove: "reworkPercent",
  foundAtOrAbove: "foundPercent",
} as const satisfies Record<string, FieldKey>;

/**
 * The two decision thresholds (D-011), edited as percentages with a live description of the
 * resulting bands, so the admin sees what a change means before saving.
 */
export function ThresholdsForm({
  reject,
  rework,
  found,
}: {
  reject: number;
  rework: number;
  found: number;
}) {
  const [values, setValues] = useState({
    rejectPercent: String(Math.round(reject * 1000) / 10),
    reworkPercent: String(Math.round(rework * 1000) / 10),
    foundPercent: String(Math.round(found * 1000) / 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const r = Number(values.rejectPercent) / 100;
  const w = Number(values.reworkPercent) / 100;
  const f = Number(values.foundPercent) / 100;
  const blank = values.rejectPercent.trim() === "" || values.reworkPercent.trim() === "";
  const valid =
    !blank && validateThresholds({ rejectAtOrAbove: r, reworkAtOrAbove: w }).length === 0;

  // The server's own checks, shown under the field they name once it has been left (validate on
  // blur, then live while it is wrong). A server error for a field wins until that field changes.
  const checked: Partial<Record<FieldKey, string>> = {};
  for (const e of validateThresholds({ rejectAtOrAbove: r, reworkAtOrAbove: w, foundAtOrAbove: f }))
    checked[FIELD_FOR[e.path[0]]] ??= e.message;
  for (const key of FIELD_KEYS)
    if (values[key].trim() === "") checked[key] = "Enter a percentage between 0 and 100.";
  const shown = (key: FieldKey): string | undefined => {
    if (errors[key]) return errors[key];
    // Fixable below Reject is one rule, so leaving either field can show it on the Fixable field.
    const seen = touched[key] || (key === "reworkPercent" && touched.rejectPercent);
    return seen ? checked[key] : undefined;
  };
  const bands = valid ? describeThresholds({ rejectAtOrAbove: r, reworkAtOrAbove: w }) : null;
  const changed =
    Math.abs(r - reject) > 1e-9 || Math.abs(w - rework) > 1e-9 || Math.abs(f - found) > 1e-9;

  const field = (key: FieldKey, label: string, hint: string) => {
    const error = shown(key);
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={key}>{label}</Label>
        <div className="relative w-40">
          <Input
            id={key}
            inputMode="decimal"
            autoComplete="off"
            className="pr-8"
            value={values[key]}
            aria-invalid={!!error}
            aria-describedby={error ? `${key}-error` : `${key}-hint`}
            onChange={(e) => {
              setValues({ ...values, [key]: e.target.value });
              if (errors[key]) setErrors(({ [key]: _changed, ...rest }) => rest);
            }}
            onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
        {error ? (
          <p id={`${key}-error`} className="text-sm text-reject">
            {error}
          </p>
        ) : (
          <p id={`${key}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setFormError(null);
        setTouched({ rejectPercent: true, reworkPercent: true, foundPercent: true });
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
        {field("reworkPercent", "Fixable at or above", "Must be lower than Reject.")}
      </div>
      {field(
        "foundPercent",
        "A defect counts as found at",
        "Only for defect types set to Fixable or Reject when found (Defect types tab).",
      )}

      <div className="rounded-lg border bg-card p-4" aria-live="polite">
        <p className="mb-3 text-sm font-medium">
          What the camera will decide for defect types set to “By confidence”
        </p>
        {bands ? (
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center gap-2">
              <CircleX aria-hidden className="size-4 text-reject" />
              <span className="w-20 font-medium">Reject</span> {bands.reject}
            </li>
            <li className="flex items-center gap-2">
              <Wrench aria-hidden className="size-4 text-rework" />
              <span className="w-20 font-medium">Fixable</span> {bands.rework}
            </li>
            <li className="flex items-center gap-2">
              <CircleCheck aria-hidden className="size-4 text-pass" />
              <span className="w-20 font-medium">Pass</span> {bands.pass}, or no defect found
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {blank
              ? "Enter two values between 0 and 100, with Fixable below Reject."
              : "Fix the value marked above to see what the camera will decide."}
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          A defect type set to Fixable or Reject when found gets that result from{" "}
          {values.foundPercent || "…"}% confidence, however sure the model is above it. An unknown
          defect class always goes to the review queue. Scans already taken keep the rules they were
          decided with.
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
