"use client";

/*
 * Intent brief (ui-craft §1)
 * Who:   the presenter at a desk in front of the panel, moving the app's time on the spot.
 * What:  see the time the app runs at, and set it to another day and hour (or back to real time).
 * Worst: forgetting the clock is moved. The band always says "Demo clock" with the time, in the
 *        caution tone, and "Back to real time" is one click.
 */
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appNow, setClockOffsetMs, type DemoClockView } from "@/lib/clock";
import { APP_TIME_ZONE, manilaToday } from "@/lib/format";

type View = DemoClockView;
type FieldErrors = { date?: string; time?: string; form?: string };

/** "Wed, 11 Nov 2026 · 15:00" in Manila time. */
function label(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")} · ${part("hour")}:${part("minute")}`;
}

/** "15:00" in Manila time, for the time field. */
function hhmm(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

/**
 * The demo clock in the band (D-125): the app's time, ticking, and Change time to pick a Manila
 * date and time. The clock keeps running from the time set. Sets this tab's offset at once, so
 * the page's own timers follow before the refresh lands.
 */
export function DemoClockControl({ initial }: { initial: View }) {
  // The browser runs at the server's offset from the first render on.
  setClockOffsetMs(initial.offsetMs);
  const router = useRouter();
  const ids = { date: useId(), time: useId(), dateError: useId(), timeError: useId() };
  const [view, setView] = useState(initial);
  const [now, setNow] = useState(() => new Date(initial.now));
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  // A refresh brings a new reading from the server: show it (adjusting state while rendering).
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setView(initial);
    setNow(new Date(initial.now));
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(appNow()), 15_000);
    return () => clearInterval(timer);
  }, []);

  function startChange() {
    const at = appNow();
    setDate(manilaToday(at));
    setTime(hhmm(at));
    setErrors({});
    setOpen(true);
  }

  function send(body: unknown) {
    setErrors({});
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/demo/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const next: FieldErrors = {};
          const details = Array.isArray(json?.error?.details) ? json.error.details : [];
          for (const d of details as { path?: (string | number)[]; message?: string }[]) {
            const field = d.path?.[0];
            if ((field === "date" || field === "time") && !next[field]) next[field] = d.message;
          }
          if (!next.date && !next.time)
            next.form = json?.error?.message ?? "The clock wasn't changed. Try again in a moment.";
          setErrors(next);
          return;
        }
        const data = json.data as View;
        setClockOffsetMs(data.offsetMs);
        setView(data);
        setNow(new Date(data.now));
        setOpen(false);
        router.refresh();
      } catch {
        setErrors({ form: "The server can't be reached, so the clock wasn't changed." });
      }
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: FieldErrors = {};
    if (!date) next.date = "Pick the date to show, for example 2026-11-13.";
    if (!time) next.time = "Pick the time to show, for example 15:00.";
    if (next.date || next.time) {
      setErrors(next);
      return;
    }
    send({ date, time });
  }

  return (
    <div className="flex flex-col items-center gap-2" data-testid="demo-clock">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Clock aria-hidden className="size-4" />
          {view.on ? "Demo clock:" : "Real time:"}{" "}
          <time dateTime={now.toISOString()} data-testid="demo-clock-time">
            {label(now)}
          </time>
        </span>
        {!open && (
          <Button size="sm" variant="secondary" onClick={startChange} disabled={pending}>
            Change time
          </Button>
        )}
        {!open && view.on && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => send({ realTime: true })}
            disabled={pending}
          >
            Back to real time
          </Button>
        )}
      </div>
      {open && (
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-wrap items-start justify-center gap-3 text-left"
          aria-label="Set the demo clock"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={ids.date}>Date (Manila)</Label>
            <Input
              id={ids.date}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? ids.dateError : undefined}
              className="h-8 w-40"
            />
            <FieldError id={ids.dateError} message={errors.date} className="max-w-64" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={ids.time}>Time</Label>
            <Input
              id={ids.time}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-invalid={errors.time ? true : undefined}
              aria-describedby={errors.time ? ids.timeError : undefined}
              className="h-8 w-32"
            />
            <FieldError id={ids.timeError} message={errors.time} className="max-w-64" />
          </div>
          <div className="flex gap-2 self-end pb-px">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Setting…" : "Set clock"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {errors.form && (
        <p role="alert" className="text-sm text-reject">
          {errors.form}
        </p>
      )}
    </div>
  );
}
