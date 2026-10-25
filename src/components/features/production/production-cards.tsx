import Link from "next/link";
import { ArrowRight, CircleAlert, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workforce } from "@/lib/attendance-rules";
import type { BatchState, QuotaProgress as Progress } from "@/lib/production-rules";
import { BatchStateBadge, QuotaProgress } from "./production-parts";

/** What the home cards need from the day (the production service's today, passed by the page). */
type BatchesToday = {
  workingDay: boolean;
  next: {
    number: number;
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
  if (!today.workingDay) return "Today isn’t a working day on the schedule.";
  if (!n) return "Every batch for today is finished.";
  if (n.state === "LATE") return `${n.lateBy}: Batch ${n.number} (${n.times}).`;
  if (n.state === "DUE") return `Batch ${n.number} (${n.times}) is due.`;
  if (n.state === "IN_PROGRESS") return `Batch ${n.number} (${n.times}) ends at ${n.time}.`;
  return `Next: Batch ${n.number} (${n.times}).`;
}

/**
 * The Floor Manager's home (D-086, Phase 27): today's passed pairs against the quota, the batch
 * under way, and any late or missed ones. Replaces Today's production.
 */
export function TodaysBatchesCard({ today }: { today: BatchesToday }) {
  return (
    <Card className="xl:col-span-2" data-testid="todays-batches-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Today’s batches</CardTitle>
            <CardDescription>{nextLine(today)}</CardDescription>
          </div>
          <Link
            href="/batches"
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Open
            <ArrowRight aria-hidden className="size-4" />
          </Link>
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

/** The Quality Inspector's home: the batch that is due, late or under way, with Finish batch. */
export function NextBatchCard({ today }: { today: BatchesToday }) {
  const n = today.next;
  return (
    <Card data-testid="next-batch-card">
      <CardHeader>
        <CardTitle>Next batch</CardTitle>
        <CardDescription>
          {today.workforce.taken
            ? `Constructors present today: ${today.workforce.constructorsPresent}`
            : "Attendance not taken yet today."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 text-lg">
          <ClipboardList aria-hidden className="size-5 text-muted-foreground" />
          {nextLine(today)}
        </p>
        {n && <BatchStateBadge state={n.state} paused={n.pausedForLunch} />}
        {n?.canFinishNow && today.canEnter ? (
          <Button asChild size="sm">
            <Link href="/batches?finish=next">Finish batch {n.number}</Link>
          </Button>
        ) : (
          <Link href="/batches" className="text-sm font-medium underline-offset-4 hover:underline">
            Open Batches
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
