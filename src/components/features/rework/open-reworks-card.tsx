import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";

/** What's at the repair station right now (FM home). */
export function OpenReworksCard({
  waiting,
  inProgress,
  oldestWaitMs,
}: {
  waiting: number;
  inProgress: number;
  oldestWaitMs: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Repair Station</CardTitle>
            <CardDescription>
              {waiting + inProgress === 0
                ? "Nothing to clean or cut around."
                : oldestWaitMs !== null
                  ? `Oldest has waited ${formatDuration(oldestWaitMs)}.`
                  : "Every Fixable section is being handled."}
            </CardDescription>
          </div>
          <Link
            href="/rework"
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Board
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm text-muted-foreground">Waiting</dt>
            <dd className="text-2xl font-semibold text-rework tabular-nums">{waiting}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Being handled</dt>
            <dd className="text-2xl font-semibold tabular-nums">{inProgress}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
