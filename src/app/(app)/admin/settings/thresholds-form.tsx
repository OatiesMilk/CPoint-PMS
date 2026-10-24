"use client";

import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { useState, useTransition } from "react";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FOUND_AT_MESSAGE, validateFoundAt } from "@/lib/admin-rules";
import { saveThresholdsAction } from "./actions";

/**
 * "A defect counts as found at" (D-053), the one number of the Pass or Reject rule (D-093), with a
 * plain description of what the camera will decide, so the admin sees what a change means before
 * saving.
 */
export function ThresholdsForm({ found }: { found: number }) {
  const [value, setValue] = useState(String(Math.round(found * 1000) / 10));
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const f = Number(value) / 100;
  // The server's own check, shown once the field has been left, then live while it is wrong.
  const checked =
    value.trim() === "" || validateFoundAt(f).length > 0 ? FOUND_AT_MESSAGE : undefined;
  const error = serverError ?? (touched ? checked : undefined);
  const changed = Math.abs(f - found) > 1e-9;
  const shown = checked ? "…" : `${value.trim()}%`;

  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setFormError(null);
        setTouched(true);
        startTransition(async () => {
          const result = await saveThresholdsAction({ foundPercent: value });
          if (result.ok) {
            setServerError(null);
            toast.success("Saved. New scans use it from now on.");
          } else if (result.fieldErrors) {
            setServerError(result.fieldErrors.foundPercent ?? FOUND_AT_MESSAGE);
            focusFirstInvalid(form);
          } else setFormError(result.error);
        });
      }}
    >
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="foundPercent">A defect counts as found at</Label>
        <div className="relative w-40">
          <Input
            id="foundPercent"
            inputMode="decimal"
            autoComplete="off"
            className="pr-8"
            value={value}
            aria-invalid={!!error}
            aria-describedby={error ? "foundPercent-error" : "foundPercent-hint"}
            onChange={(e) => {
              setValue(e.target.value);
              setServerError(null);
            }}
            onBlur={() => setTouched(true)}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
        {error ? (
          <p id="foundPercent-error" className="text-sm text-reject">
            {error}
          </p>
        ) : (
          <p id="foundPercent-hint" className="text-sm text-muted-foreground">
            The camera’s confidence that a defect is there. Below it, a detection counts for
            nothing.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4" aria-live="polite">
        <p className="mb-3 text-sm font-medium">What the camera will decide</p>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-start gap-2">
            <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-reject" />
            <span>
              <span className="font-medium">Reject</span> when a defect of a Not accepted type is
              found from {shown}, or the camera sends a class the system doesn’t know.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-pass" />
            <span>
              <span className="font-medium">Pass</span> otherwise: no defect, only Usable ones, or
              marks below {shown}.
            </span>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Nobody changes the verdict afterwards. Scans already taken keep the rule they were decided
          with.
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
