import Link from "next/link";
import { VerdictTrendChart } from "@/components/features/charts/verdict-trend-chart";
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
import type { QualityReport } from "@/server/services/report.service";

const DEFECT_ROWS = 8;
const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/**
 * The quality report: the checkpoint before cutting, Pass or Reject (D-093), and what the camera
 * found. A rejected section is reported for salvage (A-11). The Quality Inspector's report, and a
 * tab for the Floor Manager.
 */
export function QualityView({ quality }: { quality: QualityReport }) {
  const t = quality.totals;
  const defects = paretoShares(quality.defects);

  return (
    <>
      <section
        aria-label="Totals"
        className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4"
      >
        {[
          { label: "Scanned", value: t.scanned.toLocaleString("en-PH"), testid: "total-scanned" },
          {
            label: "Pass",
            value: formatPercent(share(t.pass, t.scanned)),
            sub: `${t.pass} sections`,
            testid: "total-pass",
          },
          {
            label: "Reject (for salvage)",
            value: formatPercent(share(t.reject, t.scanned)),
            sub: `${t.reject} sections`,
            testid: "total-reject",
          },
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
                Pass and Reject (for salvage). The camera’s verdict is final. The table at the
                bottom has the numbers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VerdictTrendChart days={quality.days} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Defects by type</CardTitle>
              <CardDescription>
                Biggest first, with each type’s share and the cumulative share (Pareto): the top few
                types usually cause most of the defects. Rejected counts the sections whose main
                defect it was that were rejected, for salvage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {defects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No defects detected in this range.</p>
              ) : (
                <Table aria-label="Defects by type">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Defect</TableHead>
                      <TableHead numeric>Sections</TableHead>
                      <TableHead numeric>Rejected</TableHead>
                      <TableHead numeric>Share</TableHead>
                      <TableHead numeric>Cumulative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defects.slice(0, DEFECT_ROWS).map((d) => (
                      <TableRow key={d.key}>
                        <TableCell className="font-medium">{d.label}</TableCell>
                        <TableCell numeric>{d.scans}</TableCell>
                        <TableCell numeric>{d.reject}</TableCell>
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
                <TableHead numeric>Reject (for salvage)</TableHead>
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
                  <TableCell numeric>{d.reject}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
