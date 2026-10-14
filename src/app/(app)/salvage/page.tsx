/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager (manages), Quality Inspector (views), when planning cuts.
 * What:  see rejected leather that can still be used, put it into another batch, or discard it.
 * Worst: throwing away usable leather (client: materials are expensive and reused). Discard is
 *        the last option, needs a reason and confirmation; reuse is one dialog.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { TablePager } from "@/components/features/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManilaDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { assignableBatches, salvageList } from "@/server/services/salvage.service";
import { salvageListQuerySchema } from "@/server/validators/outcome.validator";
import { SalvageActions } from "./salvage-actions";

export const metadata: Metadata = { title: "Salvage" };

const TABS = [
  { status: "AVAILABLE", label: "Available" },
  { status: "ASSIGNED", label: "Reused" },
  { status: "DISCARDED", label: "Discarded" },
] as const;

export default async function SalvagePage({ searchParams }: PageProps<"/salvage">) {
  const user = await requirePermission("salvage:read");
  await connection();
  const query = salvageListQuerySchema.parse(await searchParams);
  const canManage = can(user.role, "salvage:manage");
  const [{ rows, counts, total, page, pageCount }, batches] = await Promise.all([
    salvageList(query.status, query.batch, query.page),
    canManage ? assignableBatches() : Promise.resolve([]),
  ]);
  const href = (status: string, p = 1) =>
    `/salvage?status=${status}${query.batch ? `&batch=${encodeURIComponent(query.batch)}` : ""}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <>
      <PageHeader
        title="Salvage"
        description="Rejected leather sections are kept, not thrown away, so they can be cut for another batch."
      />
      {!canManage && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="size-4" />
          You can view salvage. The Floor Manager decides where it is reused or discarded.
        </p>
      )}

      <nav aria-label="Salvage status" className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={href(t.status)}
            aria-current={query.status === t.status ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              query.status === t.status
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} <span className="tabular-nums">({counts[t.status]})</span>
          </Link>
        ))}
        {query.batch && (
          <span className="ml-auto self-center text-sm text-muted-foreground">
            Batch “{query.batch}” ·{" "}
            <Link href={`/salvage?status=${query.status}`} className="underline underline-offset-4">
              clear
            </Link>
          </span>
        )}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
          {query.status === "AVAILABLE"
            ? "No salvage waiting. Sections the camera rejects are kept here."
            : query.status === "ASSIGNED"
              ? "No salvage has been reused yet."
              : "Nothing has been discarded."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Section</TableHead>
                <TableHead>Defect</TableHead>
                <TableHead>Rejected</TableHead>
                {query.status === "ASSIGNED" && <TableHead>Used in</TableHead>}
                {query.status !== "AVAILABLE" && <TableHead>Note</TableHead>}
                {canManage && (
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const label = `${r.originBatch.code} · #${r.scan.sequence}`;
                return (
                  <TableRow key={r.id} aria-label={label}>
                    <TableCell>
                      <Link
                        href={`/scans/${r.scan.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        <span className="font-mono">{r.originBatch.code}</span> · #{r.scan.sequence}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.defect
                        ? `${r.defect.label} ${Math.round(r.defect.confidence * 100)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatManilaDateTime(r.createdAt)}
                    </TableCell>
                    {query.status === "ASSIGNED" && (
                      <TableCell>
                        {r.assignedBatch && (
                          <Link
                            href={`/batches/${r.assignedBatch.id}`}
                            className="font-mono underline-offset-4 hover:underline"
                          >
                            {r.assignedBatch.code}
                          </Link>
                        )}
                      </TableCell>
                    )}
                    {query.status !== "AVAILABLE" && (
                      <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                        {r.notes ?? "—"}
                        {r.handledBy && (
                          <span className="block text-xs">by {r.handledBy.name}</span>
                        )}
                      </TableCell>
                    )}
                    {canManage && (
                      <TableCell className="text-right">
                        <SalvageActions
                          id={r.id}
                          label={label}
                          status={r.status}
                          originBatchId={r.originBatchId}
                          assignedBatchId={r.assignedBatch?.id ?? null}
                          batches={batches}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePager
            page={page}
            pageCount={pageCount}
            total={total}
            noun={["section", "sections"]}
            href={(p) => href(query.status, p)}
          />
        </div>
      )}
    </>
  );
}
