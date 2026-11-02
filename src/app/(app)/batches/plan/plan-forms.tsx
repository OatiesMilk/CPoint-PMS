"use client";

import { useRef, useState, useTransition } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import {
  DEFAULT_SCHEDULE,
  FACTORY_CLOSES,
  FACTORY_DAYS,
  FACTORY_OPENS,
  INTERVAL_MINUTES,
  WEEKDAYS,
  batchTimes,
  batchesFor,
  describeInterval,
  type BreakRule,
  type Suggestion,
} from "@/lib/production-rules";
import { quotaPairsSchema, scheduleSchema } from "@/server/validators/production.validator";
import { saveQuotaAction, saveScheduleAction } from "../actions";

const FIELD_IDS: Record<string, string> = {
  shiftStart: "shift-start",
  shiftEnd: "shift-end",
  intervalMinutes: "interval",
  workingDays: "working-days",
};

/**
 * When batches end (D-097, D-105): the shift, how often (every 1 to 4 hours of working time, or
 * once at the end of the day, C-2) and the working days, inside the factory's hours (Monday to
 * Friday, 08:00 to 17:00). A change applies from tomorrow, so today's
 * batches stay put. The preview uses tomorrow's lunch, which the System Admin sets (C-3).
 */
export function ScheduleForm({
  current,
  tomorrow,
  lunch,
}: {
  current: {
    shiftStart: string;
    shiftEnd: string;
    intervalMinutes: number | null;
    workingDays: number[];
  } | null;
  tomorrow: string;
  lunch: BreakRule | null;
}) {
  const [shiftStart, setShiftStart] = useState(current?.shiftStart ?? FACTORY_OPENS);
  const [shiftEnd, setShiftEnd] = useState(current?.shiftEnd ?? FACTORY_CLOSES);
  const [interval, setIntervalMinutes] = useState(
    current ? (current.intervalMinutes === null ? "end" : String(current.intervalMinutes)) : "240",
  );
  // Only Monday to Friday can be ticked (D-105), so a weekend day left in an old schedule is dropped.
  const [days, setDays] = useState<number[]>(
    (current?.workingDays ?? [...DEFAULT_SCHEDULE.workingDays]).filter((d) =>
      (FACTORY_DAYS as readonly number[]).includes(d),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const values = { shiftStart, shiftEnd, intervalMinutes: interval, workingDays: days };
  const parsed = scheduleSchema.safeParse(values);
  // "Tomorrow: Batch 1 08:00–13:00, lunch 11:00–12:00; Batch 2 13:00–17:00" (any weekday shape).
  const preview = parsed.success
    ? batchesFor(
        { ...parsed.data, workingDays: [1, 2, 3, 4, 5, 6, 7] },
        lunch ? [lunch] : [],
        tomorrow,
      )
        .map((b) => `Batch ${b.number} ${batchTimes(b)}`)
        .join("; ")
    : "";

  function submit() {
    setFormError(null);
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!found[key]) found[key] = issue.message;
      }
      setErrors(found);
      return focusFirstInvalid(formRef.current);
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveScheduleAction(values);
      if (result.ok) {
        toast.success(
          `Schedule saved. It applies from ${formatAttendanceDay(result.effectiveFrom)}.`,
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
  // The shift times also point at the factory-hours hint.
  const timeDescribedBy = (key: string) =>
    [describedBy(key), "factory-hours"].filter(Boolean).join(" ");

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="schedule-form"
    >
      <FormErrorSummary
        errors={Object.entries(errors).map(([k, message]) => ({
          fieldId: FIELD_IDS[k] ?? k,
          message,
        }))}
        outcome="saved"
      />
      <p id="factory-hours" className="text-sm text-muted-foreground">
        The factory works Monday to Friday, {FACTORY_OPENS} to {FACTORY_CLOSES}.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shift-start">Shift start</Label>
          <Input
            id="shift-start"
            type="time"
            min={FACTORY_OPENS}
            max={FACTORY_CLOSES}
            value={shiftStart}
            aria-invalid={!!errors.shiftStart}
            aria-describedby={timeDescribedBy("shiftStart")}
            onChange={(e) => setShiftStart(e.target.value)}
          />
          <FieldError id="shift-start-error" message={errors.shiftStart} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shift-end">Shift end</Label>
          <Input
            id="shift-end"
            type="time"
            min={FACTORY_OPENS}
            max={FACTORY_CLOSES}
            value={shiftEnd}
            aria-invalid={!!errors.shiftEnd}
            aria-describedby={timeDescribedBy("shiftEnd")}
            onChange={(e) => setShiftEnd(e.target.value)}
          />
          <FieldError id="shift-end-error" message={errors.shiftEnd} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interval">How often</Label>
          <Select
            id="interval"
            value={interval}
            aria-invalid={!!errors.intervalMinutes}
            aria-describedby={describedBy("intervalMinutes")}
            onChange={(e) => setIntervalMinutes(e.target.value)}
          >
            {INTERVAL_MINUTES.map((m) => (
              <option key={m} value={m}>
                {describeInterval(m).replace(/^every/, "Every")}
              </option>
            ))}
            <option value="end">Once at the end of the day</option>
          </Select>
          <FieldError id="interval-error" message={errors.intervalMinutes} />
        </div>
      </div>

      <fieldset
        id="working-days"
        tabIndex={-1}
        aria-invalid={!!errors.workingDays}
        aria-describedby={describedBy("workingDays")}
        className="flex flex-col gap-2"
      >
        <legend className="mb-1.5 text-sm font-medium">Working days</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {WEEKDAYS.map((d) => (
            <label key={d.iso} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-(--primary)"
                checked={days.includes(d.iso)}
                onChange={(e) =>
                  setDays((prev) =>
                    e.target.checked ? [...prev, d.iso].sort() : prev.filter((x) => x !== d.iso),
                  )
                }
              />
              {d.label}
            </label>
          ))}
        </div>
        <FieldError id="working-days-error" message={errors.workingDays} />
      </fieldset>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {preview
          ? `Tomorrow: ${preview}. Applies from tomorrow, ${formatAttendanceDay(tomorrow)}.`
          : `Applies from tomorrow, ${formatAttendanceDay(tomorrow)}.`}
      </p>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save schedule
        </Button>
      </div>
    </form>
  );
}

type QuotaPlan = {
  today: number | null;
  upcoming: { pairs: number; from: string } | null;
  appliesFrom: string;
  suggestion: Suggestion;
};

/**
 * The one daily quota for the whole line (D-085, D-099, C-30), counted on passed pairs (C-41). The
 * suggestion sits beside it with Use suggestion; the Floor Manager can type any other number.
 */
export function QuotaForm({ quota, today }: { quota: QuotaPlan; today: string }) {
  const [value, setValue] = useState(String(quota.upcoming?.pairs ?? quota.today ?? ""));
  const [used, setUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const s = quota.suggestion;

  function submit() {
    setFormError(null);
    const parsed = quotaPairsSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return focusFirstInvalid(formRef.current);
    }
    setError(null);
    startTransition(async () => {
      const result = await saveQuotaAction({ pairs: value, suggestedPairs: s.pairs });
      if (result.ok) {
        toast.success(
          result.saved
            ? `Daily quota saved. It applies from ${formatAttendanceDay(result.effectiveFrom)}.`
            : "Nothing changed, so nothing was saved.",
        );
        setUsed(false);
        return;
      }
      if (result.fieldErrors?.pairs) {
        setError(result.fieldErrors.pairs);
        focusFirstInvalid(formRef.current);
        return;
      }
      setFormError(result.error);
    });
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="quota-form"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(12rem,1fr)_2fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quota-pairs">Pairs per day for the whole line</Label>
          <div className="relative max-w-48">
            <Input
              id="quota-pairs"
              inputMode="numeric"
              autoComplete="off"
              className="pr-14"
              value={value}
              aria-invalid={!!error}
              aria-describedby={error ? "quota-pairs-error" : "quota-pairs-hint"}
              onChange={(e) => {
                setValue(e.target.value);
                if (error && quotaPairsSchema.safeParse(e.target.value).success) setError(null);
              }}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
              pairs
            </span>
          </div>
          <FieldError id="quota-pairs-error" message={error ?? undefined} />
          <p id="quota-pairs-hint" className="text-sm text-muted-foreground">
            {quota.today === null
              ? `No quota yet. The first one applies from today, ${formatAttendanceDay(today)}.`
              : `Today: ${quota.today} pairs. A change applies from ${formatAttendanceDay(quota.appliesFrom)}.`}
            {quota.upcoming &&
              ` From ${formatAttendanceDay(quota.upcoming.from)}: ${quota.upcoming.pairs} pairs.`}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 rounded-md bg-muted/60 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <Sparkles aria-hidden className="size-4" />
            {s.pairs === null ? "No suggestion yet" : `Suggested: ${s.pairs} pairs`}
          </p>
          {s.pairs === null ? (
            <p className="text-muted-foreground">{s.reason}</p>
          ) : (
            <>
              <p>{s.sentence}</p>
              {s.perConstructor && <p className="text-muted-foreground">{s.perConstructor}</p>}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setValue(String(s.pairs));
                  setUsed(true);
                  setError(null);
                }}
              >
                {used ? "Suggestion used" : "Use suggestion"}
              </Button>
            </>
          )}
        </div>
      </div>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save quota
        </Button>
      </div>
    </form>
  );
}
