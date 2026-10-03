/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager (quality + production) and the Quality Inspector (quality), at the
 *        end of a day or week; the survey says a daily summary is enough.
 * What:  how the line did (verdicts, defects, how often people kept the camera's call, where
 *        batches wait), and a CSV to hand on.
 * Worst: a number read as something else, or anyone singled out. Every figure says what it
 *        counts; everything is per day, defect type or stage, never per person (D-008).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Download } from "lucide-react";
import { BarList } from "@/components/features/charts/bar-list";
import { VerdictTrendChart } from "@/components/features/charts/verdict-trend-chart";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDayLabel, formatDuration, formatPercent } from "@/lib/format";
import { PRESETS, parseRange } from "@/lib/report-rules";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { productionReport, qualityReport } from "@/server/services/report.service";
import { reportQuerySchema } from "@/server/validators/report.validator";

export const metadata: Metadata = { title: "Reports" };

const VERDICT_LABEL = {
  PASS: "Pass",
  REWORK: "Rework",
  REJECT: "Reject",
  NEEDS_REVIEW: "Needs review",
};
const DEFECT_ROWS = 8;
const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requirePermission("report:quality");
  await connection();
  const range = parseRange(reportQuerySchema.parse(await searchParams));
  const showProduction = can(user.role, "report:production");
  const [quality, production] = await Promise.all([
    qualityReport(range),
    showProduction ? productionReport(range) : null,
  ]);
  const t = quality.totals;
  const decided = t.pass + t.rework + t.reject;
  const qs = `from=${range.from}&to=${range.to}`;
  const title =
    range.days === 1
      ? formatDayLabel(range.from)
      : `${formatDayLabel(range.from)} – ${formatDayLabel(range.to)}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Daily totals in Manila time, per day, defect type and stage. Never per person."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <a href={`/api/v1/reports/daily.csv?${qs}`} download>
                <Download aria-hidden />
                Daily CSV
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href={`/api/v1/reports/defects.csv?${qs}`} download>
                <Download aria-hidden />
                Defects CSV
              </a>
            </Button>
            {showProduction && (
              <Button asChild variant="secondary">
                <a href={`/api/v1/reports/stages.csv?${qs}`} download>
                  <Download aria-hidden />
                  Stages CSV
                </a>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Report range" className="flex gap-1 rounded-md border p-1">
          {PRESETS.map((p) => (
            <Link
              key={p.id}
              href={`/reports?preset=${p.id}`}
              aria-current={range.preset === p.id ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium",
                range.preset === p.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex items-end gap-2" aria-label="Custom range">
          <label className="flex flex-col gap-1 text-sm">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              max={range.to}
              className="h-9 rounded-md border border-input bg-card px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            To
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              className="h-9 rounded-md border border-input bg-card px-3"
            />
          </label>
          <Button type="submit" variant="secondary">
            Show
          </Button>
        </form>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="report-range">
        {title} · {range.days} day{range.days === 1 ? "" : "s"}
      </p>

      <section aria-label="Totals" className="grid grid-cols-6 gap-4">
        {[
          { label: "Scanned", value: t.scanned.toLocaleString("en-PH"), testid: "total-scanned" },
          {
            label: "Pass",
            value: formatPercent(share(t.pass, decided)),
            sub: `${t.pass} sections`,
          },
          {
            label: "Rework",
            value: formatPercent(share(t.rework, decided)),
            sub: `${t.rework} sections`,
          },
          {
            label: "Reject",
            value: formatPercent(share(t.reject, decided)),
            sub: `${t.reject} sections`,
          },
          {
            label: "AI agreement",
            value: formatPercent(t.agreement),
            sub: `${t.agreed} of ${t.aiDecided} calls kept`,
            testid: "total-agreement",
          },
          { label: "Repairs done", value: t.repairsDone.toLocaleString("en-PH") },
        ].map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums" data-testid={tile.testid}>
                {tile.value}
              </CardTitle>
              {tile.sub && <p className="text-sm text-muted-foreground">{tile.sub}</p>}
            </CardHeader>
          </Card>
        ))}
      </section>

      {t.scanned === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <h2 className="text-xl font-semibold">No scans in this range</h2>
          <p className="max-w-md text-muted-foreground">
            The camera hasn’t sent anything for these days. Try a longer range.
          </p>
          <Button asChild variant="secondary">
            <Link href="/reports?preset=30d">Show the last 30 days</Link>
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Scans per day</CardTitle>
              <CardDescription>
                By final verdict, after any overrides. The table at the bottom has the numbers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VerdictTrendChart days={quality.days} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Defects by type</CardTitle>
                <CardDescription>
                  Sections whose strongest detection was this defect. Unknown classes are listed by
                  the key the camera sent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quality.defects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No defects detected in this range.
                  </p>
                ) : (
                  <BarList
                    label="Defects by type"
                    items={quality.defects.slice(0, DEFECT_ROWS).map((d) => ({
                      id: d.key,
                      label: d.known ? d.label : `${d.label} (unknown)`,
                      value: d.scans,
                      detail: `${d.scans} sections: ${d.pass} pass, ${d.rework} rework, ${d.reject} reject, ${d.pending} pending`,
                      href: d.known ? `/scans?defect=${encodeURIComponent(d.key)}` : undefined,
                      muted: !d.known,
                    }))}
                  />
                )}
                {quality.defects.length > DEFECT_ROWS && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {quality.defects.length - DEFECT_ROWS} more rare types, all in the Defects CSV.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Camera call vs final verdict</CardTitle>
                <CardDescription>
                  Rows are what the camera decided; columns are the final verdict. Off-diagonal
                  numbers are overrides, which help tune the thresholds.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Camera said</TableHead>
                      <TableHead numeric>Pass</TableHead>
                      <TableHead numeric>Rework</TableHead>
                      <TableHead numeric>Reject</TableHead>
                      <TableHead numeric>Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quality.matrix.map((row) => (
                      <TableRow key={row.ai}>
                        <TableCell className="font-medium">{VERDICT_LABEL[row.ai]}</TableCell>
                        {(["PASS", "REWORK", "REJECT", "PENDING"] as const).map((f) => (
                          <TableCell
                            key={f}
                            numeric
                            className={cn(
                              row.ai === f && "font-semibold",
                              row.counts[f] === 0 && "text-muted-foreground",
                            )}
                          >
                            {row.counts[f]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t.personResolved} unknown-class scan{t.personResolved === 1 ? " was" : "s were"}{" "}
                  decided by a person; they don’t count toward agreement.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {production && (
        <Card data-testid="production-section">
          <CardHeader>
            <CardTitle>Time in each stage</CardTitle>
            <CardDescription>
              Median time per visit for stages finished in this range (moves back included).{" "}
              {production.totals.started} batches started, {production.totals.completed} completed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="max-w-2xl">
              <BarList
                label="Median time per stage"
                items={production.stages.map((s) => ({
                  id: s.stage,
                  label: s.label,
                  value: s.medianMs ?? 0,
                  valueLabel: s.medianMs === null ? "no visits" : formatDuration(s.medianMs),
                  detail: `${s.visits} visits; average ${s.avgMs === null ? "—" : formatDuration(s.avgMs)}`,
                  highlight: s.stage === production.bottleneck ? "Bottleneck" : undefined,
                  muted: s.stage !== production.bottleneck,
                }))}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Stage</TableHead>
                  <TableHead numeric>Visits</TableHead>
                  <TableHead numeric>Median</TableHead>
                  <TableHead numeric>Average</TableHead>
                  <TableHead numeric>In stage now</TableHead>
                  <TableHead numeric>Longest wait</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {production.stages.map((s) => (
                  <TableRow key={s.stage}>
                    <TableCell className="font-medium">{s.label}</TableCell>
                    <TableCell numeric>{s.visits}</TableCell>
                    <TableCell numeric>
                      {s.medianMs === null ? "—" : formatDuration(s.medianMs)}
                    </TableCell>
                    <TableCell numeric>
                      {s.avgMs === null ? "—" : formatDuration(s.avgMs)}
                    </TableCell>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daily summary</CardTitle>
          <CardDescription>
            One row per Manila day, newest first. Same numbers as the Daily CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="daily-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Day</TableHead>
                <TableHead numeric>Scanned</TableHead>
                <TableHead numeric>Pass</TableHead>
                <TableHead numeric>Rework</TableHead>
                <TableHead numeric>Reject</TableHead>
                <TableHead numeric>Pending</TableHead>
                <TableHead numeric>Overridden</TableHead>
                <TableHead numeric>AI agreement</TableHead>
                <TableHead numeric>Repairs done</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...quality.days].reverse().map((d) => (
                <TableRow
                  key={d.day}
                  aria-label={d.day}
                  className={cn(d.scanned === 0 && "text-muted-foreground")}
                >
                  <TableCell>{formatDayLabel(d.day)}</TableCell>
                  <TableCell numeric>{d.scanned}</TableCell>
                  <TableCell numeric>{d.pass}</TableCell>
                  <TableCell numeric>{d.rework}</TableCell>
                  <TableCell numeric>{d.reject}</TableCell>
                  <TableCell numeric>{d.pending}</TableCell>
                  <TableCell numeric>{d.overridden}</TableCell>
                  <TableCell numeric>{formatPercent(d.agreement)}</TableCell>
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
