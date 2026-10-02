/*
 * Intent brief (ui-craft §1)
 * Who:   Floor Manager / Quality Inspector setting up or checking the Preparation camera.
 * What:  know whether the camera is sending, which batch its scans go to, and how to connect one.
 * Worst: scans landing in the wrong roll's batch. The target batch is the biggest thing on the page.
 * Placeholder (D-008): live phone/webcam capture comes later; the simulator stands in.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Camera, CircleDot, Cpu, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { cameraStatus } from "@/server/services/camera.service";
import { getScanDetail } from "@/server/services/scan-query.service";
import { ScanImage } from "@/components/features/scans/scan-image";
import { ActiveBatchForm } from "./active-batch-form";

export const metadata: Metadata = { title: "Camera" };

const STATE = {
  not_connected: {
    label: "Not connected",
    tone: "neutral",
    Icon: PlugZap,
    text: "No scans in the last minute.",
  },
  simulator: {
    label: "Simulator active",
    tone: "info",
    Icon: Cpu,
    text: "Scans are coming from the simulator.",
  },
  camera: {
    label: "Camera active",
    tone: "success",
    Icon: CircleDot,
    text: "Scans are coming from a camera.",
  },
} as const;

export default async function CameraPage() {
  const user = await requirePermission("camera:view");
  await connection();
  const now = new Date();
  const status = await cameraStatus(now);
  const last = status.lastScan ? await getScanDetail(status.lastScan.id) : null;
  const state = STATE[status.state];
  const canManage = can(user.role, "camera:manage");

  return (
    <>
      <PageHeader
        title="Camera"
        description="The Preparation camera checks each leather section before cutting."
        actions={
          <Badge tone={state.tone}>
            <state.Icon aria-hidden />
            {state.label}
          </Badge>
        }
      />

      <div className="grid grid-cols-3 items-start gap-6">
        <div className="col-span-2 flex flex-col gap-3">
          {last?.imagePath ? (
            <>
              <ScanImage
                src={`/api/v1/scans/${last.id}/image`}
                alt={`Last capture: section #${last.sequence} of ${last.batch.code}`}
                thresholds={
                  last.thresholdsSnapshot as { rejectAtOrAbove: number; reworkAtOrAbove: number }
                }
                detections={last.detections.map((d) => ({
                  id: d.id,
                  label: d.defectType?.label ?? d.rawClassKey,
                  confidence: d.confidence,
                  unknown: d.isUnknownClass,
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
                Phone/webcam capture will be connected here. Until then, the simulator can send
                scans.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Scans go to</CardTitle>
              <CardDescription>
                {state.text}
                {status.lastScan &&
                  ` Last scan ${formatDuration(now.getTime() - status.lastScan.at.getTime())} ago${status.lastScan.device ? ` from “${status.lastScan.device}”` : ""}.`}
              </CardDescription>
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
                  No batch is at Preparation, so the camera’s scans will be refused.{" "}
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
              <CardTitle>Connect a camera</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                <li>
                  A System Admin creates a device token under <strong>API tokens</strong>.
                </li>
                <li>
                  The camera machine sends each capture to{" "}
                  <code className="font-mono">POST /api/v1/scans</code> with that token (see{" "}
                  <code className="font-mono">docs/API.md</code>).
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
