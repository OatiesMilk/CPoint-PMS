import Link from "next/link";
import { ArrowRight, CircleAlert, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workforce } from "@/lib/attendance-rules";
import type { SlotState, TypeProgress } from "@/lib/production-rules";
import { QuotaProgress, SlotStateBadge } from "./production-parts";

/** What the home cards need from the day (the production service's today, passed by the page). */
type ProductionToday = {
  workingDay: boolean;
  next: { time: string; state: SlotState; lateBy: string | null } | null;
  progress: TypeProgress[];
  late: number;
  missed: number;
  shortfall: string | null;
  workforce: Workforce;
  canEnter: boolean;
};

function nextLine(today: ProductionToday): string {
  const n = today.next;
  if (!today.workingDay) return "Today isn’t a working day on the schedule.";
  if (!n) return "Every check-in for today is done.";
  if (n.state === "LATE") return `${n.lateBy}: the ${n.time} check-in.`;
  if (n.state === "DUE") return `The ${n.time} check-in is due.`;
  return `Next check-in at ${n.time}.`;
}

/**
 * The Floor Manager's home (D-086): today against the quota per shoe type, the next check-in, and
 * any late or missed ones. Replaces "Batches by stage".
 */
export function TodaysProductionCard({ today }: { today: ProductionToday }) {
  return (
    <Card className="xl:col-span-2" data-testid="todays-production-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Today’s production</CardTitle>
            <CardDescription>{nextLine(today)}</CardDescription>
          </div>
          <Link
            href="/production"
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
              today.late > 0 && `${today.late} check-in${today.late === 1 ? " is" : "s are"} late`,
              today.missed > 0 && `${today.missed} missed`,
            ]
              .filter(Boolean)
              .join(", ")}
            .{" "}
            {today.canEnter
              ? "No Quality Inspector is present today, so enter them on Production."
              : "The Quality Inspector enters them on Production."}
          </p>
        )}
        {today.shortfall && <p className="text-sm">{today.shortfall}</p>}
      </CardContent>
    </Card>
  );
}

/** The Quality Inspector's home: the check-in that is due or late, with Enter count. */
export function NextCheckInCard({ today }: { today: ProductionToday }) {
  const n = today.next;
  const actionable = n && (n.state === "DUE" || n.state === "LATE");
  return (
    <Card data-testid="next-check-in-card">
      <CardHeader>
        <CardTitle>Next check-in</CardTitle>
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
        {n && <SlotStateBadge state={n.state} />}
        {actionable && today.canEnter && (
          <Button asChild size="sm">
            <Link href="/production?enter=next">Enter count</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
