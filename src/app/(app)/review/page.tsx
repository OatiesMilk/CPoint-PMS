/*
 * Intent brief (ui-craft §1)
 * Who:   Quality Inspector, many times a shift; the Floor Manager watches it (D-028).
 * What:  settle the scans the camera couldn't decide (QI only), then spot-check today's
 *        automatic calls (QI or FM, by override).
 * Worst: a flagged section waits while the roll is cut. Oldest first, one click per decision.
 */
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { connection } from "next/server";
import { CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { VerdictFlow } from "@/components/features/scans/verdict-flow";
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
import { can } from "@/server/policies/permissions";
import { reviewQueue } from "@/server/services/scan-query.service";
import { ReviewRowActions } from "./review-row-actions";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const user = await requirePermission("scan:decide");
  // Flagged scans are the Quality Inspector's to decide (D-028); the Floor Manager sees them only.
  const canReview = can(user.role, "scan:review");
  await connection();
  const raw = (await searchParams).batch;
  const batch =
    typeof raw === "string" && /^[A-Za-z0-9-]{1,30}$/.test(raw.trim()) ? raw.trim() : undefined;
  const { pending, todayAuto } = await reviewQueue(new Date(), batch);

  return (
    <>
      <PageHeader
        title="Review queue"
        description={
          canReview
            ? "Scans the camera couldn’t decide, and today’s Rework and Reject calls."
            : "Scans the camera couldn’t decide wait here for a Quality Inspector. Today’s Rework and Reject calls are below."
        }
      />

      <form method="get" className="flex items-end gap-2" aria-label="Filter the review queue">
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="review-batch">Batch</Label>
          <Input
            id="review-batch"
            name="batch"
            placeholder="e.g. B-2026-0012"
            defaultValue={batch}
          />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {batch && (
          <Button asChild variant="ghost">
            <Link href="/review">Clear</Link>
          </Button>
        )}
      </form>

      <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
        <h2 id="pending-heading" className="text-xl font-semibold">
          Needs a decision{" "}
          <span className="text-muted-foreground tabular-nums">({pending.total})</span>
        </h2>
        {pending.total > pending.rows.length && (
          <p className="text-sm text-muted-foreground" role="note">
            Showing the {pending.rows.length} oldest of {pending.total}. Decide these first, or
            filter by batch to find a specific section.
          </p>
        )}
        {pending.total === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed px-5 py-8 text-muted-foreground">
            <CircleCheck aria-hidden className="size-5 text-pass" />
            Nothing waiting for review. Scans with a defect class the system doesn’t know will
            appear here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Waiting since</TableHead>
                <TableHead>Batch · section</TableHead>
                <TableHead>Camera saw</TableHead>
                <TableHead numeric>Confidence</TableHead>
                <TableHead className="text-right">{canReview ? "Decide" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatManilaDateTime(s.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/scans/${s.id}`} className="underline-offset-4 hover:underline">
                      <span className="font-mono">{s.batchCode}</span> · #{s.sequence}
                    </Link>
                  </TableCell>
                  <TableCell className="text-review">
                    {s.topDefect ? `${s.topDefect.label} (unknown class)` : "—"}
                  </TableCell>
                  <TableCell numeric>{formatPercent(s.topDefect?.confidence)}</TableCell>
                  <TableCell className="text-right">
                    {canReview ? (
                      <ReviewRowActions scanId={s.id} label={`${s.batchCode} · #${s.sequence}`} />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Waiting for a Quality Inspector
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="auto-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="auto-heading" className="text-xl font-semibold">
            Today’s automatic Rework and Reject{" "}
            <span className="text-muted-foreground tabular-nums">({todayAuto.total})</span>
          </h2>
          <p className="text-muted-foreground">
            Open one to check the image and override it if the camera was wrong.
          </p>
        </div>
        {todayAuto.total === 0 ? (
          <p className="rounded-lg border border-dashed px-5 py-8 text-muted-foreground">
            No Rework or Reject calls today yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Captured</TableHead>
                <TableHead>Batch · section</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Top defect</TableHead>
                <TableHead numeric>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayAuto.rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/scans/${s.id}`} className="underline-offset-4 hover:underline">
                      {formatManilaDateTime(s.createdAt)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{s.batchCode}</span> · #{s.sequence}
                  </TableCell>
                  <TableCell>
                    <VerdictFlow
                      aiVerdict={s.aiVerdict}
                      finalVerdict={s.finalVerdict}
                      isOverride={s.isOverride}
                    />
                  </TableCell>
                  <TableCell>{s.topDefect?.label ?? "—"}</TableCell>
                  <TableCell numeric>{formatPercent(s.topDefect?.confidence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
