import Link from "next/link";
import { ArrowRight, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABELS, type Stage } from "@/lib/domain";
import { formatDuration } from "@/lib/format";

type Props = {
  planned: number;
  stages: { stage: Stage; count: number; oldestWaitMs: number | null }[];
};

/** Where every roll is right now. The stage holding a batch the longest is flagged as the bottleneck. */
export function BatchesByStageCard({ planned, stages }: Props) {
  const longest = stages.reduce<{ stage: Stage; ms: number } | null>(
    (max, s) =>
      s.oldestWaitMs !== null && (!max || s.oldestWaitMs > max.ms)
        ? { stage: s.stage, ms: s.oldestWaitMs }
        : max,
    null,
  );
  const total = stages.reduce((n, s) => n + s.count, 0);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Batches by stage</CardTitle>
            <CardDescription>
              {total === 0
                ? "No batches on the line right now."
                : `${total} on the line${planned ? ` · ${planned} planned` : ""}. Wait = time the oldest batch has been in that stage.`}
            </CardDescription>
          </div>
          <Link
            href="/batches"
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            All batches
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-4 gap-3">
          {stages.map((s) => (
            <li key={s.stage}>
              <Link
                href={`/batches?stage=${s.stage}`}
                className="flex h-full flex-col gap-1 rounded-md border p-3 transition-colors duration-(--dur-fast) hover:bg-accent"
              >
                <span className="text-sm text-muted-foreground">{STAGE_LABELS[s.stage]}</span>
                <span className="text-2xl font-semibold tabular-nums">{s.count}</span>
                <span className="text-sm text-muted-foreground">
                  {s.oldestWaitMs !== null ? `Wait ${formatDuration(s.oldestWaitMs)}` : "—"}
                </span>
                {longest?.stage === s.stage && total > 1 && (
                  <Badge tone="warning" className="mt-1 self-start">
                    <Hourglass aria-hidden />
                    Longest wait
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
