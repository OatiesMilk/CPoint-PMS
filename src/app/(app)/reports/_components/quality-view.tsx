import Link from "next/link";
import { VerdictTrendChart } from "@/components/features/charts/verdict-trend-chart";
import { KpiTile } from "@/components/features/kpi-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { FilterForm, FilteredNote } from "@/components/features/reports/filters";
import { SortableHeader } from "@/components/features/reports/sortable-header";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDayLabel, formatPercent } from "@/lib/format";
import { paretoShares } from "@/lib/ops-rules";
import { sortFor, type SortKey, type SortState } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import type { QualityReport } from "@/server/services/report.service";

const DEFECT_ROWS = 8;
const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

type DefectRow = QualityReport["defects"][number] & { share: number; cumulative: number };
const DEFECT_KEYS: Record<string, SortKey<DefectRow>> = {
  defect: (d) => d.label,
  "rolls-found-on": (d) => d.rolls,
  returned: (d) => d.returned,
  share: (d) => d.share,
  cumulative: (d) => d.cumulative,
};

type DayRow = QualityReport["days"][number];
const DAY_KEYS: Record<string, SortKey<DayRow>> = {
  day: (d) => d.day,
  "rolls-scanned": (d) => d.rolls,
  "scanning-passed": (d) => d.passed,
  "returned-to-supplier": (d) => d.returned,
};

/**
 * The quality report: the leather rolls checked before cutting, each Scanning passed or Returned
 * to supplier (D-116, counted per roll since D-117), and the defects the camera found on them. A
 * tab for the Floor Manager.
 */
export function QualityView({
  quality,
  sort,
  defect,
  defectChoices,
}: {
  quality: QualityReport;
  sort: SortState | null;
  /** The Defect filter (a leather defect type's key): the defects table shows it alone. */
  defect?: string;
  defectChoices: { key: string; label: string }[];
}) {
  const t = quality.totals;
  // Shares are worked out over every type first, so a filtered row keeps its real share.
  const everyDefect = paretoShares(quality.defects);
  const defects = defect ? everyDefect.filter((d) => d.key === defect) : everyDefect;

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
          <KpiTile key={tile.label} label={tile.label} value={tile.value} valueTestId={tile.testid}>
            {tile.sub && <p>{tile.sub}</p>}
          </KpiTile>
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
          {/* Not printed: it holds only the chart; the Daily summary table has the numbers. */}
          <Card className="print:hidden">
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
              <FilterForm owns={["defect"]} label="Defect filter" active={Boolean(defect)}>
                <div className="flex w-full flex-col gap-1.5 sm:w-56">
                  <Label htmlFor="filter-defect">Defect type</Label>
                  <Select id="filter-defect" name="defect" defaultValue={defect ?? ""}>
                    <option value="">All defect types</option>
                    {defectChoices.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </FilterForm>
              {defect && (
                <FilteredNote
                  owns={["defect"]}
                  text={`Defect: ${defectChoices.find((c) => c.key === defect)?.label ?? defect}`}
                />
              )}
            </CardHeader>
            <CardContent>
              {defects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {defect ? "No defects match this filter." : "No defects found in this range."}
                </p>
              ) : (
                <Table aria-label="Defects by type">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <SortableHeader table="defects" column="defect">
                        Defect
                      </SortableHeader>
                      <SortableHeader table="defects" column="rolls-found-on" numeric>
                        Rolls found on
                      </SortableHeader>
                      <SortableHeader table="defects" column="returned" numeric>
                        Returned
                      </SortableHeader>
                      <SortableHeader table="defects" column="share" numeric>
                        Share
                      </SortableHeader>
                      <SortableHeader table="defects" column="cumulative" numeric>
                        Cumulative
                      </SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortFor(sort, "defects", defects.slice(0, DEFECT_ROWS), DEFECT_KEYS).map(
                      (d) => (
                        <TableRow key={d.key}>
                          <TableCell className="font-medium">{d.label}</TableCell>
                          <TableCell numeric>{d.rolls}</TableCell>
                          <TableCell numeric>{d.returned}</TableCell>
                          <TableCell numeric>{formatPercent(d.share)}</TableCell>
                          <TableCell numeric>{formatPercent(d.cumulative)}</TableCell>
                        </TableRow>
                      ),
                    )}
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
                <SortableHeader table="daily" column="day">
                  Day
                </SortableHeader>
                <SortableHeader table="daily" column="rolls-scanned" numeric>
                  Rolls scanned
                </SortableHeader>
                <SortableHeader table="daily" column="scanning-passed" numeric>
                  Scanning passed
                </SortableHeader>
                <SortableHeader table="daily" column="returned-to-supplier" numeric>
                  Returned to supplier
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortFor(sort, "daily", [...quality.days].reverse(), DAY_KEYS).map((d) => (
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
