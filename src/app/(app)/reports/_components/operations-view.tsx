import Link from "next/link";
import { BarList } from "@/components/features/charts/bar-list";
import { ProductionChart } from "@/components/features/charts/production-chart";
import { ProductionDaysTable } from "@/components/features/production/production-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDayLabel, formatManilaDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttentionList, KpiTile } from "./ops-parts";
import {
  ProcurementFlowCard,
  RepairStationCard,
  StockRiskCard,
  SupplierQualityCard,
} from "./ops-sections";
import type { OperationsReport } from "@/server/services/ops-report.service";
import type { ReportRange } from "@/lib/report-rules";

/**
 * The Floor Manager's report: what is happening on the production floor in this range, and what
 * is wrong. Order follows the questions: is anything on fire, did the line make its quota (and
 * how many were present), what's at the repair station, will we run out, is supply good, and the
 * checkpoint before cutting in brief. Stage monitoring was replaced by production in Phase 23.
 */
export function OperationsView({
  report,
  range,
}: {
  report: OperationsReport;
  range: ReportRange;
}) {
  const { kpis, production, checkpoint } = report;
  const compareLabel = range.days === 1 ? "vs yesterday" : `vs previous ${range.days} days`;
  const yieldNote = `${checkpoint.totals.pass} of ${checkpoint.totals.pass + checkpoint.totals.rework + checkpoint.totals.reject} sections passed`;
  const quotaNote =
    production.totals.daysWithQuota === 0
      ? "no finished day with a quota yet"
      : `${production.totals.daysBelow} of ${production.totals.daysWithQuota} days below quota`;

  return (
    <>
      <section
        aria-label="Key figures"
        className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4"
      >
        <KpiTile
          label="Pairs made"
          value={(kpis.pairs.value ?? 0).toLocaleString("en-PH")}
          sub="counted at the check-ins"
          change={kpis.pairs.change}
          compareLabel={compareLabel}
          testid="kpi-pairs"
        />
        <KpiTile
          label="Of quota"
          value={formatPercent(kpis.ofQuota.value)}
          sub={quotaNote}
          change={kpis.ofQuota.change}
          compareLabel={compareLabel}
          testid="kpi-quota"
        />
        <KpiTile
          label="Rolls finished"
          value={String(kpis.rollsFinished.value ?? 0)}
          change={kpis.rollsFinished.change}
          compareLabel={compareLabel}
          testid="kpi-rolls"
        />
        <KpiTile
          label="Rolls at Preparation"
          value={String(kpis.rollsAtPreparation)}
          sub={kpis.rollsAtPreparation === 1 ? "roll being cut now" : "rolls being cut now"}
          testid="kpi-preparation"
        />
        <KpiTile
          label="First-pass yield"
          value={formatPercent(kpis.firstPassYield.value)}
          sub={yieldNote}
          change={kpis.firstPassYield.change}
          compareLabel={compareLabel}
        />
        <KpiTile
          label="To clean or cut around"
          value={String(kpis.repairsOpen)}
          sub="sections, waiting or being handled"
        />
      </section>

      <AttentionList items={report.attention} asOf={formatManilaDateTime(report.asOf)} />

      <Card data-testid="production-section">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Production</CardTitle>
              <CardDescription>
                Pairs finished per working day against the daily quota, with the Shoe Constructors
                present. Each shortfall gets one sentence from the day’s numbers, never a name.
              </CardDescription>
            </div>
            <Link
              href="/production"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Today’s check-ins
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {production.days.length > 0 && (
            <ProductionChart
              days={production.days.map((d) => ({
                day: d.day,
                pairs: d.pairs,
                quota: d.quota,
                constructorsPresent: d.constructorsPresent,
              }))}
            />
          )}
          <ProductionDaysTable
            shoeTypes={production.shoeTypes}
            days={production.days}
            testid="ops-production-table"
          />
        </CardContent>
      </Card>

      <RepairStationCard repairs={report.repairs} days={range.days} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <StockRiskCard stock={report.stock} days={range.days} />
        <ProcurementFlowCard p={report.procurement} />
      </div>

      <SupplierQualityCard
        suppliers={report.suppliers}
        rolls={report.rejectedRolls}
        lineProblemShare={report.lineProblemShare}
        rangeQuery={`from=${range.from}&to=${range.to}`}
      />

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
              <dt className="text-muted-foreground">Marked Fixable</dt>
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
                <TableHead numeric>Rolls started</TableHead>
                <TableHead numeric>Rolls finished</TableHead>
                <TableHead numeric>Scanned</TableHead>
                <TableHead numeric>Pass</TableHead>
                <TableHead numeric>Fixable</TableHead>
                <TableHead numeric>Reject</TableHead>
                <TableHead numeric>Cleaned or cut around</TableHead>
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
