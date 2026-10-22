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
  INTERVAL_MINUTES,
  WEEKDAYS,
  describeInterval,
  slotsFor,
  type Suggestion,
} from "@/lib/production-rules";
import { quotaPairsSchema, scheduleSchema } from "@/server/validators/production.validator";
import { saveQuotasAction, saveScheduleAction } from "../actions";

const FIELD_IDS: Record<string, string> = {
  shiftStart: "shift-start",
  shiftEnd: "shift-end",
  intervalMinutes: "interval",
  workingDays: "working-days",
};

/** The check-in schedule (D-083). A change applies from tomorrow, so today's check-ins stay put. */
export function ScheduleForm({
  current,
  tomorrow,
}: {
  current: {
    shiftStart: string;
    shiftEnd: string;
    intervalMinutes: number;
    workingDays: number[];
  } | null;
  tomorrow: string;
}) {
  const [shiftStart, setShiftStart] = useState(current?.shiftStart ?? "08:00");
  const [shiftEnd, setShiftEnd] = useState(current?.shiftEnd ?? "17:00");
  const [interval, setIntervalMinutes] = useState(String(current?.intervalMinutes ?? 240));
  const [days, setDays] = useState<number[]>(current?.workingDays ?? [1, 2, 3, 4, 5, 6]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const values = { shiftStart, shiftEnd, intervalMinutes: Number(interval), workingDays: days };
  const parsed = scheduleSchema.safeParse(values);
  const preview = parsed.success
    ? slotsFor({ ...parsed.data, workingDays: [1, 2, 3, 4, 5, 6, 7] }, tomorrow).map((s) => s.time)
    : [];

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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shift-start">Shift start</Label>
          <Input
            id="shift-start"
            type="time"
            value={shiftStart}
            aria-invalid={!!errors.shiftStart}
            aria-describedby={describedBy("shiftStart")}
            onChange={(e) => setShiftStart(e.target.value)}
          />
          <FieldError id="shift-start-error" message={errors.shiftStart} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shift-end">Shift end</Label>
          <Input
            id="shift-end"
            type="time"
            value={shiftEnd}
            aria-invalid={!!errors.shiftEnd}
            aria-describedby={describedBy("shiftEnd")}
            onChange={(e) => setShiftEnd(e.target.value)}
          />
          <FieldError id="shift-end-error" message={errors.shiftEnd} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interval">Check-in</Label>
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
        {preview.length > 0
          ? `Check-ins at ${preview.join(", ")}. Applies from tomorrow, ${formatAttendanceDay(tomorrow)}.`
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

type QuotaRow = {
  shoeTypeId: string;
  name: string;
  today: number | null;
  upcoming: { pairs: number; from: string } | null;
  appliesFrom: string;
  suggestion: Suggestion;
};

/**
 * The daily quota per shoe type (D-085), for the whole line. The suggestion sits beside each with
 * Use suggestion; the Floor Manager can type any other number.
 */
export function QuotaForm({ rows, today }: { rows: QuotaRow[]; today: string }) {
  const start = () =>
    Object.fromEntries(rows.map((r) => [r.shoeTypeId, String(r.upcoming?.pairs ?? r.today ?? "")]));
  const [values, setValues] = useState<Record<string, string>>(start);
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (rows.length === 0)
    return <p className="text-muted-foreground">No shoe types are active. Add one in Settings.</p>;

  function submit() {
    setFormError(null);
    const found: Record<string, string> = {};
    for (const r of rows) {
      const parsed = quotaPairsSchema(r.name).safeParse(values[r.shoeTypeId]);
      if (!parsed.success) found[`quotas.${r.shoeTypeId}`] = parsed.error.issues[0].message;
    }
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const result = await saveQuotasAction({
        quotas: rows.map((r) => ({
          shoeTypeId: r.shoeTypeId,
          pairs: values[r.shoeTypeId],
          suggestedPairs: r.suggestion.pairs,
        })),
      });
      if (result.ok) {
        toast.success(
          result.saved === 0
            ? "Nothing changed, so nothing was saved."
            : `${result.saved} quota${result.saved === 1 ? "" : "s"} saved.`,
        );
        setUsed({});
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
      <FormErrorSummary
        errors={Object.entries(errors).map(([k, message]) => ({
          fieldId: `quota-${k.replace("quotas.", "")}`,
          message,
        }))}
        outcome="saved"
      />
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((r) => {
          const key = `quotas.${r.shoeTypeId}`;
          const id = `quota-${r.shoeTypeId}`;
          const s = r.suggestion;
          return (
            <li
              key={r.shoeTypeId}
              className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(12rem,1fr)_2fr]"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={id}>{r.name}: pairs per day</Label>
                <div className="relative max-w-48">
                  <Input
                    id={id}
                    inputMode="numeric"
                    autoComplete="off"
                    className="pr-14"
                    value={values[r.shoeTypeId] ?? ""}
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `${id}-error` : `${id}-hint`}
                    onChange={(e) => {
                      const value = e.target.value;
                      setValues((v) => ({ ...v, [r.shoeTypeId]: value }));
                      if (errors[key] && quotaPairsSchema(r.name).safeParse(value).success)
                        setErrors(({ [key]: _gone, ...rest }) => rest);
                    }}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                    pairs
                  </span>
                </div>
                <FieldError id={`${id}-error`} message={errors[key]} />
                <p id={`${id}-hint`} className="text-sm text-muted-foreground">
                  {r.today === null
                    ? `No quota yet. The first one applies from today, ${formatAttendanceDay(today)}.`
                    : `Today: ${r.today} pairs. A change applies from ${formatAttendanceDay(r.appliesFrom)}.`}
                  {r.upcoming &&
                    ` From ${formatAttendanceDay(r.upcoming.from)}: ${r.upcoming.pairs} pairs.`}
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
                    {s.perConstructor && (
                      <p className="text-muted-foreground">{s.perConstructor}</p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setValues((v) => ({ ...v, [r.shoeTypeId]: String(s.pairs) }));
                        setUsed((u) => ({ ...u, [r.shoeTypeId]: true }));
                        setErrors(({ [key]: _gone, ...rest }) => rest);
                      }}
                    >
                      {used[r.shoeTypeId] ? "Suggestion used" : "Use suggestion"}
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save quotas
        </Button>
      </div>
    </form>
  );
}
