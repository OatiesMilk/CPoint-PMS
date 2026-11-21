/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the desk, a few times a day.
 * What:  every leather roll: added in Inventory with its area (Phase 30A), scanned at Capture,
 *        how many shots passed or were rejected, and whether it was returned to the supplier (D-116);
 *        how long each took to scan and the average (D-121), to compare with the manual check.
 * Worst: a roll left open for days goes unnoticed, or a roll is read as a person's work. No person
 *        is named or counted on this page (D-008).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Download, Timer } from "lucide-react";
import { connection } from "next/server";
import { DefectShare } from "@/components/features/rolls/defect-share";
import { RollStatusBadge } from "@/components/features/rolls/roll-status-badge";
import { PageHeader } from "@/components/features/page-header";
import { TablePager } from "@/components/features/table-pager";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableActionsHead,
  TableViewLink,
} from "@/components/ui/table";
import { formatManilaDateTime, manilaToday } from "@/lib/format";
import { ROLL_REPORT_STATUS_LABELS } from "@/lib/roll-rules";
import { formatArea } from "@/lib/roll-rules";
import { formatScanningTime } from "@/lib/roll-timer";
import { PeriodPicker } from "@/components/features/reports/period-picker";
import { AutoPrint, PrintButton } from "@/components/features/reports/print-button";
import { PrintHeader, PrintPage } from "@/components/features/reports/print-header";
import { ReportFooter } from "@/components/features/reports/report-footer";
import { SortableHeader } from "@/components/features/reports/sortable-header";
import { appNow } from "@/lib/clock";
import { ROLE_LABELS } from "@/lib/domain";
import { parseRange } from "@/lib/report-rules";
import { parseSort, sortText } from "@/lib/table-sort";
import { requirePermission } from "@/server/policies/guard";
import {
  listRollsForReport,
  PRINT_MAX_ROLLS,
  rollFilterOptions,
} from "@/server/services/roll.service";
import { rollListQuerySchema } from "@/server/validators/roll.validator";
import { ReportTabs } from "../_components/report-tabs";
import { RollFilters } from "./roll-filters";

export const metadata: Metadata = { title: "Rolls" };

