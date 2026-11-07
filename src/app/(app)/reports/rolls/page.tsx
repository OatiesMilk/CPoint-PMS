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
  TableHead,
  TableHeader,
  TableRow,
  TableActionsHead,
  TableViewLink,
} from "@/components/ui/table";
import { formatManilaDateTime } from "@/lib/format";
import { formatArea } from "@/lib/roll-rules";
import { formatScanningTime } from "@/lib/roll-timer";
import { requirePermission } from "@/server/policies/guard";
import { listRollsForReport, supplierOptions } from "@/server/services/roll.service";
import { rollListQuerySchema } from "@/server/validators/roll.validator";
import { ReportTabs } from "../_components/report-tabs";
import { RollFilters } from "./roll-filters";

export const metadata: Metadata = { title: "Rolls" };

export default async function RollsReportPage({ searchParams }: PageProps<"/reports/rolls">) {
  await requirePermission("roll:read");
  await connection();
  const query = rollListQuerySchema.parse(await searchParams);
  const filtered = Boolean(query.status || query.supplierId || query.days || query.q);
  const [{ rows, total, page, pageCount, scanning }, suppliers] = await Promise.all([
    listRollsForReport(query),
    supplierOptions(),
  ]);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") next.set(k, String(v));
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/reports/rolls?${qs}` : "/reports/rolls";
  };
  const csvQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v && k !== "page") csvQuery.set(k, String(v));
  const csvHref = `/api/v1/reports/rolls.csv${csvQuery.size ? `?${csvQuery}` : ""}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Every leather roll: when it was scanned, what passed and how much of it has defects. Never per person."
        actions={
          total > 0 && (
            <Button asChild variant="secondary">
              <a href={csvHref}>
                <Download aria-hidden />
                Download CSV
              </a>
            </Button>
          )
        }
      />
      <ReportTabs current="rolls" />

      {(total > 0 || filtered) && <RollFilters suppliers={suppliers} />}

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
            Try another supplier, status or period, or clear the filters.
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
                <TableHead>Roll</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead numeric>Area</TableHead>
                <TableHead>Scanned</TableHead>
                <TableHead numeric className="h-auto py-2 align-bottom whitespace-normal">
                  Scanning time
                </TableHead>
                <TableHead numeric>Shots</TableHead>
                <TableHead numeric>Passed</TableHead>
                <TableHead numeric>Rejected</TableHead>
                <TableHead numeric className="h-auto py-2 align-bottom whitespace-normal">
                  Defect %
                </TableHead>
                <TableHead>Status</TableHead>
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
          <TablePager
            page={page}
            pageCount={pageCount}
            total={total}
            noun={["roll", "rolls"]}
            href={pageHref}
          />
        </div>
      )}
    </>
  );
}
