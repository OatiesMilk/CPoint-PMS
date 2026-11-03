"use client";

import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { useState, useTransition } from "react";
import { CircleCheck, CircleX, LoaderCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FOUND_AT_MESSAGE,
  RETURN_LIMIT_MESSAGE,
  validateFoundAt,
  validateReturnLimit,
} from "@/lib/admin-rules";
import { saveThresholdsAction } from "./actions";

/** One percentage box with its hint, or the message naming the fix. */
function PercentField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error: string | undefined;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative w-40">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pr-8"
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-reject">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * "A defect counts as found at" (D-053), the one number of the Pass or Reject rule (D-093), and
 * the supplier limit (Phase 30C, C-9), with a plain description of what they mean, so the admin
 * sees what a change does before saving.
 */
export function ThresholdsForm({ found, returnLimit }: { found: number; returnLimit: number }) {
  const [value, setValue] = useState(String(Math.round(found * 1000) / 10));
  const [limit, setLimit] = useState(String(returnLimit));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const f = Number(value) / 100;
  const l = Number(limit);
  // The server's own checks, shown once a field has been left, then live while it is wrong.
  const checks: Record<string, string | undefined> = {
    foundPercent:
      value.trim() === "" || validateFoundAt(f).length > 0 ? FOUND_AT_MESSAGE : undefined,
    returnPercent:
      limit.trim() === "" || validateReturnLimit(l).length > 0 ? RETURN_LIMIT_MESSAGE : undefined,
  };
  const errorOf = (key: string) => serverErrors[key] ?? (touched[key] ? checks[key] : undefined);
  const changed = Math.abs(f - found) > 1e-9 || Math.abs(l - returnLimit) > 1e-9;
  const shown = checks.foundPercent ? "…" : `${value.trim()}%`;
  const shownLimit = checks.returnPercent ? "…" : `${limit.trim()}%`;
  const edit = (key: string, set: (v: string) => void) => (v: string) => {
    set(v);
    setServerErrors(({ [key]: _, ...rest }) => rest);
  };

  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setFormError(null);
        setTouched({ foundPercent: true, returnPercent: true });
        startTransition(async () => {
          const result = await saveThresholdsAction({
            foundPercent: value,
            returnPercent: limit,
          });
          if (result.ok) {
            setServerErrors({});
            toast.success("Saved. New scans use it from now on.");
          } else if (result.fieldErrors) {
            setServerErrors(result.fieldErrors);
            focusFirstInvalid(form);
          } else setFormError(result.error);
        });
      }}
    >
      {formError && <Alert tone="danger">{formError}</Alert>}
      <PercentField
        id="foundPercent"
        label="A defect counts as found at"
        value={value}
        onChange={edit("foundPercent", setValue)}
        onBlur={() => setTouched((t) => ({ ...t, foundPercent: true }))}
        error={errorOf("foundPercent")}
        hint="The camera’s confidence that a defect is there. Below it, a detection counts for nothing."
      />
      <PercentField
        id="returnPercent"
        label="Send a roll back when defects cover more than"
        value={limit}
        onChange={edit("returnPercent", setLimit)}
        onBlur={() => setTouched((t) => ({ ...t, returnPercent: true }))}
        error={errorOf("returnPercent")}
        hint="Checked when the roll is finished at Capture."
      />

      <div className="rounded-lg border bg-card p-4" aria-live="polite">
        <p className="mb-3 text-sm font-medium">What the camera will decide</p>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-start gap-2">
            <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-reject" />
            <span>
              <span className="font-medium">Reject</span> when a defect of a Not accepted type is
              found from {shown}. A type with a length limit is Not accepted from that length.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-pass" />
            <span>
              <span className="font-medium">Pass</span> otherwise: no defect, only Usable ones, or
              marks below {shown}.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Undo2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium">Too many defects</span> when more than {shownLimit} of a
              finished roll has defects. The Floor Manager decides to send it back or keep it.
            </span>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Nobody changes the verdict afterwards. Scans already taken keep the rule they were decided
          with, and finished rolls keep the limit they were checked against.
        </p>
      </div>

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="submit" disabled={pending || !changed}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save
        </Button>
        {!changed && <span className="text-sm text-muted-foreground">No changes yet.</span>}
      </div>
    </form>
  );
}