export default async function RollsReportPage({ searchParams }: PageProps<"/reports/rolls">) {
  const user = await requirePermission("roll:read");
  await connection();
  const now = appNow();
  const query = rollListQuerySchema.parse(await searchParams);
  // No period in the URL means any time; the picker offers that as its own choice.
  const dated = Boolean(query.period || query.preset || query.from || query.to);
  const range = parseRange(query, now);
  const filtered = Boolean(
    query.status ||
    query.supplierId ||
    query.itemId ||
    query.locationId ||
    query.days ||
    query.q ||
    dated,
  );
  const sort = parseSort(query.sort, query.dir);
  const [{ rows, total, page, pageCount, scanning, printCut }, options] = await Promise.all([
    listRollsForReport(query),
    rollFilterOptions(),
  ]);
  const { suppliers, items, locations } = options;

  const notes = [
    query.q && `Find: ${query.q}`,
    query.status && `Status: ${ROLL_REPORT_STATUS_LABELS[query.status]}`,
    query.supplierId &&
      `Supplier: ${suppliers.find((x) => x.id === query.supplierId)?.name ?? "supplier"}`,
    query.itemId && `Leather item: ${items.find((x) => x.id === query.itemId)?.name ?? "item"}`,
    query.locationId &&
      `Location: ${locations.find((x) => x.id === query.locationId)?.name ?? "location"}`,
    printCut &&
      `Showing the newest ${PRINT_MAX_ROLLS} of ${total} rolls. Narrow the filters to print the rest.`,
    sortText(sort),
  ].filter((x): x is string => Boolean(x));
  const printHref = (() => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") next.set(k, String(v));
    next.set("print", "1");
    next.set("autoprint", "1");
    return `/reports/rolls?${next.toString()}`;
  })();

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query))
      if (v && k !== "page" && k !== "print") next.set(k, String(v));
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/reports/rolls?${qs}` : "/reports/rolls";
  };
  const csvQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v && k !== "page" && k !== "print" && k !== "sort" && k !== "dir")
      csvQuery.set(k, String(v));
  const csvHref = `/api/v1/reports/rolls.csv${csvQuery.size ? `?${csvQuery}` : ""}`;

  return (
    <>
      <PrintPage />
      <AutoPrint />
      <PageHeader
        title="Reports"
        description="Every leather roll: when it was scanned, what passed and how much of it has defects. Never per person."
        actions={
          total > 0 && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button asChild variant="secondary">
                <a href={csvHref}>
                  <Download aria-hidden />
                  Download CSV
                </a>
              </Button>
              <PrintButton label="Print" variant="secondary" href={printHref} />
            </div>
          )
        }
      />
      <ReportTabs current="rolls" />

      <PrintHeader
        report="Rolls"
        period={
          dated
            ? `Added ${range.label} · ${range.days} day${range.days === 1 ? "" : "s"}`
            : "Any time"
        }
        preparedBy={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
        notes={notes}
        printedAt={now}
      />

      <PeriodPicker
        range={range}
        today={manilaToday(now)}
        presets={false}
        anyTime
        applied={dated}
      />
      {dated && (
        <p className="text-sm text-muted-foreground" data-testid="report-range">
          Rolls added {range.label} · {range.days} day{range.days === 1 ? "" : "s"}
        </p>
      )}

      {(total > 0 || filtered) && (
        <RollFilters suppliers={suppliers} items={items} locations={locations} />
      )}

      {total === 0 && !filtered ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No rolls yet</h2>
          <p className="max-w-md text-muted-foreground">
            A roll appears here as soon as a Shoe Constructor starts scanning it at Capture.
          </p>
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No rolls match these filters</h2>
          <p className="text-muted-foreground">
            Try another supplier, status, leather item, location or period, or clear the filters.
          </p>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/reports/rolls">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm" data-testid="average-scanning">
            <Timer aria-hidden className="size-4 text-muted-foreground" />
            {scanning.averageMs === null ? (
              <span className="text-muted-foreground">
                No scanning times yet: a roll gets one when it is finished at Capture.
              </span>
            ) : (
              <span>
                Average scanning time:{" "}
                <span className="font-semibold tabular-nums">
                  {formatScanningTime(scanning.averageMs)}
                </span>{" "}
                over {scanning.count} {scanning.count === 1 ? "roll" : "rolls"}
                <span className="text-muted-foreground">
                  {" "}
                  (Start scanning to Finish roll, lunch left out)
                </span>
              </span>
            )}
          </p>
          <Table label="Rolls" dense>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader table="rolls" column="roll">
                  Roll
                </SortableHeader>
                <SortableHeader table="rolls" column="supplier">
                  Supplier
                </SortableHeader>
                <SortableHeader table="rolls" column="area" numeric>
                  Area
                </SortableHeader>
                <SortableHeader table="rolls" column="scanned">
                  Scanned
                </SortableHeader>
                <SortableHeader
                  table="rolls"
                  column="scanning-time"
                  numeric
                  className="h-auto py-2 align-bottom whitespace-normal"
                >
                  Scanning time
                </SortableHeader>
                <SortableHeader table="rolls" column="shots" numeric>
                  Shots
                </SortableHeader>
                <SortableHeader table="rolls" column="passed" numeric>
                  Passed
                </SortableHeader>
                <SortableHeader table="rolls" column="rejected" numeric>
                  Rejected
                </SortableHeader>
                <SortableHeader
                  table="rolls"
                  column="defect"
                  numeric
                  className="h-auto py-2 align-bottom whitespace-normal"
                >
                  Defect %
                </SortableHeader>
                <SortableHeader table="rolls" column="status">
                  Status
                </SortableHeader>
                <TableActionsHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-testid="roll-row">
                  <TableCell>
                    <Link
                      href={`/reports/rolls/${r.id}`}
                      className="font-mono font-medium underline-offset-4 hover:underline"
                    >
                      {r.code}
                    </Link>
                    {r.item && (
                      <span
                        className="block max-w-24 truncate text-sm text-muted-foreground"
                        title={r.item.name}
                      >
                        {r.item.name}
                      </span>
                    )}
                    {r.tagCode && (
                      <span
                        className="block max-w-24 truncate font-mono text-sm text-muted-foreground"
                        title={`Tag ${r.tagCode}`}
                      >
                        Tag {r.tagCode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-32 whitespace-normal">
                    {r.supplier?.name ?? "Not recorded"}
                  </TableCell>
                  <TableCell numeric>{formatArea(r.areaSqFt)}</TableCell>
                  <TableCell className="min-w-20 whitespace-normal">
                    {r.finishedAt ? (
                      formatManilaDateTime(r.finishedAt)
                    ) : (
                      <span className="text-muted-foreground">
                        {r.startedAt ? "Being scanned" : "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell numeric className="tabular-nums">
                    {r.scanningMs === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatScanningTime(r.scanningMs)
                    )}
                  </TableCell>
                  <TableCell numeric>{r._count.scans}</TableCell>
                  <TableCell numeric>{r.passed}</TableCell>
                  <TableCell numeric>{r.rejected}</TableCell>
                  <TableCell numeric className="whitespace-normal">
                    <DefectShare roll={r} />
                  </TableCell>
                  <TableCell>
                    <RollStatusBadge roll={r} className="max-w-36 min-w-30 whitespace-normal" />
                  </TableCell>
                  <TableCell className="text-right">
                    <TableViewLink href={`/reports/rolls/${r.id}`} what={`roll ${r.code}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="print:hidden">
            <TablePager
              page={page}
              pageCount={pageCount}
              total={total}
              noun={["roll", "rolls"]}
              href={pageHref}
            />
          </div>
        </div>
      )}

      <ReportFooter />
    </>
  );
}
