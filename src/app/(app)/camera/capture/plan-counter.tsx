"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { leatherRollsLine, type CapturePlanDay } from "@/lib/production-rules";

/** A day on Capture's counter as GET /api/v1/rolls/plan sends it (D-118). */
export type CapturePlanView = CapturePlanDay & { label: string };

/** Others finish rolls too; check again every minute and when the tab comes back. */
const PLAN_REFRESH_MS = 60_000;

/** What today's line says when there's no count to show. */
function todayNote(d: CapturePlanView): string | null {
  if (d.kind === "NON_WORKING") return "Today is marked Non-working / Holiday.";
  if (d.kind === "NOT_PLANNED") return "The Floor Manager hasn’t planned today yet.";
  return null;
}

/**
 * Capture's counter (Phase 30D, D-118): today's rolls scanned against the Floor Manager's plan in
 * large text, and the next planned days below it, so a constructor knows how many rolls are left.
 * `refreshRef` lets the page recount at once when this phone finishes or puts back a roll.
 */
export function PlanCounter({
  initial,
  refreshRef,
}: {
  initial: CapturePlanView[];
  refreshRef?: RefObject<(() => Promise<void>) | null>;
}) {
  const [days, setDays] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/rolls/plan", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { data: CapturePlanView[] };
      setDays(body.data);
    } catch {
      // Offline for a moment: keep the last count.
    }
  }, []);

  useEffect(() => {
    // The page calls this when this phone finishes or puts back a roll.
    if (refreshRef) refreshRef.current = refresh;
  }, [refresh, refreshRef]);

  useEffect(() => {
    const timer = setInterval(refresh, PLAN_REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const [today, ...ahead] = days;
  if (!today) return null;
  const note = todayNote(today);
  const reached = today.planned !== null && today.planned > 0 && today.scanned >= today.planned;
  const pct =
    today.planned && today.planned > 0
      ? Math.min(100, Math.round((today.scanned / today.planned) * 100))
      : 0;

  return (
    <section
      aria-labelledby="plan-counter-title"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-1"
      data-testid="plan-counter"
    >
      <h2 id="plan-counter-title" className="text-sm font-medium text-muted-foreground">
        Today, {today.label}
      </h2>
      {note ? (
        <p className="text-base" data-testid="plan-today">
          {note}
          {today.scanned > 0 && ` ${leatherRollsLine(today.scanned, null)}.`}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p
            className="flex items-center gap-2 text-xl font-semibold tabular-nums"
            data-testid="plan-today"
          >
            {leatherRollsLine(today.scanned, today.planned)}
            {reached && (
              <Badge tone="success">
                <CircleCheck aria-hidden />
                Plan reached
              </Badge>
            )}
          </p>
          {today.planned !== null && today.planned > 0 && (
            <div
              className="h-2.5 overflow-hidden rounded-sm bg-(--chart-bar-muted)"
              role="progressbar"
              aria-label="Leather rolls scanned against today’s plan"
              aria-valuemin={0}
              aria-valuemax={today.planned}
              aria-valuenow={Math.min(today.scanned, today.planned)}
            >
              <div className="h-full bg-(--chart-bar)" style={{ width: `${pct}%` }} />
            </div>
          )}
          {today.planned === null && (
            <p className="text-sm text-muted-foreground">No number of rolls was planned today.</p>
          )}
        </div>
      )}
      {ahead.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-muted-foreground">Next planned days</h3>
          <ul className="flex flex-col divide-y text-sm" data-testid="plan-ahead">
            {ahead.map((d) => (
              <li key={d.day} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                <span>{d.label}</span>
                <span className="tabular-nums">{leatherRollsLine(d.scanned, d.planned)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
