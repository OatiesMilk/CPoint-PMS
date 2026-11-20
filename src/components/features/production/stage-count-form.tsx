"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { saveStageCountAction } from "@/app/(app)/batches/actions";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseStageCount, type Stage } from "@/lib/repair-rules";
import { cn } from "@/lib/utils";

/**
 * "Pairs here now" for a stage (Phase 34, A-72, A-73): one shared number for the whole stage, not
 * a person's count. A big keypad field on a phone (Capture), a plain one on the board.
 */
export function StageCountForm({
  stage,
  label,
  initial,
  large,
  onSaved,
}: {
  stage: Stage;
  label: string;
  initial: number | null;
  large?: boolean;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = `count-${stage}`;

  // Checked here first, so the message shows at once and without a round trip.
  function check(): boolean {
    const parsed = parseStageCount(value);
    if (parsed.ok) return true;
    setError(parsed.message);
    return false;
  }

  function submit() {
    setError(null);
    if (!check()) {
      document.getElementById(id)?.focus();
      return;
    }
    startTransition(async () => {
      const result = await saveStageCountAction({ stage, pairs: value });
      if (result.ok) {
        toast.success(`${label} counted: ${result.pairs} pair${result.pairs === 1 ? "" : "s"}.`);
        onSaved?.();
        return;
      }
      setError(result.fieldErrors?.pairs ?? result.error);
    });
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Label htmlFor={id} className={cn(large && "text-base")}>
        Pairs at {label} now
      </Label>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Input
            id={id}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            className={cn("tabular-nums", large ? "h-14 w-40 text-2xl" : "w-32")}
            value={value}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            // A non-empty entry that isn't a number says so as the person leaves the field.
            onBlur={() => {
              if (value.trim() !== "") check();
            }}
          />
          <FieldError id={`${id}-error`} message={error ?? undefined} />
        </div>
        <Button type="submit" disabled={pending} className={cn(large && "h-14 px-6 text-base")}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save count
        </Button>
      </div>
    </form>
  );
}
