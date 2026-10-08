import Link from "next/link";
import { BarList } from "@/components/features/charts/bar-list";
import { FlowChart } from "@/components/features/charts/flow-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDayLabel, formatDuration, formatManilaDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttentionList, FlowLanes, KpiTile } from "./ops-parts";
import {
  ProcurementFlowCard,
  RepairStationCard,
  StockRiskCard,
  SupplierCard,
} from "./ops-sections";
import type { OperationsReport } from "@/server/services/ops-report.service";
import type { ReportRange } from "@/lib/report-rules";

/**
 * The Floor Manager's report: what is happening on the production floor in this range and right
 * now, and what is wrong. Order follows the questions: is anything on fire, where is the work,
 * is it flowing, what's at the repair station, will we run out, is supply good, and the
 * checkpoint before cutting in brief.
 */
export function OperationsView({
  report,
  range,
}: {
  report: OperationsReport;
  range: ReportRange;
}) {
  const { kpis, flow, checkpoint } = report;
  const compareLabel = range.days === 1 ? "vs yesterday" : `vs previous ${range.days} days`;
  const yieldNote = `${checkpoint.totals.pass} of ${checkpoint.totals.pass + checkpoint.totals.rework + checkpoint.totals.reject} sections passed`;

  return (
    <>
      <section
        aria-label="Key figures"
        className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4"
      >
        <KpiTile
          label="Batches completed"
          value={String(kpis.completed.value ?? 0)}
          change={kpis.completed.change}
          compareLabel={compareLabel}
          testid="kpi-completed"
        />
        <KpiTile
          label="Batches started"
          value={String(kpis.started.value ?? 0)}
          change={kpis.started.change}
          compareLabel={compareLabel}
        />
        <KpiTile
          label="Typical lead time"
          value={
            kpis.leadTimeMedianMs.value === null ? "—" : formatDuration(kpis.leadTimeMedianMs.value)
          }
          sub="start to finish, per batch"
          change={kpis.leadTimeMedianMs.change}
          compareLabel={compareLabel}
        />
        <KpiTile
          label="In production now"
          value={String(kpis.wip)}
          sub={kpis.wip === 1 ? "batch on the line" : "batches on the line"}
          testid="kpi-wip"
        />
        <KpiTile
          label="First-pass yield"
          value={formatPercent(kpis.firstPassYield.value)}
          sub={yieldNote}
          change={kpis.firstPassYield.change}
          compareLabel={compareLabel}
        />
        <KpiTile
          label="At the repair station"
          value={String(kpis.repairsOpen)}
          sub="sections, waiting or repairing"
        />
      </section>

      <AttentionList items={report.attention} asOf={formatManilaDateTime(report.asOf)} />

      <section aria-labelledby="line-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="line-heading" className="text-xl font-semibold">
            On the floor now
          </h2>
          <p className="text-sm text-muted-foreground">
            Every batch in production, by stage. “Longer than usual” means more than 1.5 times that
            stage’s typical visit over the last 30 days.
          </p>
        </div>
        <FlowLanes lanes={flow.lanes} bottleneck={flow.bottleneck} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Flow</CardTitle>
          <CardDescription>
            Batches started and completed per day.
            {flow.leadTime.batches > 0 &&
              ` ${flow.leadTime.batches} finished in this range, typically in ${formatDuration(flow.leadTime.medianMs ?? 0)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FlowChart days={report.days} />
        </CardContent>
      </Card>

      <Card data-testid="production-section">
        <CardHeader>
          <CardTitle>Time in each stage</CardTitle>
          <CardDescription>
            Per visit, for stages finished in this range (moves back included). Slowest 1 in 10
            shows how bad the bad days are.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Stage</TableHead>
                <TableHead numeric>Visits</TableHead>
                <TableHead numeric>Typical</TableHead>
                <TableHead numeric>Slowest 1 in 10</TableHead>
                <TableHead numeric>Average</TableHead>
                <TableHead numeric>In stage now</TableHead>
                <TableHead numeric>Longest wait now</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flow.lanes.map((s) => (
                <TableRow key={s.stage}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell numeric>{s.visits}</TableCell>
                  <TableCell numeric>
                    {s.medianMs === null ? "—" : formatDuration(s.medianMs)}
                  </TableCell>
                  <TableCell numeric>{s.p90Ms === null ? "—" : formatDuration(s.p90Ms)}</TableCell>
                  <TableCell numeric>{s.avgMs === null ? "—" : formatDuration(s.avgMs)}</TableCell>
                  <TableCell numeric>{s.inStageNow}</TableCell>
                  <TableCell numeric>
                    {s.longestWaitMs === null ? "—" : formatDuration(s.longestWaitMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RepairStationCard repairs={report.repairs} days={range.days} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <StockRiskCard stock={report.stock} days={range.days} />
        <ProcurementFlowCard p={report.procurement} />
      </div>

      <SupplierCard suppliers={report.suppliers} lineProblemShare={report.lineProblemShare} />

      <Card data-testid="checkpoint">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Checkpoint before cutting</CardTitle>
              <CardDescription>
                What the camera found on the leather before it was cut. The full inspection report
                is in the Quality tab.
              </CardDescription>
            </div>
            <Link
              href="/reports?view=quality"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Quality report
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Sections scanned</dt>
              <dd className="text-2xl font-semibold tabular-nums">{checkpoint.totals.scanned}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rejected</dt>
              <dd className="text-2xl font-semibold tabular-nums">{checkpoint.totals.reject}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sent to rework</dt>
              <dd className="text-2xl font-semibold tabular-nums">{checkpoint.totals.rework}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Flagged for review</dt>
              <dd className="text-2xl font-semibold tabular-nums">{checkpoint.totals.pending}</dd>
            </div>
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-medium">Top defects</h3>
            {checkpoint.defects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No defects detected in this range.</p>
            ) : (
              <BarList
                label="Top defects"
                items={checkpoint.defects.map((d) => ({
                  id: d.key,
                  label: d.known ? d.label : `${d.label} (unknown)`,
                  value: d.scans,
                  valueLabel: `${d.scans} · ${formatPercent(d.share)}`,
                  muted: !d.known,
                }))}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily summary</CardTitle>
          <CardDescription>
            One row per Manila day, newest first. Same numbers as the Operations CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="ops-daily-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Day</TableHead>
                <TableHead numeric>Started</TableHead>
                <TableHead numeric>Completed</TableHead>
                <TableHead numeric>Scanned</TableHead>
                <TableHead numeric>Pass</TableHead>
                <TableHead numeric>Rework</TableHead>
                <TableHead numeric>Reject</TableHead>
                <TableHead numeric>Repairs done</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...report.days].reverse().map((d) => (
                <TableRow
                  key={d.day}
                  aria-label={d.day}
                  className={cn(
                    d.started + d.completed + d.scanned + d.repairsDone === 0 &&
                      "text-muted-foreground",
                  )}
                >
                  <TableCell>{formatDayLabel(d.day)}</TableCell>
                  <TableCell numeric>{d.started}</TableCell>
                  <TableCell numeric>{d.completed}</TableCell>
                  <TableCell numeric>{d.scanned}</TableCell>
                  <TableCell numeric>{d.pass}</TableCell>
                  <TableCell numeric>{d.rework}</TableCell>
                  <TableCell numeric>{d.reject}</TableCell>
                  <TableCell numeric>{d.repairsDone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
