import Link from "next/link";
import { BellRing, CalendarCog, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workforce } from "@/lib/attendance-rules";
import type { BatchState, QuotaProgress as Progress } from "@/lib/production-rules";
import { ActionCard } from "@/components/features/overview/action-card";
import { QuotaProgress } from "./production-parts";
import { CardLink } from "@/components/ui/card-link";

/** What the home cards need from the day (the production service's today, passed by the page). */
type BatchesToday = {
  workingDay: boolean;
  planNeeded: boolean;
  nonWorking: boolean;
  next: {
    number: number;
    code: string;
    times: string;
    time: string;
    state: BatchState;
    lateBy: string | null;
    pausedForLunch: boolean;
    canFinishNow: boolean;
  } | null;
  progress: Progress;
  late: number;
  missed: number;
  shortfall: string | null;
  workforce: Workforce;
  canEnter: boolean;
};

function nextLine(today: BatchesToday): string {
  const n = today.next;
  // The Plan today row says the rest; no second call to action here (D-131).
  if (today.planNeeded) return "Nothing to count until today is planned.";
  if (today.nonWorking) return "Today is marked Non-working / Holiday.";
  if (!today.workingDay) return "Today isn’t a working day.";
  if (!n) return "Every batch for today is finished.";
  if (n.state === "LATE") return `${n.lateBy}: ${n.code} (${n.times}).`;
  if (n.state === "DUE") return `${n.code} (${n.times}) is due.`;
  if (n.state === "IN_PROGRESS") return `${n.code} (${n.times}) ends at ${n.time}.`;
  return `Next: ${n.code} (${n.times}).`;
}

/**
 * The Floor Manager's home (D-086, Phase 27): today's passed pairs against the quota, the batch
 * under way, and any late or missed ones. Replaces Today's production.
 */
export function TodaysBatchesCard({ today }: { today: BatchesToday }) {
  return (
    <Card className="h-full" data-testid="todays-batches-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Today’s batches</CardTitle>
            <CardDescription>{nextLine(today)}</CardDescription>
          </div>
          <CardLink href="/batches">Open</CardLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QuotaProgress progress={today.progress} />
        {(today.late > 0 || today.missed > 0) && (
          <p className="flex items-center gap-2 text-sm">
            <CircleAlert aria-hidden className="size-4 text-caution" />
            {[
              today.late > 0 && `${today.late} batch${today.late === 1 ? " is" : "es are"} late`,
              today.missed > 0 && `${today.missed} missed`,
            ]
              .filter(Boolean)
              .join(", ")}
            .{" "}
            {today.canEnter
              ? "No Quality Inspector is present today, so finish them on Batches."
              : "The Quality Inspector finishes them on Batches."}
          </p>
        )}
        {today.shortfall && <p className="text-sm">{today.shortfall}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * The Floor Manager's start-of-day notice on the home (A-37, D-114): the first "needs attention"
 * row, from 00:00 on a weekday with no plan, until today is planned or marked Non-working /
 * Holiday. On the Overview it is the only plan prompt; the banner is hidden there (D-131).
 */
export function PlanTodayCard({ day }: { day: string }) {
  return (
    <ActionCard
      testId="plan-today-card"
      icon={<BellRing />}
      title="Plan today"
      description="No plan yet, so there are no batches. Set the rolls to be used, the quota and the check-in interval."
      action={
        <Button asChild className="max-sm:w-full">
          <Link href={`/batches/plan?day=${day}`}>
            <CalendarCog aria-hidden />
            Plan today
          </Link>
        </Button>
      }
    />
  );
}
