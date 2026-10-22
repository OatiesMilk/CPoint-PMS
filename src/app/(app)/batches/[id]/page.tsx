/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager starting and finishing leather rolls; the QI finishing one at the
 *        camera; the Admin checking.
 * What:  see what this roll gave at Preparation and finish it when it is used up (D-082).
 * Worst: finishing the wrong roll, so the camera feeds the next one too early. Finish is
 *        confirmed with the scan count; cancel needs a reason.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, CornerUpLeft } from "lucide-react";
import { BatchStatusBadge } from "@/components/features/batches/batch-status-badge";
import { InRepairBadge } from "@/components/features/batches/in-repair-badge";
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
import { finishHint, startedBeforeRolls } from "@/lib/stage-machine";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getBatchDetail } from "@/server/services/batch.service";
import { batchYield } from "@/server/services/scan-query.service";
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
  const { batch, actions, openRepairs, rollFromInventory, now } = detail;
  const y = await batchYield(batch.id);
  const canManage = can(user.role, "batch:manage");
  const canFinish = can(user.role, "batch:finish");
  const hint = batch.status === "IN_PROGRESS" ? finishHint(y.scanned) : null;
  const legacy = startedBeforeRolls(batch);

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
              <BatchStatusBadge status={batch.status} currentStage={batch.currentStage} />
              <InRepairBadge count={openRepairs} />
            </div>
            <p className="mt-1 text-lg text-muted-foreground">
              {batch.shoeType.name} · roll <span className="font-mono">{batch.rollCode}</span>
            </p>
          </div>
        </div>
        {hint && (
          <Alert tone="info" data-testid="finish-hint">
            {hint}
            {!canFinish && " Ask the Floor Manager or the Quality Inspector to finish it."}
          </Alert>
        )}
        {legacy && (
          <Alert tone="info">
            This batch started before rolls were tracked and is still at{" "}
            {STAGE_LABELS[batch.currentStage]}. Finish it when its shoes are done; production is now
            counted at the check-ins.
          </Alert>
        )}
        <BatchActionsBar
          id={batch.id}
          code={batch.code}
          currentStage={batch.currentStage}
          actions={actions}
          openRepairs={openRepairs}
          scanned={y.scanned}
          pendingReview={y.pendingReview}
          canManage={canManage}
          canFinish={canFinish}
        />
        {batch.status === "CANCELLED" && batch.cancelledReason && (
          <Alert tone="info">Cancelled: {batch.cancelledReason}</Alert>
        )}
      </header>

      {batch.status === "PLANNED" && (
        <p className="text-muted-foreground">
          This roll hasn’t started. {canManage ? "Start it when it goes to the cutting table." : ""}
        </p>
      )}

      <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
        <h2 id="timeline-heading" className="text-xl font-semibold">
          History
        </h2>
        {batch.stageLogs.length === 0 ? (
          <p className="rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground">
            Nothing yet. When the roll starts, its time at Preparation is listed here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Stage</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead numeric>Duration</TableHead>
                <TableHead>Started by</TableHead>
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
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
                [
                  "Roll from inventory",
                  rollFromInventory ? (
                    <span key="inv">
                      {can(user.role, "inventory:read") ? (
                        <Link
                          href={`/inventory/${rollFromInventory.itemId}`}
                          className="underline underline-offset-4"
                        >
                          {rollFromInventory.label}
                        </Link>
                      ) : (
                        rollFromInventory.label
                      )}
                      {rollFromInventory.returned && (
                        <span className="text-muted-foreground"> · returned to stock</span>
                      )}
                    </span>
                  ) : (
                    "Not recorded"
                  ),
                ],
                ["Date received", formatCalendarDate(batch.receivedAt)],
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
        <Card>
          <CardHeader>
            <CardTitle>Yield</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {y.scanned === 0 ? (
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-muted-foreground">
                  No sections of this roll have been scanned yet.
                </p>
                {y.salvageReceived > 0 && (
                  <p>
                    Salvage reused here:{" "}
                    <Link
                      href={`/salvage?status=ASSIGNED&batch=${batch.code}`}
                      data-testid="yield-salvage-in"
                      className="font-semibold tabular-nums underline-offset-4 hover:underline"
                    >
                      {y.salvageReceived}
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Usable sections</p>
                  <p className="text-3xl font-semibold tabular-nums" data-testid="yield-usable">
                    {y.usable}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {y.passed} passed + {y.reworkDone} repaired, of {y.scanned} scanned
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    [
                      "Being cleaned or cut around",
                      y.reworkOpen + y.reworkInProgress,
                      `/rework?batch=${batch.code}`,
                      "yield-repair",
                    ],
                    [
                      "Rejected (salvage)",
                      y.rejected,
                      `/salvage?batch=${batch.code}`,
                      "yield-rejected",
                    ],
                    [
                      "Needs review",
                      y.pendingReview,
                      `/scans?batch=${batch.code}&status=PENDING_REVIEW`,
                      "yield-review",
                    ],
                    [
                      "Salvage reused here",
                      y.salvageReceived,
                      `/salvage?status=ASSIGNED&batch=${batch.code}`,
                      "yield-salvage-in",
                    ],
                  ].map(([label, value, href, id]) => (
                    <div key={label as string}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        <Link
                          href={href as string}
                          data-testid={id as string}
                          className="underline-offset-4 hover:underline"
                        >
                          {value}
                        </Link>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            {y.scanned > 0 && (
              <Link
                href={`/scans?batch=${batch.code}`}
                className="text-sm underline underline-offset-4"
              >
                All {y.scanned} scan{y.scanned === 1 ? "" : "s"} of this batch
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
