/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager moving a roll through the line; QI and Admin checking where it is.
 * What:  see where this batch is and how long each stage took; move it on with one click.
 * Worst: moving the wrong batch or skipping a stage. One primary action, no skipping,
 *        moving back needs a reason, cancel and complete are confirmed.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, CornerUpLeft } from "lucide-react";
import { BatchStatusBadge } from "@/components/features/batches/batch-status-badge";
import { StageProgress } from "@/components/features/batches/stage-progress";
import { ComingSoonCard } from "@/components/features/coming-soon-card";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STAGE_LABELS } from "@/lib/domain";
import { formatCalendarDate, formatDuration, formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getBatchDetail } from "@/server/services/batch.service";
import { isBatchId } from "@/server/validators/batch.validator";
import { BatchActionsBar } from "./batch-actions";

export const metadata: Metadata = { title: "Batch" };

export default async function BatchDetailPage({ params }: PageProps<"/batches/[id]">) {
  const user = await requirePermission("batch:read");
  await connection();
  const { id } = await params;
  if (!isBatchId(id)) notFound();
  const detail = await getBatchDetail(id);
  if (!detail) notFound();
  const { batch, actions, durations, now } = detail;
  const canManage = can(user.role, "batch:manage");

  return (
    <>
      <div>
        <Link
          href="/batches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All batches
        </Link>
      </div>

      <header className="flex flex-col gap-5 border-b pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-3xl font-semibold tracking-tight">{batch.code}</h1>
              <BatchStatusBadge status={batch.status} />
            </div>
            <p className="mt-1 text-lg text-muted-foreground">
              {batch.shoeType.name} · roll <span className="font-mono">{batch.rollCode}</span>
            </p>
          </div>
        </div>
        {canManage && (
          <BatchActionsBar
            id={batch.id}
            code={batch.code}
            currentStage={batch.currentStage}
            actions={actions}
          />
        )}
        {batch.status === "CANCELLED" && batch.cancelledReason && (
          <Alert tone="info">Cancelled: {batch.cancelledReason}</Alert>
        )}
      </header>

      <section aria-labelledby="progress-heading" className="flex flex-col gap-4">
        <h2 id="progress-heading" className="text-xl font-semibold">
          Progress
        </h2>
        {batch.status === "PLANNED" ? (
          <p className="text-muted-foreground">
            Production hasn’t started.{" "}
            {canManage ? "Start it when the roll goes to the cutting table." : ""}
          </p>
        ) : null}
        <StageProgress
          status={batch.status}
          currentStage={batch.currentStage}
          durations={durations}
        />
      </section>

      <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
        <h2 id="timeline-heading" className="text-xl font-semibold">
          Stage timeline
        </h2>
        {batch.stageLogs.length === 0 ? (
          <p className="rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground">
            Nothing yet. Each stage this batch passes through will be listed here with its times.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Stage</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead numeric>Duration</TableHead>
                <TableHead>Moved by</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.stageLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{STAGE_LABELS[log.stage]}</TableCell>
                  <TableCell>{formatManilaDateTime(log.startedAt)}</TableCell>
                  <TableCell>
                    {log.endedAt ? (
                      formatManilaDateTime(log.endedAt)
                    ) : (
                      <span className="text-muted-foreground">In progress</span>
                    )}
                  </TableCell>
                  <TableCell numeric>
                    {formatDuration(
                      (log.endedAt ?? new Date(now)).getTime() - log.startedAt.getTime(),
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.startedBy.name}</TableCell>
                  <TableCell className="max-w-80 whitespace-normal">
                    {log.isRollback ? (
                      <span className="inline-flex items-start gap-1.5 text-rework">
                        <CornerUpLeft aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <span>
                          Moved back: <span className="text-foreground">{log.reason}</span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                [
                  "Roll code",
                  <span key="r" className="font-mono">
                    {batch.rollCode}
                  </span>,
                ],
                ["Supplier", batch.supplier?.name ?? "Not recorded"],
                ["Date received", formatCalendarDate(batch.receivedAt)],
                [
                  "Target quota",
                  batch.targetQuotaPairs
                    ? `${batch.targetQuotaPairs.toLocaleString("en-PH")} pairs`
                    : "Not set",
                ],
                [
                  "Registered",
                  `${formatManilaDateTime(batch.createdAt)} by ${batch.createdBy.name}`,
                ],
                ["Notes", batch.notes ?? "—"],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-line">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <ComingSoonCard
          phase={3}
          title="Scans & counts"
          description="Camera results for this roll at Preparation: passed, in rework, rejected and usable sections."
        />
      </div>
    </>
  );
}
