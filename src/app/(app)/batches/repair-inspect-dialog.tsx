"use client";

import { useRef, useState, useTransition } from "react";
import { LoaderCircle, Plus, ScanSearch, Trash2 } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { STAGES, STAGE_LABEL, parseRepairResult, type Stage } from "@/lib/repair-rules";
import { inspectRepairAction } from "./actions";

type Props = {
  repair: {
    id: string;
    code: string;
    batchCode: string;
    defect: string;
    pairs: number;
    stageLabel: string;
  };
};

type Line = { stage: "" | Stage; pairs: string };

/**
 * Inspect a repair (Phase 34, A-64, A-88): of the repair's pairs, how many passed, were scrapped
 * or go back again (to which stage). The three must add up to the repair's pairs. A repair that
 * fails again can be scrapped or sent back with no limit.
 */
export function RepairInspectDialog({ repair }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [passed, setPassed] = useState("");
  const [scrapped, setScrapped] = useState("");
  const [again, setAgain] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
  const accounted =
    (Number.isInteger(num(passed)) ? num(passed) : 0) +
    (Number.isInteger(num(scrapped)) ? num(scrapped) : 0) +
    again.reduce((s, l) => s + (Number.isInteger(Number(l.pairs)) ? Number(l.pairs) : 0), 0);

  function reset() {
    setPassed("");
    setScrapped("");
    setAgain([]);
    setErrors({});
    setFormError(null);
  }

  function check(): Record<string, string> {
    const parsed = parseRepairResult(repair.pairs, {
      passedPairs: passed,
      scrappedPairs: scrapped,
      resend: again,
    });
    if (parsed.ok) return {};
    const out: Record<string, string> = {};
    if (parsed.passedPairs) out.passedPairs = parsed.passedPairs;
    if (parsed.scrappedPairs) out.scrappedPairs = parsed.scrappedPairs;
    for (const [i, m] of Object.entries(parsed.resend ?? {})) out[`resend.${i}`] = m;
    if (parsed.form) out.result = parsed.form;
    return out;
  }

  function submit() {
    setFormError(null);
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const result = await inspectRepairAction(repair.id, {
        passedPairs: passed,
        scrappedPairs: scrapped,
        resend: again,
      });
      if (result.ok) {
        toast.success(
          result.children.length
            ? `${repair.code} inspected. Sent back again as ${result.children.map((c) => c.code).join(", ")}.`
            : `${repair.code} inspected.`,
        );
        setOpen(false);
        reset();
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
    fieldId:
      key === "passedPairs"
        ? "repair-passed"
        : key === "scrappedPairs"
          ? "repair-scrapped"
          : key.startsWith("resend.")
            ? `repair-again-${key.split(".")[1]}-pairs`
            : "repair-result",
    message,
  }));

  const pairsField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    error?: string,
  ) => (
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
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
          pairs
        </span>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );

  return (
    <>
      <Button
        className="max-sm:h-11 max-sm:w-full sm:w-full"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <ScanSearch aria-hidden />
        Inspect repair
        <span className="sr-only"> {repair.code}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="lg"
          className="max-h-[90dvh] overflow-x-hidden overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none"
        >
          <DialogTitle>Inspect {repair.code}</DialogTitle>
          <DialogDescription>
            {repair.pairs} pair{repair.pairs === 1 ? "" : "s"} of {repair.defect} from{" "}
            {repair.batchCode}, back from {repair.stageLabel}. Say what happened to each pair.
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
            <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] items-start gap-4">
              {pairsField(
                "repair-passed",
                "Passed",
                passed,
                (v) => {
                  setPassed(v);
                  setErrors(({ passedPairs: _a, result: _b, ...rest }) => rest);
                },
                errors.passedPairs,
              )}
              {pairsField(
                "repair-scrapped",
                "Scrapped",
                scrapped,
                (v) => {
                  setScrapped(v);
                  setErrors(({ scrappedPairs: _a, result: _b, ...rest }) => rest);
                },
                errors.scrappedPairs,
              )}
            </div>
            {again.length > 0 && (
              <ul className="flex flex-col gap-3" aria-label="Sent back again">
                {again.map((line, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] items-end gap-3 rounded-md border p-3"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`repair-again-${i}-stage`}>Goes back to, line {i + 1}</Label>
                      <Select
                        id={`repair-again-${i}-stage`}
                        value={line.stage}
                        onChange={(e) =>
                          setAgain(
                            again.map((l, k) =>
                              k === i ? { ...l, stage: e.target.value as Stage | "" } : l,
                            ),
                          )
                        }
                      >
                        <option value="">Choose the stage</option>
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`repair-again-${i}-pairs`}>Pairs, line {i + 1}</Label>
                      <Input
                        id={`repair-again-${i}-pairs`}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={line.pairs}
                        aria-invalid={!!errors[`resend.${i}`]}
                        aria-describedby={
                          errors[`resend.${i}`] ? `repair-again-${i}-pairs-error` : undefined
                        }
                        onChange={(e) =>
                          setAgain(
                            again.map((l, k) => (k === i ? { ...l, pairs: e.target.value } : l)),
                          )
                        }
                      />
                      <FieldError
                        id={`repair-again-${i}-pairs-error`}
                        message={errors[`resend.${i}`]}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => setAgain(again.filter((_, k) => k !== i))}
                    >
                      <Trash2 aria-hidden />
                      Remove line {i + 1}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setAgain([...again, { stage: "", pairs: "" }])}
            >
              <Plus aria-hidden />
              Send some back again
            </Button>
            <p id="repair-result" role={errors.result ? "alert" : undefined} className="text-sm">
              {errors.result ? (
                <span className="text-destructive">{errors.result}</span>
              ) : (
                <span className="text-muted-foreground">
                  {accounted} of {repair.pairs} pair{repair.pairs === 1 ? "" : "s"} accounted for.
                </span>
              )}
            </p>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <DialogFooter className="max-sm:flex-col-reverse">
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="max-sm:h-11">
                  Not now
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending} className="max-sm:h-11">
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                Save inspection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
