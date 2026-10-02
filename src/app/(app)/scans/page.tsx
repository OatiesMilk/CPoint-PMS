/*
 * Intent brief (ui-craft §1)
 * Who:   Quality Inspector and Floor Manager (Admin reads), checking the camera's work.
 * What:  find scans by batch or outcome and open one to verify it.
 * Worst: missing that the camera is wrong. Overrides are marked and filterable.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { VerdictFlow } from "@/components/features/scans/verdict-flow";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManilaDateTime, formatPercent } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { listScans } from "@/server/services/scan-query.service";
import { scanListQuerySchema } from "@/server/validators/scan.validator";
import { ScanFilters } from "./scan-filters";

export const metadata: Metadata = { title: "Scans" };

const SOURCE_LABELS: Record<string, string> = {
  SIMULATOR: "Simulator",
  PHONE: "Phone",
  WEBCAM: "Webcam",
  DEDICATED_CAMERA: "Camera",
};

export default async function ScansPage({ searchParams }: PageProps<"/scans">) {
  await requirePermission("scan:read");
  await connection();
  const query = scanListQuerySchema.parse(await searchParams);
  const filtered = Boolean(
    query.verdict || query.status || query.source || query.batch || query.override,
  );
  const { rows, total, page, pageCount } = await listScans(query);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query))
      if (v && k !== "page" && k !== "limit") next.set(k, String(v));
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/scans?${qs}` : "/scans";
  };

  return (
    <>
      <PageHeader
        title="Scans"
        description="Every leather section the Preparation camera checked."
      />
      {(total > 0 || filtered) && <ScanFilters />}

      {total === 0 && !filtered ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No scans yet</h2>
          <p className="max-w-md text-muted-foreground">
            Scans appear here when the camera, or the simulator, sends them. See the Camera page to
            connect one.
          </p>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/camera">Open the Camera page</Link>
          </Button>
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No scans match these filters</h2>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/scans">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Captured</TableHead>
                <TableHead>Batch · section</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Top defect</TableHead>
                <TableHead numeric>Confidence</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/scans/${s.id}`} className="underline-offset-4 hover:underline">
                      {formatManilaDateTime(s.createdAt)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{s.batchCode}</span>
                    <span className="text-muted-foreground"> · #{s.sequence}</span>
                  </TableCell>
                  <TableCell>
                    <VerdictFlow
                      aiVerdict={s.aiVerdict}
                      finalVerdict={s.finalVerdict}
                      isOverride={s.isOverride}
                    />
                  </TableCell>
                  <TableCell>
                    {s.topDefect ? (
                      <span className={s.topDefect.unknown ? "text-review" : undefined}>
                        {s.topDefect.label}
                        {s.topDefect.unknown && " (unknown class)"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">None found</span>
                    )}
                  </TableCell>
                  <TableCell numeric>{formatPercent(s.topDefect?.confidence)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {SOURCE_LABELS[s.source] ?? s.source}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between text-sm text-muted-foreground"
          >
            <span>
              {total.toLocaleString("en-PH")} scan{total === 1 ? "" : "s"} · page {page} of{" "}
              {pageCount}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft aria-hidden />
                    Previous
                  </Link>
                </Button>
              )}
              {page < pageCount && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page + 1)}>
                    Next
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
