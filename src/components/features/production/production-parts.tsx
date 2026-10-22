import { CircleCheck, CircleDashed, CircleSlash, Clock, Hourglass } from "lucide-react";
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
import { SLOT_STATE_LABELS, type SlotState, type TypeProgress } from "@/lib/production-rules";

// Shared by /production, the homes and Reports → Operations. Every figure is per check-in, day or
// shoe type for the whole line; nothing here names a person except who entered a check-in (D-008).

const STATE_STYLE = {
  UPCOMING: { tone: "neutral", Icon: CircleDashed },
  DUE: { tone: "info", Icon: Hourglass },
  LATE: { tone: "warning", Icon: Clock },
  ENTERED: { tone: "success", Icon: CircleCheck },
  MISSED: { tone: "danger", Icon: CircleSlash },
} as const;

export function SlotStateBadge({ state, late = false }: { state: SlotState; late?: boolean }) {
  const { tone, Icon } = STATE_STYLE[state];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {state === "ENTERED" && late ? "Entered late" : SLOT_STATE_LABELS[state]}
    </Badge>
  );
}

/** "86 of 120 pairs (72%)" with a bar per shoe type, and the pace sentence under it. */
export function QuotaProgress({ progress }: { progress: TypeProgress[] }) {
  if (progress.length === 0)
    return <p className="text-muted-foreground">No shoe types are active. Add one in Settings.</p>;
  return (
    <ul className="flex flex-col gap-4" data-testid="quota-progress">
      {progress.map((p) => {
        const pct = p.share === null ? 0 : Math.min(100, Math.round(p.share * 100));
        return (
          <li key={p.shoeTypeId} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium">{p.name}</span>
              <span className="tabular-nums">
                {p.quota === null
                  ? `${p.pairs.toLocaleString("en-PH")} pairs, no quota`
                  : `${p.pairs.toLocaleString("en-PH")} of ${p.quota.toLocaleString("en-PH")} pairs (${formatPercent(p.share)})`}
              </span>
            </div>
            {p.quota !== null && (
              <div
                className="h-2.5 overflow-hidden rounded-sm bg-(--chart-bar-muted)"
                role="progressbar"
                aria-label={`${p.name} against the daily quota`}
                aria-valuemin={0}
                aria-valuemax={p.quota}
                aria-valuenow={Math.min(p.pairs, p.quota)}
              >
                <div className="h-full bg-(--chart-bar)" style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="text-sm text-muted-foreground">{p.pace}</p>
          </li>
        );
      })}
    </ul>
  );
}

export type DayRowView = {
  day: string;
  checkIns: number;
  entered: number;
  missed: number;
  byType: { shoeTypeId: string; label: string; pairs: number; quota: number | null }[];
  pairs: number;
  quota: number | null;
  share: number | null;
  attendanceTaken: boolean;
  constructorsPresent: number | null;
  constructorsOnRoster: number;
  pairsPerConstructor: number | null;
  shortfall: string | null;
};

/** One row per working day, newest first: pairs per type against the quota, and why it fell short. */
export function ProductionDaysTable({
  shoeTypes,
  days,
  testid = "production-days",
}: {
  shoeTypes: { id: string; label: string }[];
  days: DayRowView[];
  testid?: string;
}) {
  if (days.length === 0)
    return (
      <p className="rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground">
        No working days with check-ins yet. Each day appears here once its check-ins are scheduled.
      </p>
    );
  return (
    <Table label="Production by day" data-testid={testid}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Day</TableHead>
          {shoeTypes.map((t) => (
            <TableHead key={t.id} numeric>
              {t.label}
            </TableHead>
          ))}
          <TableHead numeric>Of quota</TableHead>
          <TableHead numeric>Check-ins</TableHead>
          <TableHead numeric>Constructors present</TableHead>
          <TableHead numeric>Pairs per constructor</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...days].reverse().map((d) => (
          <TableRow key={d.day} aria-label={formatAttendanceDay(d.day)}>
            <TableCell className="whitespace-nowrap">{formatAttendanceDay(d.day)}</TableCell>
            {shoeTypes.map((t) => {
              const c = d.byType.find((b) => b.shoeTypeId === t.id);
              return (
                <TableCell key={t.id} numeric className="whitespace-nowrap">
                  {c ? c.pairs.toLocaleString("en-PH") : 0}
                  {c?.quota != null && (
                    <span className="text-muted-foreground">
                      {" "}
                      / {c.quota.toLocaleString("en-PH")}
                    </span>
                  )}
                </TableCell>
              );
            })}
            <TableCell numeric>{formatPercent(d.share)}</TableCell>
            <TableCell numeric className="whitespace-nowrap">
              {d.entered} of {d.checkIns}
              {d.missed > 0 && <span className="text-reject"> · {d.missed} missed</span>}
            </TableCell>
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
