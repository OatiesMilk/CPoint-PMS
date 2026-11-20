"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, CircleAlert, LoaderCircle, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { formatManilaDateTime } from "@/lib/format";
import {
  DEFAULT_SCHEDULE,
  FACTORY_CLOSES,
  FACTORY_OPENS,
  batchTimes,
  batchesFor,
  lunchProblem,
  pairsWord,
  rollsScannedLine,
  shortInterval,
} from "@/lib/production-rules";
import { cn } from "@/lib/utils";
import type { PlanDay, PlanMonth } from "@/server/services/production.service";
import { dayPlanSchema } from "@/server/validators/production.validator";
import { markDayAction, saveDayPlanAction } from "../actions";

const WEEK_HEADS = [
  { short: "Mon", label: "Monday" },
  { short: "Tue", label: "Tuesday" },
  { short: "Wed", label: "Wednesday" },
  { short: "Thu", label: "Thursday" },
  { short: "Fri", label: "Friday" },
  { short: "Sat", label: "Saturday" },
  { short: "Sun", label: "Sunday" },
];

/** A weekday from today on opens its dialog; weekends and past days can't be clicked (D-114). */
const clickable = (d: PlanDay) => !d.weekend && !d.past;

/** What a day cell says, in words for screen readers too. */
function status(d: PlanDay): string {
  if (d.weekend) return "Weekend";
  if (d.kind === "NON_WORKING") return "Non-working / Holiday";
  if (d.plan) return d.plan.short;
  if (d.past) return "No plan";
  return d.isToday ? "Not planned yet" : "Not planned";
}

