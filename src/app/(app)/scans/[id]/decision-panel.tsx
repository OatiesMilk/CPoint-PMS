"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { VerdictBadge } from "@/components/features/verdict-badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Verdict } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { decideScanAction } from "../actions";

const CHOICES = [
  { verdict: "PASS", hint: "Goes on to cutting." },
  { verdict: "REWORK", hint: "Sent to the repair station." },
  { verdict: "REJECT", hint: "Pulled out and kept as salvage." },
] as const;
type Choice = (typeof CHOICES)[number]["verdict"];

type Props = { scanId: string; label: string; finalVerdict: Verdict | null };

function VerdictChoices({
  value,
  onChange,
  exclude,
}: {
  value: Choice | null;
  onChange: (v: Choice) => void;
  exclude?: Verdict | null;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Decision</legend>
      {CHOICES.filter((c) => c.verdict !== exclude).map((c) => (
        <label
          key={c.verdict}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors duration-(--dur-fast) hover:bg-accent/60",
            value === c.verdict && "border-ring bg-accent",
          )}
        >
          <input
            type="radio"
            name="verdict"
            value={c.verdict}
            checked={value === c.verdict}
            onChange={() => onChange(c.verdict)}
            className="size-4 accent-(--primary)"
          />
          <VerdictBadge verdict={c.verdict} />
          <span className="text-sm text-muted-foreground">{c.hint}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Decide a NEEDS_REVIEW scan, or override the camera's decision (reason required). */
export function DecisionPanel({ scanId, label, finalVerdict }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; stale: boolean } | null>(null);
  const reviewing = finalVerdict === null;

  function submit() {
    if (!choice) return setFieldError("Choose a decision.");
    if (!reviewing && reason.trim().length < 3)
      return setFieldError(
        "Enter a reason for changing the camera's decision (at least 3 characters).",
      );
    setFieldError(null);
    setError(null);
    startTransition(async () => {
      const result = await decideScanAction(scanId, {
        verdict: choice,
        reason,
        expectedFinalVerdict: finalVerdict,
      });
      if (result.ok) {
        toast.success(
          `${label}: ${choice === "PASS" ? "passed" : choice === "REWORK" ? "sent to rework" : "rejected"}.`,
        );
        setOpen(false);
        setChoice(null);
        setReason("");
        return;
      }
      if (result.fieldErrors?.reason) return setFieldError(result.fieldErrors.reason);
      setOpen(false);
      setError({ message: result.error, stale: result.code === "STALE" });
    });
  }

  const form = (
    <div className="flex flex-col gap-4">
      <VerdictChoices value={choice} onChange={setChoice} exclude={finalVerdict} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="decision-reason">
          Reason{" "}
          {reviewing && <span className="font-normal text-muted-foreground">(optional)</span>}
        </Label>
        <Textarea
          id="decision-reason"
          rows={2}
          value={reason}
          placeholder={
            reviewing
              ? "e.g. New defect type, looks like a scratch"
              : "e.g. Surface scuff only, can be buffed"
          }
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "decision-error" : undefined}
          onChange={(e) => setReason(e.target.value)}
        />
        {fieldError && (
          <p id="decision-error" className="text-sm text-reject">
            {fieldError}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert tone={error.stale ? "info" : "danger"}>
          <span>{error.message}</span>
          {error.stale && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 self-start"
              onClick={() => router.refresh()}
            >
              <RefreshCw aria-hidden />
              Refresh
            </Button>
          )}
        </Alert>
      )}

      {reviewing ? (
        <>
          {form}
          <Button onClick={submit} disabled={pending}>
            {pending && <LoaderCircle aria-hidden className="animate-spin" />}
            Save decision
          </Button>
        </>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Override decision…
          </Button>
          <DialogContent>
            <DialogTitle>Override {label}?</DialogTitle>
            <DialogDescription>
              The camera decided <strong>{finalVerdict?.toLowerCase().replace("_", " ")}</strong>.
              Your decision and reason are recorded, and the repair or salvage record is updated to
              match.
            </DialogDescription>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex flex-col gap-4"
            >
              {form}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Keep the decision
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={pending}>
                  {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                  Override
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
