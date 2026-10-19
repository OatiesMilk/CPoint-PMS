/*
 * Intent brief (ui-craft §1)
 * Who:   Floor Manager / Quality Inspector setting up or checking the Preparation camera.
 * What:  know whether the camera station is connected, which batch its scans go to, which model
 *        judged the last section, and how to connect the station.
 * Worst: scans landing in the wrong roll's batch, or an early model's verdicts trusted blindly.
 *        The target batch is the biggest thing on the page; the early-model notice sits beside it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Camera, CircleDot, Cpu, PlugZap, Radio } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { modelName } from "@/lib/camera-rules";
import { readSnapshot } from "@/lib/decision-engine";
import { formatDuration, formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { cameraStatus, type CameraStatus } from "@/server/services/camera.service";
import { getScanDetail } from "@/server/services/scan-query.service";
import { ScanImage } from "@/components/features/scans/scan-image";
import { ActiveBatchForm } from "./active-batch-form";

export const metadata: Metadata = { title: "Camera" };

const STATE = {
  not_connected: { label: "Not connected", tone: "neutral", Icon: PlugZap },
  waiting: { label: "Station connected", tone: "success", Icon: Radio },
  simulator: { label: "Simulator active", tone: "info", Icon: Cpu },
  camera: { label: "Camera station active", tone: "success", Icon: CircleDot },
} as const;

const ago = (now: Date, at: Date) => formatDuration(now.getTime() - at.getTime());

/** One sentence on what the camera is doing right now, specific to each state. */
function stateText(status: CameraStatus, now: Date): string {
  const last = status.lastScan;
  const from = last?.device ? ` from “${last.device}”` : "";
  switch (status.state) {
    case "camera":
      return `The camera station is sending scans. Last scan ${ago(now, last!.at)} ago${from}.`;
    case "simulator":
      return `Scans are coming from the simulator, not a camera. Last scan ${ago(now, last!.at)} ago.`;
    case "waiting":
      return `“${status.station!.name}” is connected and waiting for the next section. It last checked in ${ago(now, status.station!.seenAt)} ago.`;
    case "not_connected":
      return last
        ? `No camera station has checked in for 2 minutes. The last scan came ${ago(now, last.at)} ago${from}.`
        : "No camera station has checked in yet. Connect it with the steps below.";
  }
}

export default async function CameraPage() {
  const user = await requirePermission("camera:view");
  await connection();
  const now = new Date();
  const status = await cameraStatus(now);
  const last = status.lastScan ? await getScanDetail(status.lastScan.id) : null;
  const state = STATE[status.state];
  const canManage = can(user.role, "camera:manage");
  const lastModel = modelName(status.lastScan?.modelVersion);
  const fromSimulator = status.lastScan?.source === "SIMULATOR";
  const snapshot = last ? readSnapshot(last.thresholdsSnapshot) : null;

  return (
    <>
      <PageHeader
        title="Camera"
        description="The Preparation camera station checks each leather section before cutting."
        actions={
          <Badge tone={state.tone}>
            <state.Icon aria-hidden />
            {state.label}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-3 xl:col-span-2">
          {last?.imagePath && snapshot ? (
            <>
              <ScanImage
                src={`/api/v1/scans/${last.id}/image`}
                alt={`Last capture: section #${last.sequence} of ${last.batch.code}`}
                thresholds={snapshot}
                detections={last.detections.map((d) => ({
                  id: d.id,
                  label: d.defectType?.label ?? d.rawClassKey,
                  confidence: d.confidence,
                  unknown: d.isUnknownClass,
                  action: snapshot.actions?.[d.rawClassKey] ?? null,
                  box: { x: d.x, y: d.y, width: d.width, height: d.height },
                }))}
              />
              <p className="text-sm text-muted-foreground">
                Last capture: {last.batch.code} · section #{last.sequence},{" "}
                {formatManilaDateTime(last.createdAt)}.{" "}
                <Link href={`/scans/${last.id}`} className="underline underline-offset-4">
                  Open scan
                </Link>
              </p>
            </>
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/40 text-center">
              <Camera aria-hidden className="size-10 text-muted-foreground" />
              <p className="font-medium">No captures yet</p>
              <p className="max-w-sm text-muted-foreground">
                {status.state === "waiting"
                  ? "The station is connected. Press Space at the station to capture the first section."
                  : "The last section the camera captures shows here, with every defect it found marked on it."}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Scans go to</CardTitle>
              <CardDescription>{stateText(status, now)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {status.current ? (
                <div>
                  <Link
                    href={`/batches/${status.current.id}`}
                    className="font-mono text-2xl font-semibold underline-offset-4 hover:underline"
                  >
                    {status.current.code}
                  </Link>
                  <p className="text-muted-foreground">
                    {status.current.shoeType.name} · roll {status.current.rollCode}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status.current.selection === "selected"
                      ? "Chosen on this page."
                      : "Automatic: the batch that has been at Preparation the longest."}
                  </p>
                </div>
              ) : (
                <p className="rounded-md bg-rework-soft p-3 text-sm">
                  No batch is at Preparation, so the station waits and won’t capture.{" "}
                  <Link href="/batches?status=PLANNED" className="underline underline-offset-4">
                    Start a batch
                  </Link>{" "}
                  first.
                </p>
              )}
              {canManage && status.candidates.length > 0 && (
                <ActiveBatchForm
                  selectedId={
                    status.selectedBatchId &&
                    status.candidates.some((c) => c.id === status.selectedBatchId)
                      ? status.selectedBatchId
                      : null
                  }
                  options={status.candidates.map((c) => ({
                    id: c.id,
                    code: c.code,
                    rollCode: c.rollCode,
                    shoeType: c.shoeType.name,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Model</CardTitle>
              <CardDescription>
                {status.lastScan?.modelVersion
                  ? `The last section was judged by ${status.lastScan.modelVersion}${fromSimulator ? " (simulated detections)" : ""}.`
                  : "Shows which model judged the last section once a scan arrives."}
              </CardDescription>
            </CardHeader>
            {status.earlyModelNotice && !fromSimulator && (
              <CardContent>
                <Alert tone="info">
                  Early model{lastModel ? ` (${lastModel})` : ""}. Results are for testing; the
                  Quality Inspector checks every flagged section.
                </Alert>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connect the camera station</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                <li>
                  A System Admin creates a device token under <strong>API tokens</strong>.
                </li>
                <li>
                  On the station PC, put it in <code className="font-mono">cv/.env</code> as{" "}
                  <code className="font-mono">CV_DEVICE_TOKEN</code>.
                </li>
                <li>
                  Run <code className="font-mono">python -m cpoint_cv doctor</code> and fix anything
                  it reports.
                </li>
                <li>
                  Start it with <code className="font-mono">python -m cpoint_cv run webcam</code>{" "}
                  and press Space for each section (see{" "}
                  <code className="font-mono">cv/README.md</code>
                  ).
                </li>
                <li>
                  No camera yet? Run <code className="font-mono">npm run cv:simulate</code> to send
                  realistic test scans.
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
