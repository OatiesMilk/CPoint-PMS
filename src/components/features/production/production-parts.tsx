import { CircleCheck, CircleDashed, CircleSlash, Clock, Hourglass, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { formatPercent } from "@/lib/format";
import {
  BATCH_STATE_LABELS,
  type BatchState,
  type QuotaProgress as Progress,
} from "@/lib/production-rules";

// Shared by /batches, the homes and Reports → Operations. Every figure is per batch or per day for
// the whole line; nothing here names a person except who finished a batch (D-008, D-086).

const STATE_STYLE = {
  UPCOMING: { tone: "neutral", Icon: CircleDashed },
  IN_PROGRESS: { tone: "neutral", Icon: Timer },
  DUE: { tone: "info", Icon: Hourglass },
  LATE: { tone: "warning", Icon: Clock },
  FINISHED: { tone: "success", Icon: CircleCheck },
  MISSED: { tone: "danger", Icon: CircleSlash },
} as const;

/** A batch's status, always an icon and a word (A-5). */
export function BatchStateBadge({
  state,
  late = false,
  corrected = false,
  paused = false,
}: {
  state: BatchState;
  late?: boolean;
  corrected?: boolean;
  paused?: boolean;
}) {
  const { tone, Icon } = STATE_STYLE[state];
  const word =
    state === "FINISHED" && late
      ? "Finished late"
      : state === "IN_PROGRESS" && paused
        ? "Paused for lunch"
        : BATCH_STATE_LABELS[state];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={tone}>
        <Icon aria-hidden />
        {word}
      </Badge>
      {corrected && <Badge tone="neutral">Corrected</Badge>}
    </span>
  );
}

const n = (v: number) => v.toLocaleString("en-PH");

/** "86 of 120 pairs passed (72%)" with a bar, and the pace sentence under it (C-30, C-41). */
export function QuotaProgress({ progress }: { progress: Progress }) {
  const p = progress;
  const pct = p.share === null ? 0 : Math.min(100, Math.round(p.share * 100));
  return (
    <div className="flex flex-col gap-1.5" data-testid="quota-progress">
      <p className="text-2xl font-semibold tabular-nums">
        {p.quota === null
          ? `${n(p.passed)} pairs passed`
          : `${n(p.passed)} of ${n(p.quota)} pairs passed`}
        {p.quota !== null && (
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {formatPercent(p.share)}
          </span>
        )}
      </p>
      {p.quota !== null && (
        <div
          className="h-2.5 overflow-hidden rounded-sm bg-(--chart-bar-muted)"
          role="progressbar"
          aria-label="Passed pairs against the daily quota"
          aria-valuemin={0}
          aria-valuemax={p.quota}
          aria-valuenow={Math.min(p.passed, p.quota)}
        >
          <div className="h-full bg-(--chart-bar)" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {n(p.finished)} finished, {n(p.failed)} failed inspection. {p.pace}
      </p>
    </div>
  );
}

export type DayRowView = {
  day: string;
  batches: number;
  finishedBatches: number;
  missed: number;
  finished: number;
  failed: number;
  passed: number;
  failedShare: number | null;
  quota: number | null;
  share: number | null;
  rollsPlanned: number | null;
  rollsScanned: number;
  attendanceTaken: boolean;
  constructorsPresent: number | null;
  constructorsOnRoster: number;
  pairsPerConstructor: number | null;
  shortfall: string | null;
};

/**
 * One row per working day, newest first: pairs finished, failed and passed against the quota, and
 * why it fell short. Per day only, never per person (D-008).
 */
export function ProductionDaysTable({
  days,
  testid = "production-days",
}: {
  days: DayRowView[];
  testid?: string;
}) {
  if (days.length === 0)
    return (
      <p className="rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground">
        No working days with batches yet. Each day appears here once it is planned.
      </p>
    );
  return (
    <Table label="Production by day" data-testid={testid}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Day</TableHead>
          <TableHead numeric>Finished</TableHead>
          <TableHead numeric>Failed inspection</TableHead>
          <TableHead numeric>Passed</TableHead>
          <TableHead numeric>Of quota</TableHead>
          <TableHead numeric>Batches</TableHead>
          <TableHead numeric>Rolls planned</TableHead>
          <TableHead numeric>Rolls scanned</TableHead>
          <TableHead numeric>Constructors present</TableHead>
          <TableHead numeric>Pairs per constructor</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...days].reverse().map((d) => (
          <TableRow key={d.day} aria-label={formatAttendanceDay(d.day)}>
            <TableCell className="whitespace-nowrap">{formatAttendanceDay(d.day)}</TableCell>
            <TableCell numeric>{n(d.finished)}</TableCell>
            <TableCell numeric className="whitespace-nowrap">
              {n(d.failed)}
              {d.failedShare !== null && (
                <span className="text-muted-foreground"> · {formatPercent(d.failedShare)}</span>
              )}
            </TableCell>
            <TableCell numeric className="whitespace-nowrap">
              {n(d.passed)}
              {d.quota !== null && <span className="text-muted-foreground"> / {n(d.quota)}</span>}
            </TableCell>
            <TableCell numeric>{formatPercent(d.share)}</TableCell>
            <TableCell numeric className="whitespace-nowrap">
              {d.finishedBatches} of {d.batches}
              {d.missed > 0 && <span className="text-reject"> · {d.missed} missed</span>}
            </TableCell>
            <TableCell numeric>
              {d.rollsPlanned ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell numeric>{d.rollsScanned}</TableCell>
            <TableCell numeric className="whitespace-nowrap">
              {d.attendanceTaken ? (
                `${d.constructorsPresent} of ${d.constructorsOnRoster}`
              ) : (
                <span className="text-muted-foreground">Not taken</span>
              )}
            </TableCell>
            <TableCell numeric>{d.pairsPerConstructor ?? "—"}</TableCell>
            <TableCell className="max-w-96 whitespace-normal">
              {d.shortfall ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
