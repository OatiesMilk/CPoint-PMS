/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the desk, a few times a day.
 * What:  every leather roll: added in Inventory with its area (Phase 30A), scanned at Capture,
 *        how many shots passed or were rejected (for salvage), and whether it is fully used.
 * Worst: a roll left open for days goes unnoticed, or a roll is read as a person's work. No person
 *        is named or counted on this page (D-008).
 */
import type { Metadata } from "next";
import Link from "next/link";
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
  const [{ rows, total, page, pageCount }, suppliers] = await Promise.all([
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

  return (
    <>
      <PageHeader
        title="Reports"
        description="Every leather roll: when it was scanned, what passed and how much of it has defects. Never per person."
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
          <Table label="Rolls">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Roll</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead numeric>Area</TableHead>
                <TableHead>Scanned</TableHead>
                <TableHead numeric>Shots</TableHead>
                <TableHead numeric>Passed</TableHead>
                <TableHead numeric>Rejected (for salvage)</TableHead>
                <TableHead numeric>Defect %</TableHead>
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
                      <span className="block text-sm text-muted-foreground">{r.item.name}</span>
                    )}
                    {r.tagCode && (
                      <span className="block font-mono text-sm text-muted-foreground">
                        Tag {r.tagCode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{r.supplier?.name ?? "Not recorded"}</TableCell>
                  <TableCell numeric>{formatArea(r.areaSqFt)}</TableCell>
                  <TableCell>
                    {r.finishedAt ? (
                      formatManilaDateTime(r.finishedAt)
                    ) : (
                      <span className="text-muted-foreground">
                        {r.startedAt ? "Being scanned" : "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell numeric>{r._count.scans}</TableCell>
                  <TableCell numeric>{r.passed}</TableCell>
                  <TableCell numeric>{r.rejected}</TableCell>
                  <TableCell numeric>
                    <DefectShare roll={r} />
                  </TableCell>
                  <TableCell>
                    <RollStatusBadge status={r.status} />
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
