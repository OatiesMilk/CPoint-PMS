/*
 * Intent brief (ui-craft §1)
 * Who:   Quality Inspector / Floor Manager verifying one leather section.
 * What:  see what the camera saw, where, how sure it was, and confirm or change the decision.
 * Worst: overriding the wrong scan or without a record. Overrides need a reason and show who did it.
 *         A scan the camera flagged is decided by a Quality Inspector only (D-028).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { VerdictFlow } from "@/components/features/scans/verdict-flow";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { actionGroups, readSnapshot } from "@/lib/decision-engine";
import { formatManilaDateTime, formatPercent } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can, requiredDecisionPermission } from "@/server/policies/permissions";
import { getScanDetail } from "@/server/services/scan-query.service";
import { isScanId } from "@/server/validators/scan.validator";
import { DecisionPanel } from "./decision-panel";
import { ScanViewer } from "./scan-viewer";

export const metadata: Metadata = { title: "Scan" };

const SOURCE: Record<string, string> = {
  SIMULATOR: "Simulator",
  PHONE: "Phone",
  WEBCAM: "Webcam",
  DEDICATED_CAMERA: "Dedicated camera",
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Waiting to be cleaned or cut around",
  IN_PROGRESS: "Being handled",
  DONE: "Done, usable",
  CANCELLED: "Cancelled (decision changed)",
  AVAILABLE: "Kept as salvage",
  ASSIGNED: "Reused in another batch",
  DISCARDED: "Discarded",
};

export default async function ScanDetailPage({ params }: PageProps<"/scans/[id]">) {
  const user = await requirePermission("scan:read");
  const { id } = await params;
  if (!isScanId(id)) notFound();
  const scan = await getScanDetail(id);
  if (!scan) notFound();

  const thresholds = readSnapshot(scan.thresholdsSnapshot);
  const groups = actionGroups(thresholds.actions);
  const hasActions = groups.reject.length + groups.rework.length > 0;
  const label = `${scan.batch.code} · section #${scan.sequence}`;
  const batchOpen = scan.batch.status === "IN_PROGRESS" || scan.batch.status === "PLANNED";
  const flagged = scan.aiVerdict === "NEEDS_REVIEW";
  const allowed = can(user.role, requiredDecisionPermission(scan));
  const canDecide = allowed && batchOpen;
  const unknown = [
    ...new Set(scan.detections.filter((d) => d.isUnknownClass).map((d) => d.rawClassKey)),
  ];
  const outcomes = [
    ...scan.reworkTickets.map((t) => ({
      id: t.id,
      kind: "Repair Station",
      status: t.status,
      at: t.openedAt,
      href: `/rework?batch=${scan.batch.code}`,
    })),
    ...scan.salvageItems.map((s) => ({
      id: s.id,
      kind: "Salvage item",
      status: s.status,
      at: s.createdAt,
      href: `/salvage?status=${s.status}&batch=${scan.batch.code}`,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <div>
        <Link
          href="/scans"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All scans
        </Link>
      </div>
      <PageHeader
        title={`Section #${scan.sequence}`}
        description={`Batch ${scan.batch.code} · ${scan.batch.shoeType.name} · captured ${formatManilaDateTime(scan.capturedAt)}`}
        actions={
          <VerdictFlow
            aiVerdict={scan.aiVerdict}
            finalVerdict={scan.finalVerdict}
            isOverride={scan.isOverride}
          />
        }
      />

      {unknown.length > 0 && (
        <Alert tone="info">
          <strong className="font-semibold">
            Unknown defect class{unknown.length > 1 ? "es" : ""}:{" "}
            {unknown.map((k) => `“${k}”`).join(", ")}.
          </strong>
          <span>
            The model reported a class the system doesn’t know yet, so a person must decide. Add it
            under Admin → Settings (Phase 6) once the model is retrained.
          </span>
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ScanViewer
            src={`/api/v1/scans/${scan.id}/image`}
            alt={`Leather section #${scan.sequence} of batch ${scan.batch.code}`}
            thresholds={thresholds}
            detections={scan.detections.map((d) => ({
              id: d.id,
              label: d.defectType?.label ?? d.rawClassKey,
              confidence: d.confidence,
              unknown: d.isUnknownClass,
              action: thresholds.actions?.[d.rawClassKey] ?? null,
              inactive: d.defectType ? !d.defectType.isActive : false,
              box: { x: d.x, y: d.y, width: d.width, height: d.height },
            }))}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Camera said</dt>
                <dd>
                  <VerdictFlow aiVerdict={scan.aiVerdict} finalVerdict={null} isOverride={false} />
                </dd>
                <dt className="text-muted-foreground">Highest confidence</dt>
                <dd className="tabular-nums">{formatPercent(scan.maxConfidence)}</dd>
                <dt className="text-muted-foreground">Rules used</dt>
                <dd className="flex flex-col gap-1 tabular-nums">
                  {hasActions && (
                    <>
                      {groups.reject.length > 0 && (
                        <span>Reject when found: {groups.reject.join(", ")}</span>
                      )}
                      {groups.rework.length > 0 && (
                        <span>Fixable when found: {groups.rework.join(", ")}</span>
                      )}
                      <span className="text-muted-foreground">
                        Found at {formatPercent(thresholds.foundAtOrAbove ?? 0.5)} or more
                      </span>
                    </>
                  )}
                  <span className={hasActions ? "text-muted-foreground" : undefined}>
                    {hasActions ? "Other types: " : ""}Reject ≥{" "}
                    {formatPercent(thresholds.rejectAtOrAbove)}, Fixable ≥{" "}
                    {formatPercent(thresholds.reworkAtOrAbove)}
                  </span>
                </dd>
                <dt className="text-muted-foreground">Decided</dt>
                <dd>
                  {scan.status === "PENDING_REVIEW"
                    ? "Waiting for a person"
                    : scan.decidedBy
                      ? `${scan.decidedBy.name}, ${formatManilaDateTime(scan.decidedAt!)}`
                      : "Automatically by the camera"}
                </dd>
                {scan.overrideReason && (
                  <>
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd>{scan.overrideReason}</dd>
                  </>
                )}
              </dl>
              {canDecide ? (
                <DecisionPanel scanId={scan.id} label={label} finalVerdict={scan.finalVerdict} />
              ) : !batchOpen ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Batch {scan.batch.code} is closed, so this decision is final.
                </p>
              ) : (
                flagged &&
                !allowed && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {scan.status === "PENDING_REVIEW"
                      ? "Waiting for a Quality Inspector. The camera flagged a defect it doesn’t know, so a Quality Inspector decides."
                      : "The camera flagged this scan, so only a Quality Inspector can change its decision."}
                  </p>
                )
              )}
            </CardContent>
          </Card>

          {outcomes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>What happened to the section</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {outcomes.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      {o.status === "CANCELLED" ? (
                        <span>{o.kind}</span>
                      ) : (
                        <Link href={o.href} className="underline-offset-4 hover:underline">
                          {o.kind}
                        </Link>
                      )}
                      <Badge tone={o.status === "CANCELLED" ? "neutral" : "info"}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Capture</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Source</dt>
                <dd>{SOURCE[scan.source] ?? scan.source}</dd>
                <dt className="text-muted-foreground">Device</dt>
                <dd>{scan.deviceToken?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Model</dt>
                <dd>{scan.modelVersion ?? "—"}</dd>
                <dt className="text-muted-foreground">Batch</dt>
                <dd>
                  <Link
                    href={`/batches/${scan.batch.id}`}
                    className="font-mono underline underline-offset-4"
                  >
                    {scan.batch.code}
                  </Link>
                </dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
