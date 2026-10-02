import { CalendarClock } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Placeholder for a dashboard panel that a later roadmap phase builds. Says what and when. */
export function ComingSoonCard({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <CalendarClock aria-hidden className="size-3.5" />
            Phase {phase}
          </span>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
