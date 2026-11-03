/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, from a roll in Reports → Rolls, verifying one leather section.
 * What:  see what the camera saw, where, how sure it was, and why it is Pass or Reject.
 * Worst: a verdict that can't be explained. "Rules used" shows the rule in force when it was
 *         decided. The camera's verdict is final: nobody changes it (C-21, D-093).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { VerdictBadge } from "@/components/features/verdict-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { outcomeGroups, readSnapshot } from "@/lib/decision-engine";
import { formatManilaDateTime, formatPercent } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { getScanDetail } from "@/server/services/scan-query.service";
import { isScanId } from "@/server/validators/scan.validator";
import { ScanViewer } from "./scan-viewer";

export const metadata: Metadata = { title: "Scan" };

const SOURCE: Record<string, string> = {
  SIMULATOR: "Simulator",
  PHONE: "Phone",
  WEBCAM: "Webcam",
  DEDICATED_CAMERA: "Dedicated camera",
};

export default async function ScanDetailPage({ params }: PageProps<"/scans/[id]">) {
  // The Floor Manager reaches a section from its roll (A-26, D-100); there is no Scans list.
  await requirePermission("scan:read");
  const { id } = await params;
  if (!isScanId(id)) notFound();
  const scan = await getScanDetail(id);
  if (!scan) notFound();

  const rule = readSnapshot(scan.thresholdsSnapshot);
  const groups = outcomeGroups(rule.outcomes);

  return (
    <>
      <div>
        <Link
          href={`/reports/rolls/${scan.roll.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Roll {scan.roll.code}
        </Link>
      </div>
      <PageHeader
        title={`Section #${scan.sequence}`}
        description={`Roll ${scan.roll.code} · captured ${formatManilaDateTime(scan.capturedAt)}`}
        actions={<VerdictBadge verdict={scan.finalVerdict} />}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ScanViewer
            src={`/api/v1/scans/${scan.id}/image`}
            alt={`Leather section #${scan.sequence} of roll ${scan.roll.code}`}
            rule={rule}
            detections={scan.detections.map((d) => ({
              id: d.id,
              label: d.defectType?.label ?? d.rawClassKey,
              confidence: d.confidence,
              outcome: rule.outcomes[d.rawClassKey] ?? null,
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
                <dt className="text-muted-foreground">Verdict</dt>
                <dd>
                  <VerdictBadge verdict={scan.finalVerdict} />
                </dd>
                <dt className="text-muted-foreground">Highest confidence</dt>
                <dd className="tabular-nums">{formatPercent(scan.maxConfidence)}</dd>
                <dt className="text-muted-foreground">Rules used</dt>
                <dd className="flex flex-col gap-1" data-testid="rules-used">
                  {rule.earlierRule ? (
                    <span>
                      Decided by the earlier rule (before 24 Oct 2026). Its Fixable and Needs review
                      verdicts now read Pass and Reject.
                    </span>
                  ) : (
                    <>
                      <span>
                        Not accepted:{" "}
                        {groups.notAccepted.length ? groups.notAccepted.join(", ") : "none"}
                      </span>
                      <span>
                        Usable: {groups.usable.length ? groups.usable.join(", ") : "none"}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    Found at {formatPercent(rule.foundAtOrAbove)} or more
                  </span>
                </dd>
              </dl>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                The camera’s verdict is final.
                {scan.finalVerdict === "REJECT"
                  ? " A rejected section is reported for salvage."
                  : ""}
              </p>
            </CardContent>
          </Card>

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
                <dt className="text-muted-foreground">Roll</dt>
                <dd>
                  <Link
                    href={`/reports/rolls/${scan.roll.id}`}
                    className="font-mono underline underline-offset-4"
                  >
                    {scan.roll.code}
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
