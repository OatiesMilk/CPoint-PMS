/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the desk after a stock update (Wednesday and Friday by default).
 * What:  what each material was used for in a picked week of a month against the week before,
 *        and which item may run out before the next update (Phase 29, D-102); leather rolls checked,
 *        used (passed), returned to supplier and removed per week, with each week's working days
 *        (D-116, D-118). Year, Month, Week and Find pick what shows (D-109).
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
  TableActionsHead,
  TableViewLink,
} from "@/components/ui/table";
import { formatDelta, formatQuantity } from "@/lib/inventory-rules";
import { clampPage, pageCountFor, pageOf } from "@/lib/pagination";
import { weekRangeText, workingDaysLabel } from "@/lib/month-weeks";
import { describeReminderDays } from "@/lib/stock-rules";
import { requirePermission } from "@/server/policies/guard";
import { materialsReport, type MaterialsReport } from "@/server/services/materials.service";
import { ReportTabs } from "../_components/report-tabs";
import { MaterialFilters } from "./material-filters";

// The warning names the first few materials; the rest open in place (Phase 30F-2).
const AT_RISK_SHOWN = 5;

export const metadata: Metadata = { title: "Materials" };

const fmt = (n: number) => new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(n);

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
  const params = await searchParams;
  const report = await materialsReport(params);
  const pageParam = Number(params.page);
  const pageCount = pageCountFor(report.rows.length);
  const page = clampPage(Number.isInteger(pageParam) ? pageParam : 1, pageCount);
  const shown = pageOf(report.rows, page);
  const atRisk = report.atRisk;
  const { selected, previous } = report;
  const ongoing = selected.from === report.current.from;
  // The choice, as the URL carries it (the CSV and the pager keep it).
  const choice = new URLSearchParams({
    year: String(selected.year),
    month: String(selected.month),
    week: String(selected.week),
    ...(report.q ? { q: report.q } : {}),
  });
  const pageHref = (p: number) => {
    const next = new URLSearchParams(choice);
    if (p > 1) next.set("page", String(p));
    return `/reports/materials?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="What each material was used for, from the Used entries on Update stock. Corrections aren't counted as use."
        actions={
          <Button asChild variant="secondary">
            <a href={`/api/v1/reports/materials-used.csv?${choice.toString()}`} download>
              <Download aria-hidden />
              Materials CSV
            </a>
          </Button>
        }
      />
      <ReportTabs current="materials" />

      {report.itemCount === 0 ? (
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
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-caution bg-caution-soft px-4 py-3"
              data-testid="may-run-out"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-caution" />
              <div>
                {atRisk.length === 1
                  ? `${atRisk[0].name} may run out before the next update.`
                  : atRisk.length <= AT_RISK_SHOWN
                    ? `${atRisk.length} materials may run out before the next update: ${atRisk.map((r) => r.name).join(", ")}.`
                    : `${atRisk.length} materials may run out before the next update: ${atRisk
                        .slice(0, AT_RISK_SHOWN)
                        .map((r) => r.name)
                        .join(", ")}, …`}
                {atRisk.length > AT_RISK_SHOWN && (
                  <details className="group mt-1">
                    <summary className="w-fit cursor-pointer text-sm font-medium underline underline-offset-4">
                      Show all {atRisk.length}
                    </summary>
                    <p className="mt-1">{atRisk.map((r) => r.name).join(", ")}.</p>
                  </details>
                )}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Used per material</CardTitle>
              <CardDescription>
                A month&rsquo;s weeks run from the 1st: days 1 to 7, 8 to 14, and so on; the last
                week can be shorter. Days left uses the last {report.pace.days} days up to today, or
                the days since an item&rsquo;s first stock entry when that is shorter, whatever week
                is picked.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <MaterialFilters
                year={selected.year}
                month={selected.month}
                week={selected.week}
                years={report.years}
                today={report.today}
              />
              <p className="text-sm" role="status" data-testid="materials-week">
                <span className="font-medium">
                  {selected.label.split(" · ")[0]}: {weekRangeText(selected)}
                </span>
                {ongoing && <span className="text-muted-foreground"> (so far, up to today)</span>}
                <span className="text-muted-foreground">
                  {" "}
                  · compared with {previous.label.split(" · ")[0]} of {weekRangeText(previous)}
                  {report.days.previous !== report.days.selected &&
                    ` (${report.days.previous} days against ${report.days.selected})`}
                  .
                </span>
              </p>
              {report.nothingUsedInWeek && report.rows.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing was entered as used in this week. The figures fill in from the Used
                  entries on Update stock, and leather from the rolls finished at Capture.
                </p>
              )}
              {report.rows.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center"
                  data-testid="materials-no-match"
                >
                  <h3 className="font-semibold">No material matches &ldquo;{report.q}&rdquo;</h3>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Search looks at each material&rsquo;s name and item code. Check the spelling, or
                    clear the search to see all {report.itemCount} materials.
                  </p>
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`/reports/materials?${new URLSearchParams({
                        year: String(selected.year),
                        month: String(selected.month),
                        week: String(selected.week),
                      }).toString()}`}
                    >
                      Clear the search
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Material</TableHead>
                      <TableHead numeric>Selected week</TableHead>
                      <TableHead numeric>Previous week</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead numeric>On hand</TableHead>
                      <TableHead>Days left</TableHead>
                      <TableActionsHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((row) => (
                      <TableRow key={row.id} aria-label={`${row.sku} ${row.name}`}>
                        <TableCell className="max-w-72 whitespace-normal">
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
                          {row.category === "LEATHER_ROLL" && (
                            <span className="block text-sm text-muted-foreground">
                              Rolls that left stock: used, returned or removed
                            </span>
                          )}
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
                        <TableCell numeric className="whitespace-nowrap">
                          {formatQuantity(row.onHand, row.unit)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.daysLeft === null ? (
                            <span className="text-muted-foreground">Not used lately</span>
                          ) : (
                            <span className="flex flex-col items-start gap-1">
                              <span>
                                about {Math.floor(row.daysLeft)}{" "}
                                {Math.floor(row.daysLeft) === 1 ? "day" : "days"}
                              </span>
                              {row.mayRunOut && (
                                <Badge tone="warning">
                                  <TriangleAlert aria-hidden />
                                  May run out before the next update
                                </Badge>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <TableViewLink href={`/inventory/${row.id}`} what={row.name} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <TablePager
                page={page}
                pageCount={pageCount}
                total={report.rows.length}
                noun={["material", "materials"]}
                label="Material pages"
                href={pageHref}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leather rolls</CardTitle>
              <CardDescription>
                Rolls checked by the camera are every roll finished at Capture. Each is used (the
                camera passed it) or returned to supplier (over the defect limit). Removed (other)
                are rolls the Floor Manager took out of stock, such as water damage. Pairs finished
                are all pairs counted at Finish batch, for the eight weeks up to the selected one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Week</TableHead>
                    <TableHead numeric>Rolls used</TableHead>
                    <TableHead numeric>Rolls checked by the camera</TableHead>
                    <TableHead numeric>Returned to supplier</TableHead>
                    <TableHead numeric>Removed (other)</TableHead>
                    <TableHead numeric>Pairs finished</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...report.leather].reverse().map((w) => (
                    <TableRow key={w.week.from}>
                      <TableCell className="whitespace-nowrap">
                        {w.week.label}
                        {w.week.year !== selected.year && `, ${w.week.year}`}
                        <span className="block text-sm text-muted-foreground">
                          {workingDaysLabel(w.workingDays)}
                        </span>
                      </TableCell>
                      <TableCell numeric>{fmt(w.rollsUsed)}</TableCell>
                      <TableCell numeric>{fmt(w.rollsChecked)}</TableCell>
                      <TableCell numeric>{fmt(w.rollsReturned)}</TableCell>
                      <TableCell numeric>{fmt(w.rollsRemoved)}</TableCell>
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
