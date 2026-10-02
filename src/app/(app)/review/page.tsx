/*
 * Intent brief (ui-craft §1)
 * Who:   Quality Inspector or Floor Manager, whoever is free (client survey), many times a shift.
 * What:  settle the scans the camera couldn't decide, then spot-check today's automatic calls.
 * Worst: a flagged section waits while the roll is cut. Oldest first, one click per decision.
 */
import type { Metadata } from "next";
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
import { reviewQueue } from "@/server/services/scan-query.service";
import { ReviewRowActions } from "./review-row-actions";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  await requirePermission("scan:decide");
  await connection();
  const { pending, todayAuto } = await reviewQueue();

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Scans the camera couldn’t decide, and today’s Rework and Reject calls."
      />

      <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
        <h2 id="pending-heading" className="text-xl font-semibold">
          Needs a decision{" "}
          <span className="text-muted-foreground tabular-nums">({pending.total})</span>
        </h2>
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
                <TableHead className="text-right">Decide</TableHead>
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
                    <ReviewRowActions scanId={s.id} label={`${s.batchCode} · #${s.sequence}`} />
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
