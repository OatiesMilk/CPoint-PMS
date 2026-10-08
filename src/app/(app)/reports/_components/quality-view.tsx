import Link from "next/link";
import { VerdictTrendChart } from "@/components/features/charts/verdict-trend-chart";
import { RepairStationCard } from "./ops-sections";
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
import { formatDayLabel, formatPercent } from "@/lib/format";
import { paretoShares } from "@/lib/ops-rules";
import { cn } from "@/lib/utils";
import type { RepairStation } from "@/server/services/ops-report.service";
import type { QualityReport } from "@/server/services/report.service";

const VERDICT_LABEL = {
  PASS: "Pass",
  REWORK: "Rework",
  REJECT: "Reject",
  NEEDS_REVIEW: "Needs review",
};
const DEFECT_ROWS = 8;
const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/**
 * The quality report: the checkpoint before cutting (what the camera found and how people
 * decided), plus the repair station. The Quality Inspector's report, and a tab for the Floor
 * Manager.
 */
export function QualityView({
  quality,
  repairs,
  days,
}: {
  quality: QualityReport;
  repairs: RepairStation;
  days: number;
}) {
  const t = quality.totals;
  const decided = t.pass + t.rework + t.reject;
  const defects = paretoShares(quality.defects);

  return (
    <>
      <RepairStationCard repairs={repairs} days={days} />

      <section
        aria-label="Totals"
        className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4"
      >
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
            <Link href="/reports?view=quality&preset=30d">Show the last 30 days</Link>
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

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Defects by type</CardTitle>
                <CardDescription>
                  Biggest first, with each type’s share and the cumulative share (Pareto): the top
                  few types usually cause most of the defects. Unknown classes are listed by the key
                  the camera sent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {defects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No defects detected in this range.
                  </p>
                ) : (
                  <Table aria-label="Defects by type">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Defect</TableHead>
                        <TableHead numeric>Sections</TableHead>
                        <TableHead numeric>Share</TableHead>
                        <TableHead numeric>Cumulative</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defects.slice(0, DEFECT_ROWS).map((d) => (
                        <TableRow
                          key={d.key}
                          title={`${d.pass} pass, ${d.rework} rework, ${d.reject} reject, ${d.pending} pending`}
                        >
                          <TableCell className="font-medium">
                            {d.known ? (
                              <Link
                                href={`/scans?defect=${encodeURIComponent(d.key)}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {d.label}
                              </Link>
                            ) : (
                              `${d.label} (unknown)`
                            )}
                          </TableCell>
                          <TableCell numeric>{d.scans}</TableCell>
                          <TableCell numeric>{formatPercent(d.share)}</TableCell>
                          <TableCell numeric>{formatPercent(d.cumulative)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {defects.length > DEFECT_ROWS && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {defects.length - DEFECT_ROWS} more rare types, all in the Defects CSV.
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
