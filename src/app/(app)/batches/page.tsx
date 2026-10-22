/*
 * Intent brief (ui-craft §1)
 * Who:   Floor Manager (manages), Quality Inspector and Admin (read), several times a shift.
 * What:  find a batch and see where it is on the line and for how long.
 * Worst: a stuck batch goes unnoticed. Time in stage sits next to the stage.
 */
import type { Metadata } from "next";
import { TablePager } from "@/components/features/table-pager";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { BatchStatusBadge } from "@/components/features/batches/batch-status-badge";
import { InRepairBadge } from "@/components/features/batches/in-repair-badge";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCalendarDate } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getBatchFormOptions, listBatches } from "@/server/services/batch.service";
import { batchListQuerySchema } from "@/server/validators/batch.validator";
import { BatchFilters } from "./batch-filters";

export const metadata: Metadata = { title: "Batches" };

export default async function BatchesPage({ searchParams }: PageProps<"/batches">) {
  const user = await requirePermission("batch:read");
  await connection();
  const query = batchListQuerySchema.parse(await searchParams);
  const filtered = Boolean(query.status || query.shoeTypeId || query.q);
  const [{ rows, total, page, pageCount }, { shoeTypes }] = await Promise.all([
    listBatches(query, query.page ?? 1),
    getBatchFormOptions(),
  ]);
  const canManage = can(user.role, "batch:manage");

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") next.set(k, String(v));
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/batches?${qs}` : "/batches";
  };

  return (
    <>
      <PageHeader
        title="Batches"
        description="One batch per leather roll. Start it at Preparation, where the camera checks each section, and finish it when the roll is used up."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/batches/new">
                <Plus aria-hidden />
                New batch
              </Link>
            </Button>
          )
        }
      />

      {(total > 0 || filtered) && <BatchFilters shoeTypes={shoeTypes} />}

      {total === 0 && !filtered ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No batches yet</h2>
          <p className="max-w-md text-muted-foreground">
            {canManage
              ? "Register the first leather roll. Start it when it goes to the cutting table."
              : "The Floor Manager registers each leather roll as a batch. They'll appear here."}
          </p>
          {canManage && (
            <Button asChild className="mt-2">
              <Link href="/batches/new">Register a leather roll</Link>
            </Button>
          )}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No batches match these filters</h2>
          <p className="text-muted-foreground">
            Try a different status or shoe type, or clear the filters.
          </p>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/batches">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Table label="Batches">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Batch</TableHead>
                <TableHead>Roll code</TableHead>
                <TableHead>Shoe type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => {
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link
                        href={`/batches/${b.id}`}
                        className="font-mono font-medium underline-offset-4 hover:underline"
                      >
                        {b.code}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">{b.rollCode}</TableCell>
                    <TableCell>{b.shoeType.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <BatchStatusBadge status={b.status} currentStage={b.currentStage} />
                        <InRepairBadge count={b.openRepairs} />
                      </div>
                    </TableCell>
                    <TableCell>{formatCalendarDate(b.receivedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <TablePager
            page={page}
            pageCount={pageCount}
            total={total}
            noun={["batch", "batches"]}
            href={pageHref}
          />
        </div>
      )}
    </>
  );
}
