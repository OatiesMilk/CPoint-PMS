import Link from "next/link";
import { CircleCheck, CircleDashed, CircleSlash, Clock, Hourglass, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/features/reports/sortable-header";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { formatPercent } from "@/lib/format";
import { sortFor, type SortKey, type SortState } from "@/lib/table-sort";
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
      <p className="text-kpi font-semibold tracking-tight tabular-nums">
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
        {n(p.finished)} finished, {n(p.failed)} failed inspection.
        {p.repairedPassed > 0 &&
          ` ${n(p.repairedPassed)} of the passed pairs were repaired first.`}{" "}
        {p.pace}
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
  /** Of the passed pairs, those that passed after a repair (Phase 34). */
  repairedPassed?: number;
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
  /** A batch of this day was corrected on a later day (Phase 35B, A-103). */
  correctedLater?: boolean;
};

const DAY_KEYS: Record<string, SortKey<DayRowView>> = {
  day: (d) => d.day,
  finished: (d) => d.finished,
  "failed-inspection": (d) => d.failed,
  passed: (d) => d.passed,
  "of-quota": (d) => d.share,
  batches: (d) => d.finishedBatches,
  "rolls-planned": (d) => d.rollsPlanned,
  "rolls-scanned": (d) => d.rollsScanned,
  "constructors-present": (d) => d.constructorsPresent,
  "pairs-per-constructor": (d) => d.pairsPerConstructor,
};

// Headers of a wide table wrap onto two lines so it fits at 1280 px (Phase 30F-2).
const wrapHead = "h-auto py-2 align-bottom whitespace-normal";

/**
 * One row per working day, newest first: pairs finished, failed and passed against the quota, and
 * why it fell short. Per day only, never per person (D-008).
 */
export function ProductionDaysTable({
  days,
  testid = "production-days",
  sort,
  seeBatches = false,
}: {
  days: DayRowView[];
  testid?: string;
  /** Reports → Operations (Phase 35): the page's sort. Without it the headers don't sort. */
  sort?: SortState | null;
  /** A "See batches" link under each day, to the Floor Manager's list of that day (Phase 35B). */
  seeBatches?: boolean;
}) {
  const sortable = sort !== undefined;
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
          {sortable ? (
            <SortableHeader table="production" column="day">
              Day
            </SortableHeader>
          ) : (
            <TableHead>Day</TableHead>
          )}
          {sortable ? (
            <SortableHeader table="production" column="finished" numeric className={wrapHead}>
              Finished
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Finished
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader
              table="production"
              column="failed-inspection"
              numeric
              className={wrapHead}
            >
              Failed inspection
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Failed inspection
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader table="production" column="passed" numeric className={wrapHead}>
              Passed
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Passed
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader table="production" column="of-quota" numeric className={wrapHead}>
              Of quota
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Of quota
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader table="production" column="batches" numeric className={wrapHead}>
              Batches
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Batches
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader table="production" column="rolls-planned" numeric className={wrapHead}>
              Rolls planned
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Rolls planned
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader table="production" column="rolls-scanned" numeric className={wrapHead}>
              Rolls scanned
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Rolls scanned
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader
              table="production"
              column="constructors-present"
              numeric
              className={wrapHead}
            >
              Constructors present
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Constructors present
            </TableHead>
          )}
          {sortable ? (
            <SortableHeader
              table="production"
              column="pairs-per-constructor"
              numeric
              className={wrapHead}
            >
              Pairs per constructor
            </SortableHeader>
          ) : (
            <TableHead numeric className={wrapHead}>
              Pairs per constructor
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      {/* One body per day: the day's figures, then its shortfall sentence across the table, so
          the long sentence doesn't widen the table past 1280 px (Phase 30F-2). */}
      {sortFor(sort ?? null, "production", [...days].reverse(), DAY_KEYS).map((d) => (
        <tbody
          key={d.day}
          className="border-b transition-colors duration-(--dur-fast) last:border-0 hover:bg-accent/50"
        >
          <TableRow
            aria-label={formatAttendanceDay(d.day)}
            className="border-0 hover:bg-transparent"
          >
            <TableCell className="whitespace-nowrap">
              {formatAttendanceDay(d.day)}
              {d.correctedLater && (
                // Under the date, so the badge never widens the table past the page in print.
                <span className="mt-1 block">
                  <Badge tone="neutral" data-testid="day-corrected">
                    Corrected
                  </Badge>
                </span>
              )}
              {seeBatches && (
                <Link
                  href={`/batches?tab=queue&doneDay=${d.day}#inspected-heading`}
                  className="block text-sm text-muted-foreground underline-offset-4 hover:underline print:hidden"
                  data-testid={`see-batches-${d.day}`}
                >
                  See batches
                  <span className="sr-only"> of {formatAttendanceDay(d.day)}</span>
                </Link>
              )}
            </TableCell>
            <TableCell numeric>{n(d.finished)}</TableCell>
            <TableCell numeric className="whitespace-nowrap">
              {n(d.failed)}
              {d.failedShare !== null && (
                <span className="text-muted-foreground"> · {formatPercent(d.failedShare)}</span>
              )}
            </TableCell>
            <TableCell numeric className="whitespace-nowrap">
              {n(d.passed)}
              {!!d.repairedPassed && (
                <span className="block text-xs font-normal text-muted-foreground">
                  incl. {n(d.repairedPassed)} repaired
                </span>
              )}
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
          </TableRow>
          {d.shortfall && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={10}
                className="h-auto pt-0 pb-3 text-sm whitespace-normal text-muted-foreground"
              >
                <span className="sr-only">Note for {formatAttendanceDay(d.day)}: </span>
                {d.shortfall}
              </TableCell>
            </TableRow>
          )}
        </tbody>
      ))}
    </Table>
  );
}