function DayContent({ d }: { d: PlanDay }) {
  return (
    <>
      <span className="flex items-center justify-between gap-1">
        <span className={cn("text-base font-semibold tabular-nums", d.isToday && "text-primary")}>
          {Number(d.day.slice(8))}
        </span>
        {d.isToday && <Badge tone="brand">Today</Badge>}
      </span>
      {d.kind === "NON_WORKING" ? (
        <span className="flex items-start gap-1 text-xs font-medium">
          <CalendarOff aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Non-working / Holiday
        </span>
      ) : d.plan ? (
        <span className="flex flex-col gap-0.5 text-xs">
          <span className="font-medium text-foreground">
            {[
              d.plan.rollsPlanned !== null &&
                `${d.plan.rollsPlanned} roll${d.plan.rollsPlanned === 1 ? "" : "s"}`,
              d.plan.quota !== null && pairsWord(d.plan.quota),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="text-muted-foreground">{shortInterval(d.plan.intervalMinutes)}</span>
          {d.rollsScanned !== null && (
            <span className="mt-1 border-t pt-1 text-muted-foreground">
              {rollsScannedLine(d.rollsScanned, d.plan.rollsPlanned, d.rollsReturned ?? 0)}
            </span>
          )}
        </span>
      ) : d.weekend ? null : (
        <span
          className={cn(
            "flex items-start gap-1 text-xs",
            d.isToday ? "font-medium text-caution" : "text-muted-foreground",
          )}
        >
          {d.isToday && <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
          {status(d)}
        </span>
      )}
    </>
  );
}

const cellClass = (d: PlanDay) =>
  cn(
    "flex min-h-32 min-w-0 flex-1 flex-col gap-1.5 rounded-md border p-2.5 text-left transition-colors duration-(--dur-fast)",
    d.weekend
      ? "border-transparent bg-muted/40 text-muted-foreground"
      : d.past
        ? "bg-muted/40 text-muted-foreground"
        : "bg-card shadow-1",
    d.kind === "NON_WORKING" && "border-dashed",
    d.isToday && "border-primary ring-1 ring-primary",
  );

/**
 * The month (D-114): a grid of weeks, Monday to Sunday, on a desk; a list of the weekdays below
 * 640 px, so the page never scrolls sideways (D-034). A weekday from today on opens its plan.
 */
export function PlanCalendar({ data, openDay }: { data: PlanMonth; openDay: string | null }) {
  const router = useRouter();
  const byDay = new Map(data.days.map((d) => [d.day, d]));
  const [open, setOpen] = useState<string | null>(
    openDay && byDay.get(openDay) && clickable(byDay.get(openDay)!) ? openDay : null,
  );
  const current = open ? byDay.get(open) : undefined;

  const close = () => {
    setOpen(null);
    // Drop ?day= so the start-of-day link opens it again later.
    if (openDay) router.replace(`/batches/plan?month=${data.month}`, { scroll: false });
  };

  const cell = (d: PlanDay) =>
    clickable(d) ? (
      <button
        type="button"
        className={cn(
          cellClass(d),
          "hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
        )}
        aria-label={`${d.label}: ${status(d)}. ${d.editable ? "Plan this day." : "View this day."}`}
        data-testid={`plan-day-${d.day}`}
        onClick={() => setOpen(d.day)}
      >
        <DayContent d={d} />
      </button>
    ) : (
      <div
        className={cellClass(d)}
        aria-label={`${d.label}: ${status(d)}`}
        data-testid={`plan-day-${d.day}`}
      >
        <DayContent d={d} />
      </div>
    );

  return (
    <>
      <div className="hidden sm:block" data-testid="plan-calendar">
        <div role="table" aria-label="Plan calendar" className="flex flex-col gap-1">
          <div role="row" className="grid grid-cols-7 gap-1">
            {WEEK_HEADS.map((h) => (
              <div
                key={h.short}
                role="columnheader"
                className="px-2 text-sm font-medium text-muted-foreground"
              >
                <abbr title={h.label} className="no-underline">
                  {h.short}
                </abbr>
              </div>
            ))}
          </div>
          {data.weeks.map((week, i) => (
            <div key={i} role="row" className="grid grid-cols-7 gap-1">
              {week.map((day, j) => (
                <div key={day ?? `blank-${i}-${j}`} role="cell" className="flex min-w-0 flex-col">
                  {day ? cell(byDay.get(day)!) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-2 sm:hidden" aria-label="Weekdays this month">
        {data.days
          .filter((d) => !d.weekend)
          .map((d) => (
            <li key={d.day} className="flex flex-col">
              {clickable(d) ? (
                <button
                  type="button"
                  className={cn(cellClass(d), "min-h-0 hover:bg-accent")}
                  aria-label={`${d.label}: ${status(d)}. ${d.editable ? "Plan this day." : "View this day."}`}
                  onClick={() => setOpen(d.day)}
                >
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className="text-sm">{status(d)}</span>
                </button>
              ) : (
                <div className={cn(cellClass(d), "min-h-0")}>
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className="text-sm">
                    {status(d)}
                    {d.plan &&
                      d.rollsScanned !== null &&
                      ` · ${rollsScannedLine(d.rollsScanned, d.plan.rollsPlanned, d.rollsReturned ?? 0)}`}
                  </span>
                </div>
              )}
            </li>
          ))}
      </ul>

      <Dialog open={!!current} onOpenChange={(next) => !next && close()}>
        {current && (
          <DialogContent size="lg" className="max-h-[90dvh] overflow-x-hidden overflow-y-auto">
            <DayDialogBody
              key={`${current.day}-${current.updatedAt ?? "new"}`}
              day={current}
              suggestion={data.suggestion}
              onDone={close}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

const FIELD_IDS: Record<string, string> = {
  rollsPlanned: "plan-rolls",
  quota: "plan-quota",
  intervalMinutes: "plan-interval",
  shiftStart: "plan-shift-start",
  shiftEnd: "plan-shift-end",
};

function DayDialogBody({
  day,
  suggestion,
  onDone,
}: {
  day: PlanDay;
  suggestion: PlanMonth["suggestion"];
  onDone: () => void;
}) {
  const router = useRouter();
  const p = day.plan;
  const [rolls, setRolls] = useState(p?.rollsPlanned === null || !p ? "" : String(p.rollsPlanned));
  const [quota, setQuota] = useState(p?.quota ? String(p.quota) : "");
  // A converted day may hold an old interval (1 to 3 hours); a new save offers 4 h or end of day.
  const [interval, setIntervalValue] = useState(
    p ? (p.intervalMinutes === null ? "end" : p.intervalMinutes === 240 ? "240" : "") : "240",
  );
  const [shiftStart, setShiftStart] = useState(p?.shiftStart ?? DEFAULT_SCHEDULE.shiftStart);
  const [shiftEnd, setShiftEnd] = useState(p?.shiftEnd ?? DEFAULT_SCHEDULE.shiftEnd);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ text: string; stale: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const values = {
    rollsPlanned: rolls,
    quota,
    suggestedQuota: suggestion.pairs,
    intervalMinutes: interval,
    shiftStart,
    shiftEnd,
    expectedUpdatedAt: day.updatedAt,
  };
  const parsed = dayPlanSchema.safeParse(values);
  const shift = parsed.success
    ? { shiftStart: parsed.data.shiftStart, shiftEnd: parsed.data.shiftEnd }
    : null;
  const lunchOutside = day.lunch && shift ? lunchProblem(day.lunch, shift) : null;
  const preview = parsed.success
    ? batchesFor(
        {
          shiftStart: parsed.data.shiftStart,
          shiftEnd: parsed.data.shiftEnd,
          intervalMinutes: parsed.data.intervalMinutes,
        },
        day.lunch && !lunchOutside ? [day.lunch] : [],
        day.day,
      )
        .map((b) => `${b.code} ${batchTimes(b)}`)
        .join("; ")
    : null;

  function failed(result: { error: string; code?: string; fieldErrors?: Record<string, string> }) {
    if (result.fieldErrors && Object.keys(result.fieldErrors).some((k) => FIELD_IDS[k])) {
      setErrors(result.fieldErrors);
      focusFirstInvalid(formRef.current);
      return;
    }
    setFormError({ text: result.error, stale: result.code === "STALE" });
  }

  function save() {
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
      const result = await saveDayPlanAction(day.day, values);
      if (!result.ok) return failed(result);
      toast.success(
        result.saved ? `Plan saved for ${day.label}.` : "Nothing changed, so nothing was saved.",
      );
      onDone();
      router.refresh();
    });
  }

  function mark(nonWorking: boolean) {
    setFormError(null);
    startTransition(async () => {
      const result = await markDayAction(day.day, nonWorking, {
        expectedUpdatedAt: day.updatedAt,
      });
      if (!result.ok) return failed(result);
      toast.success(
        nonWorking
          ? `${day.label} is marked Non-working / Holiday. It has no batches.`
          : `${day.label} is a working day again. Plan it so it has batches.`,
      );
      // After an undo the dialog stays open on the now empty plan.
      if (nonWorking) onDone();
      router.refresh();
    });
  }

  const errorBox = formError && (
    <Alert tone="danger">
      {formError.text}
      {formError.stale && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => router.refresh()}
        >
          <RefreshCw aria-hidden />
          Refresh
        </Button>
      )}
    </Alert>
  );
  const changed = day.changed && (
    <p className="text-sm text-muted-foreground">
      Last changed by {day.changed.by}, {formatManilaDateTime(day.changed.at)}.
    </p>
  );

  if (day.kind === "NON_WORKING")
    return (
      <>
        <DialogTitle>{day.label}: Non-working / Holiday</DialogTitle>
        <DialogDescription>
          This day has no batches, no plan notice and no stock reminder.
        </DialogDescription>
        {changed}
        {!day.editable && day.lockedReason && <Alert tone="info">{day.lockedReason}</Alert>}
        {errorBox}
        <DialogFooter className="max-sm:flex-col-reverse">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Close
            </Button>
          </DialogClose>
          {day.editable && (
            <Button type="button" disabled={pending} onClick={() => mark(false)}>
              {pending ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Undo2 aria-hidden />
              )}
              Undo, make it a working day
            </Button>
          )}
        </DialogFooter>
      </>
    );

  if (!day.editable)
    return (
      <>
        <DialogTitle>Plan for {day.label}</DialogTitle>
        <DialogDescription>{p ? p.short : "Not planned."}</DialogDescription>
        {p && <p className="text-sm">{p.batches || "No batches."}</p>}
        {p && day.rollsScanned !== null && (
          <p className="text-sm">
            {rollsScannedLine(day.rollsScanned, p.rollsPlanned)} so far
            {(day.rollsReturned ?? 0) > 0
              ? `: ${day.rollsScanned - (day.rollsReturned ?? 0)} used, ${day.rollsReturned} returned to the supplier (over the defect limit).`
              : "."}
          </p>
        )}
        {changed}
        {day.lockedReason && <Alert tone="info">{day.lockedReason}</Alert>}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </>
    );

  const describedBy = (key: string, hint?: string) =>
    [errors[key] ? `${FIELD_IDS[key]}-error` : null, hint].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <DialogTitle>Plan for {day.label}</DialogTitle>
      <DialogDescription>
        {p
          ? "Change the plan. Batches follow it from now on."
          : "Plan this day so it has batches. Everything is for the whole line, never per person."}
      </DialogDescription>
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        data-testid="day-plan-form"
      >
        <FormErrorSummary
          errors={Object.entries(errors).map(([k, message]) => ({
            fieldId: FIELD_IDS[k] ?? k,
            message,
          }))}
          outcome="saved"
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] items-start gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-rolls">Rolls to be used</Label>
            <Input
              id="plan-rolls"
              inputMode="numeric"
              autoComplete="off"
              value={rolls}
              aria-invalid={!!errors.rollsPlanned}
              aria-describedby={describedBy("rollsPlanned", "plan-rolls-hint")}
              onChange={(e) => setRolls(e.target.value)}
            />
            <FieldError id="plan-rolls-error" message={errors.rollsPlanned} />
            <p id="plan-rolls-hint" className="text-sm text-muted-foreground">
              An estimate. Shoe Constructors may start more.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-quota">Quota (pairs that pass)</Label>
            <div className="relative">
              <Input
                id="plan-quota"
                inputMode="numeric"
                autoComplete="off"
                className="pr-14"
                value={quota}
                aria-invalid={!!errors.quota}
                aria-describedby={describedBy("quota")}
                onChange={(e) => setQuota(e.target.value)}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                pairs
              </span>
            </div>
            <FieldError id="plan-quota-error" message={errors.quota} />
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 rounded-md bg-muted/60 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <Sparkles aria-hidden className="size-4" />
            {suggestion.pairs === null
              ? "No quota suggestion yet"
              : `Suggested: ${suggestion.pairs} pairs`}
          </p>
          {suggestion.pairs === null ? (
            <p className="text-muted-foreground">{suggestion.reason}</p>
          ) : (
            <>
              <p>{suggestion.sentence}</p>
              {suggestion.perConstructor && (
                <p className="text-muted-foreground">{suggestion.perConstructor}</p>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQuota(String(suggestion.pairs));
                  setErrors(({ quota: _gone, ...rest }) => rest);
                }}
              >
                Use suggestion
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] items-start gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-interval">Check-in interval</Label>
            <Select
              id="plan-interval"
              value={interval}
              aria-invalid={!!errors.intervalMinutes}
              aria-describedby={describedBy("intervalMinutes")}
              onChange={(e) => setIntervalValue(e.target.value)}
            >
              {interval === "" && <option value="">Choose…</option>}
              <option value="240">Every 4 hours</option>
              <option value="end">Once at the end of the day</option>
            </Select>
            <FieldError id="plan-interval-error" message={errors.intervalMinutes} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-shift-start">Shift start</Label>
            <Input
              id="plan-shift-start"
              type="time"
              min={FACTORY_OPENS}
              max={FACTORY_CLOSES}
              value={shiftStart}
              aria-invalid={!!errors.shiftStart}
              aria-describedby={describedBy("shiftStart", "plan-hours")}
              onChange={(e) => setShiftStart(e.target.value)}
            />
            <FieldError id="plan-shift-start-error" message={errors.shiftStart} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-shift-end">Shift end</Label>
            <Input
              id="plan-shift-end"
              type="time"
              min={FACTORY_OPENS}
              max={FACTORY_CLOSES}
              value={shiftEnd}
              aria-invalid={!!errors.shiftEnd}
              aria-describedby={describedBy("shiftEnd", "plan-hours")}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
            <FieldError id="plan-shift-end-error" message={errors.shiftEnd} />
          </div>
        </div>
        <p id="plan-hours" className="-mt-3 text-sm text-muted-foreground">
          The factory works {FACTORY_OPENS} to {FACTORY_CLOSES}. A shorter shift is fine.
        </p>

        <div className="flex flex-col gap-1 text-sm" aria-live="polite">
          <p>
            <span className="font-medium">Batches: </span>
            {preview || "Fill in the shift and the interval to see them."}
          </p>
          {lunchOutside && (
            <p className="text-muted-foreground">
              Lunch ({day.lunch!.startTime}–{day.lunch!.endTime}) is outside this shift, so the
              batches don’t pause for it.
            </p>
          )}
        </div>
        {changed}
        {errorBox}
        <DialogFooter className="flex-wrap max-sm:flex-col-reverse sm:justify-between">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => mark(true)}>
            <CalendarOff aria-hidden />
            Mark Non-working / Holiday
          </Button>
          <div className="flex gap-2 max-sm:flex-col-reverse">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Not now
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              Save plan
            </Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}
