/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the desk after a stock update (Wednesday and Friday by default).
 * What:  what each material was used for this week against last week, the 8-week trend, how much
 *        goes into 100 pairs, and which item may run out before the next update (Phase 29, D-102).
 * Worst: a miscount read as consumption, or a material running out between updates. So only the
 *        Used entries count (never Corrections), and "May run out" is a labelled badge. No person
 *        is named or counted (D-008).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Download, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { TablePager } from "@/components/features/table-pager";
import { Badge } from "@/components/ui/badge";
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
import { formatDayLabel } from "@/lib/format";
import { formatDelta, formatQuantity } from "@/lib/inventory-rules";
import { clampPage, pageCountFor, pageOf } from "@/lib/pagination";
import { describeReminderDays } from "@/lib/stock-rules";
import { requirePermission } from "@/server/policies/guard";
import { materialsReport, type MaterialsReport } from "@/server/services/materials.service";
import { ReportTabs } from "../_components/report-tabs";

export const metadata: Metadata = { title: "Materials" };

const fmt = (n: number) => new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(n);

/** Eight small columns, one a week, oldest first; the numbers are read out for screen readers. */
function Trend({ values, weeks, unit }: { values: number[]; weeks: string[]; unit: string }) {
  const max = Math.max(...values, 0);
  return (
    <div className="flex h-6 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={weeks[i]}
          title={`Week of ${formatDayLabel(weeks[i])}: ${formatQuantity(v, unit)}`}
          className={
            i === values.length - 1 ? "w-2 bg-(--chart-bar)" : "w-2 bg-(--chart-bar-muted)"
          }
          style={{ height: max > 0 ? `${Math.max(8, (v / max) * 100)}%` : "8%" }}
        />
      ))}
    </div>
  );
}

function Change({ row }: { row: MaterialsReport["rows"][number] }) {
  if (row.thisWeek === 0 && row.lastWeek === 0)
    return <span className="text-muted-foreground">—</span>;
  const pct = row.change === null ? null : Math.round(Math.abs(row.change) * 100);
  return (
    <span className="whitespace-nowrap">
      {formatDelta(row.diff)}
      {pct !== null && (
        <span className="text-muted-foreground">
          {" "}
          ({row.diff >= 0 ? "up" : "down"} {pct}%)
        </span>
      )}
    </span>
  );
}

export default async function MaterialsReportPage({
  searchParams,
}: PageProps<"/reports/materials">) {
  await requirePermission("report:production");
  await connection();
  const report = await materialsReport();
  const pageParam = Number((await searchParams).page);
  const pageCount = pageCountFor(report.rows.length);
  const page = clampPage(Number.isInteger(pageParam) ? pageParam : 1, pageCount);
  const shown = pageOf(report.rows, page);
  const atRisk = report.rows.filter((r) => r.mayRunOut);
  const nothingUsed = report.rows.every((r) => r.trend.every((v) => v === 0));

  return (
    <>
      <PageHeader
        title="Reports"
        description="What each material was used for, from the Used entries on Update stock. Corrections aren't counted as use."
        actions={
          <Button asChild variant="secondary">
            <a href="/api/v1/reports/materials-used.csv" download>
              <Download aria-hidden />
              Materials CSV
            </a>
          </Button>
        }
      />
      <ReportTabs current="materials" />

      {report.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No materials yet</h2>
          <p className="max-w-md text-muted-foreground">
            Add the materials you keep on the shelf under Inventory, then update stock on{" "}
            {describeReminderDays(report.reminderDays)}.
          </p>
          <Button asChild className="mt-2">
            <Link href="/inventory">Inventory</Link>
          </Button>
        </div>
      ) : (
        <>
          {atRisk.length > 0 && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-caution bg-caution-soft px-4 py-3"
              data-testid="may-run-out"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-caution" />
              {atRisk.length === 1
                ? `${atRisk[0].name} may run out before the next update.`
                : `${atRisk.length} materials may run out before the next update: ${atRisk.map((r) => r.name).join(", ")}.`}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Used per material</CardTitle>
              <CardDescription>
                This week is the week of {formatDayLabel(report.weeks[report.weeks.length - 1])}.
                Per 100 pairs and days left use the last {report.pace.days} days (
                {fmt(report.pace.pairs)} pairs finished, failed ones included), or the days since an
                item&rsquo;s first stock entry when that is shorter.
                {nothingUsed &&
                  " Nothing has been entered as used yet: the figures fill in after the next stock update."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Material</TableHead>
                    <TableHead numeric>This week</TableHead>
                    <TableHead numeric>Last week</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Last 8 weeks</TableHead>
                    <TableHead numeric>Per 100 pairs</TableHead>
                    <TableHead numeric>On hand</TableHead>
                    <TableHead>Days left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((row) => (
                    <TableRow key={row.id} aria-label={`${row.sku} ${row.name}`}>
                      <TableCell>
                        <Link
                          href={`/inventory/${row.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.name}
                        </Link>
                        <span className="block text-sm text-muted-foreground">
                          {row.categoryLabel}
                          {row.supplier && <> · {row.supplier}</>}
                        </span>
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap">
                        {formatQuantity(row.thisWeek, row.unit)}
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap text-muted-foreground">
                        {formatQuantity(row.lastWeek, row.unit)}
                      </TableCell>
                      <TableCell>
                        <Change row={row} />
                      </TableCell>
                      <TableCell>
                        <Trend values={row.trend} weeks={report.weeks} unit={row.unit} />
                        <span className="sr-only">
                          {row.trend.map((v) => fmt(v)).join(", ")} {row.unit}, oldest week first
                        </span>
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap">
                        {row.perHundredPairs === null
                          ? "—"
                          : formatQuantity(row.perHundredPairs, row.unit)}
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap">
                        {formatQuantity(row.onHand, row.unit)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.daysLeft === null ? (
                          <span className="text-muted-foreground">Not used lately</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            about {Math.floor(row.daysLeft)}{" "}
                            {Math.floor(row.daysLeft) === 1 ? "day" : "days"}
                            {row.mayRunOut && (
                              <Badge tone="warning">
                                <TriangleAlert aria-hidden />
                                May run out before the next update
                              </Badge>
                            )}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={page}
                pageCount={pageCount}
                total={report.rows.length}
                noun={["material", "materials"]}
                href={(p) => (p > 1 ? `/reports/materials?page=${p}` : "/reports/materials")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leather rolls</CardTitle>
              <CardDescription>
                Rolls entered as used on Update stock, beside the rolls the camera checked (finished
                at Capture), per week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Week of</TableHead>
                    <TableHead numeric>Rolls used</TableHead>
                    <TableHead numeric>Rolls checked by the camera</TableHead>
                    <TableHead numeric>Pairs finished</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...report.leather].reverse().map((w) => (
                    <TableRow key={w.week}>
                      <TableCell className="whitespace-nowrap">{formatDayLabel(w.week)}</TableCell>
                      <TableCell numeric>{fmt(w.rollsUsed)}</TableCell>
                      <TableCell numeric>{fmt(w.rollsChecked)}</TableCell>
                      <TableCell numeric>{fmt(w.pairs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
