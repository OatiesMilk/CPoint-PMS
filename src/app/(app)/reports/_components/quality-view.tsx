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
 * The quality report: the leather rolls checked before cutting, each Scanning passed or Returned
 * to supplier (D-116, counted per roll since D-117), and the defects the camera found on them. A
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
          {
            label: "Rolls scanned",
            value: t.rolls.toLocaleString("en-PH"),
            sub: "finished at Capture",
            testid: "total-rolls",
          },
          {
            label: "Scanning passed",
            value: formatPercent(share(t.passed, t.rolls)),
            sub: `${t.passed} ${t.passed === 1 ? "roll" : "rolls"}`,
            testid: "total-passed",
          },
          {
            label: "Returned to supplier",
            value: formatPercent(share(t.returned, t.rolls)),
            sub: `${t.returned} ${t.returned === 1 ? "roll" : "rolls"}`,
            testid: "total-returned",
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

      {t.rolls === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <h2 className="text-xl font-semibold">No rolls scanned in this range</h2>
          <p className="max-w-md text-muted-foreground">
            No leather roll was finished at Capture on these days. Try a longer range.
          </p>
          <Button asChild variant="secondary">
            <Link href="/reports?view=quality&preset=30d">Show the last 30 days</Link>
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Rolls scanned per day</CardTitle>
              <CardDescription>
                Each roll on the day it was finished at Capture: passed, or returned to supplier
                when defects covered more than the limit of its area. The table at the bottom has
                the numbers.
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
                The rolls each type was found on, biggest first, with its share and the cumulative
                share (Pareto): the top few types usually cause most of the defects. Returned counts
                those rolls that were returned to supplier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {defects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No defects found in this range.</p>
              ) : (
                <Table aria-label="Defects by type">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Defect</TableHead>
                      <TableHead numeric>Rolls found on</TableHead>
                      <TableHead numeric>Returned</TableHead>
                      <TableHead numeric>Share</TableHead>
                      <TableHead numeric>Cumulative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defects.slice(0, DEFECT_ROWS).map((d) => (
                      <TableRow key={d.key}>
                        <TableCell className="font-medium">{d.label}</TableCell>
                        <TableCell numeric>{d.rolls}</TableCell>
                        <TableCell numeric>{d.returned}</TableCell>
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
                <TableHead numeric>Rolls scanned</TableHead>
                <TableHead numeric>Scanning passed</TableHead>
                <TableHead numeric>Returned to supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...quality.days].reverse().map((d) => (
                <TableRow
                  key={d.day}
                  aria-label={d.day}
                  className={cn(d.rolls === 0 && "text-muted-foreground")}
                >
                  <TableCell>{formatDayLabel(d.day)}</TableCell>
                  <TableCell numeric>{d.rolls}</TableCell>
                  <TableCell numeric>{d.passed}</TableCell>
                  <TableCell numeric>{d.returned}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
