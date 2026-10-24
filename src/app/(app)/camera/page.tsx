/*
 * Intent brief (ui-craft §1)
 * Who:   Floor Manager / Quality Inspector setting up or checking the Preparation camera.
 * What:  know whether sections are being captured, which batch the scans go to, which model
 *        judged the last section, and where to capture from.
 * Worst: scans landing in the wrong roll's batch, or an early model's verdicts trusted blindly.
 *        The target batch is the biggest thing on the page; the early-model notice sits beside it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Aperture, Camera, CircleDot, Cpu, PauseCircle } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { modelName } from "@/lib/camera-rules";
import { readSnapshot } from "@/lib/decision-engine";
import { formatDuration, formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import {
  cameraStatus,
  listCameraOperators,
  type CameraStatus,
} from "@/server/services/camera.service";
import { getScanDetail } from "@/server/services/scan-query.service";
import { ScanImage } from "@/components/features/scans/scan-image";
import { ActiveBatchForm } from "./active-batch-form";
import { OperatorsPanel } from "./operators-panel";

export const metadata: Metadata = { title: "Camera" };

const STATE = {
  idle: { label: "No recent captures", tone: "neutral", Icon: PauseCircle },
  simulator: { label: "Simulator active", tone: "info", Icon: Cpu },
  capturing: { label: "Capture page active", tone: "success", Icon: CircleDot },
} as const;

const ago = (now: Date, at: Date) => formatDuration(now.getTime() - at.getTime());

/** One sentence on what the camera is doing right now, specific to each state. */
function stateText(status: CameraStatus, now: Date): string {
  const last = status.lastScan;
  switch (status.state) {
    case "capturing":
      return last?.device
        ? `Scans are arriving with the device token “${last.device}”. Last scan ${ago(now, last.at)} ago.`
        : `Sections are being captured on the Capture page. Last scan ${ago(now, last!.at)} ago.`;
    case "simulator":
      return `Scans are coming from the simulator, not a camera. Last scan ${ago(now, last!.at)} ago.`;
    case "idle":
      return last
        ? `Nothing captured in the last minute. The last scan came ${ago(now, last.at)} ago.`
        : "Nothing has been captured yet. Open the Capture page to check the first section.";
  }
}

export default async function CameraPage() {
  const user = await requirePermission("camera:view");
  await connection();
  const now = new Date();
  const status = await cameraStatus(now);
  const last = status.lastScan ? await getScanDetail(status.lastScan.id) : null;
  // A recent scan sent with a device token (not the simulator) didn't come from the Capture page.
  const state =
    status.state === "capturing" && status.lastScan?.device
      ? { ...STATE.capturing, label: "Scans arriving" }
      : STATE[status.state];
  const canManage = can(user.role, "camera:manage");
  const canCapture = can(user.role, "camera:capture");
  const operators = can(user.role, "camera:operators") ? await listCameraOperators() : null;
  const lastModel = modelName(status.lastScan?.modelVersion);
  const fromSimulator = status.lastScan?.source === "SIMULATOR";
  const snapshot = last ? readSnapshot(last.thresholdsSnapshot) : null;

  return (
    <>
      <PageHeader
        title="Camera"
        description="The camera at Preparation checks each leather section before cutting."
        actions={
          <>
            <Badge tone={state.tone}>
              <state.Icon aria-hidden />
              {state.label}
            </Badge>
            {canCapture && (
              <Button asChild variant="secondary">
                <Link href="/camera/capture">
                  <Aperture aria-hidden />
                  Capture from this browser
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-3 xl:col-span-2">
          {last?.imagePath && snapshot ? (
            <>
              <ScanImage
                src={`/api/v1/scans/${last.id}/image`}
                alt={`Last capture: section #${last.sequence} of ${last.batch.code}`}
                rule={snapshot}
                detections={last.detections.map((d) => ({
                  id: d.id,
                  label: d.defectType?.label ?? d.rawClassKey,
                  confidence: d.confidence,
                  unknown: d.isUnknownClass,
                  outcome: snapshot.outcomes[d.rawClassKey] ?? null,
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
                The last section captured on the Capture page shows here with every defect marked on
                it.
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
                <p className="rounded-md bg-caution-soft p-3 text-sm">
                  No batch is at Preparation, so Capture stays off.{" "}
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
                  Early model{lastModel ? ` (${lastModel})` : ""}. It is still being trained, so
                  some verdicts may be wrong.
                </Alert>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ways to capture</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">From the Capture page</p>
                <p>
                  Open{" "}
                  {canCapture ? (
                    <Link href="/camera/capture" className="underline underline-offset-4">
                      Capture
                    </Link>
                  ) : (
                    <strong>Capture</strong>
                  )}{" "}
                  on the PC at Preparation, with the fixed camera. Use <strong>Floor view</strong>{" "}
                  there for a monitor facing the operator. On another computer, open the site
                  through its https:// link (the Cloudflare Tunnel; see the README).
                </p>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">No camera yet?</p>
                <p>
                  Run <code className="font-mono">npm run cv:simulate</code> to send realistic test
                  scans with a device token (see the README).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {operators && <OperatorsPanel people={operators} />}
    </>
  );
}
