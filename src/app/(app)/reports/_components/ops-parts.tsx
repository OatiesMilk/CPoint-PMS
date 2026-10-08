import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CircleAlert,
  Clock,
  Gauge,
  Info,
  Minus,
  OctagonAlert,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import { describeChange, type AttentionItem } from "@/lib/ops-rules";
import { cn } from "@/lib/utils";
import type { OperationsReport } from "@/server/services/ops-report.service";

// Building blocks of the Operations report (D-033). Server components: no state, no animation.

/**
 * One headline number with its change against the previous period. The change is words plus an
 * arrow, never colour: whether "up" is good depends on the measure, and we don't judge it here.
 */
export function KpiTile({
  label,
  value,
  sub,
  change,
  compareLabel,
  testid,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Fractional change vs the previous period; undefined hides the comparison. */
  change?: number | null;
  compareLabel?: string;
  testid?: string;
}) {
  const Arrow =
    change == null || Math.round(Math.abs(change) * 100) === 0
      ? Minus
      : change > 0
        ? ArrowUp
        : ArrowDown;
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums" data-testid={testid}>
          {value}
        </CardTitle>
        {change !== undefined && (
          <p className="flex items-start gap-1 text-sm text-muted-foreground">
            <Arrow aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="flex flex-col">
              <span className="font-medium text-foreground first-letter:uppercase">
                {change === null ? "No earlier data" : describeChange(change)}
              </span>
              <span>{compareLabel}</span>
            </span>
          </p>
        )}
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

const SEVERITY = {
  critical: { tone: "danger", label: "Act now", Icon: OctagonAlert },
  warning: { tone: "warning", label: "Watch", Icon: CircleAlert },
  info: { tone: "info", label: "For your attention", Icon: Info },
} as const;

/** The few things worth acting on, most urgent first. Each links to where it is handled. */
export function AttentionList({ items, asOf }: { items: AttentionItem[]; asOf: string }) {
  return (
    <Card data-testid="attention">
      <CardHeader>
        <CardTitle>What needs attention</CardTitle>
        <CardDescription>
          Problems found across the line, stock, purchasing and supply as of {asOf}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing needs attention. No bottleneck, late batch, shortage or waiting request was
            found.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((item) => {
              const s = SEVERITY[item.severity];
              return (
                <li
                  key={item.id}
                  className="grid grid-cols-1 items-start gap-4 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_1fr_auto]"
                >
                  <Badge tone={s.tone} className="justify-self-start">
                    <s.Icon aria-hidden />
                    {s.label}
                  </Badge>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Open
                    <ArrowRight aria-hidden className="size-4" />
                    <span className="sr-only">: {item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const LANE_BATCHES = 4;

/**
 * The production line as it is right now: one lane per stage with the batches in it, how long
 * each has been there, and which stage holds the line up. Shares the width of the line, so the
 * widest wait stands out without colour.
 */
export function FlowLanes({
  lanes,
  bottleneck,
}: {
  lanes: OperationsReport["flow"]["lanes"];
  bottleneck: string | null;
}) {
  return (
    <ol
      aria-label="Production line"
      className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4"
      data-testid="flow-lanes"
    >
      {lanes.map((lane, i) => (
        <li
          key={lane.stage}
          className={cn(
            "flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-1",
            lane.stage === bottleneck && "border-foreground",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Step {i + 1}</p>
              <h3 className="text-lg font-semibold">{lane.label}</h3>
            </div>
            {lane.stage === bottleneck && (
              <Badge tone="warning">
                <Gauge aria-hidden />
                Bottleneck
              </Badge>
            )}
          </div>
          <p>
            <span className="text-3xl font-semibold tabular-nums">{lane.inStageNow}</span>{" "}
            <span className="text-muted-foreground">
              {lane.inStageNow === 1 ? "batch in stage" : "batches in stage"}
            </span>
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Typical visit</dt>
              <dd className="font-medium tabular-nums">
                {lane.medianMs === null ? "—" : formatDuration(lane.medianMs)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Slowest 1 in 10</dt>
              <dd className="font-medium tabular-nums">
                {lane.p90Ms === null ? "—" : formatDuration(lane.p90Ms)}
              </dd>
            </div>
          </dl>
          {lane.shareOfLeadTime !== null && (
            <div>
              <div
                className="h-2 overflow-hidden rounded-sm bg-(--chart-bar-muted)"
                role="img"
                aria-label={`${Math.round(lane.shareOfLeadTime * 100)}% of the time a batch spends across the line`}
              >
                <div
                  className="h-full bg-(--chart-bar)"
                  style={{ width: `${Math.round(lane.shareOfLeadTime * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(lane.shareOfLeadTime * 100)}% of the line’s time
              </p>
            </div>
          )}
          {lane.batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No batch in this stage.</p>
          ) : (
            <ul className="flex flex-col divide-y border-t pt-1 text-sm">
              {lane.batches.slice(0, LANE_BATCHES).map((b) => (
                <li key={b.id} className="flex flex-col gap-1 py-2">
                  <span className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/batches/${b.id}`}
                      className="font-mono whitespace-nowrap underline-offset-4 hover:underline"
                    >
                      {b.code}
                    </Link>
                    <span className="tabular-nums">{formatDuration(b.inStageMs)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{b.shoeType}</span>
                  {(b.stuck || b.openRepairs > 0) && (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {b.stuck && (
                        <Badge tone="warning">
                          <Clock aria-hidden />
                          Longer than usual
                        </Badge>
                      )}
                      {b.openRepairs > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Wrench aria-hidden className="size-3" />
                          {b.openRepairs} in repair
                        </span>
                      )}
                    </span>
                  )}
                </li>
              ))}
              {lane.batches.length > LANE_BATCHES && (
                <li className="py-1.5 text-xs text-muted-foreground">
                  <Link
                    href={`/batches?status=IN_PROGRESS&stage=${lane.stage}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {lane.batches.length - LANE_BATCHES} more in {lane.label}
                  </Link>
                </li>
              )}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
