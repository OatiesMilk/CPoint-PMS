/*
 * Intent brief (ui-craft §1)
 * Who:   the Quality Inspector, the Floor Manager, or a Shoe Constructor allowed to capture
 *        (D-075), at the fixed camera at Preparation, capturing one leather section after another.
 * What:  point the camera at the section, press Capture, see the app's verdict for that section.
 * Worst: a section saved to the wrong roll's batch, a capture saved twice, or a verdict trusted
 *        when the model never ran. The batch line sits above the camera; one press makes one scan;
 *        Capture is off whenever the model or a batch is missing, and says why.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/features/page-header";
import { requireCapture } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { cameraStatus } from "@/server/services/camera.service";
import { batchSummary, captureModelStatus } from "@/server/services/capture.service";
import { CaptureClient } from "./capture-client";

export const metadata: Metadata = { title: "Capture" };

export default async function CapturePage() {
  const user = await requireCapture();
  await connection();
  const [status, model] = await Promise.all([cameraStatus(), captureModelStatus()]);

  return (
    <>
      <PageHeader
        title="Capture"
        description="Point the camera at one leather section and press Capture. The app checks it and gives the verdict."
      />
      <CaptureClient
        initialBatch={batchSummary(status.current)}
        model={model}
        earlyModelNotice={status.earlyModelNotice}
        canSeeScans={can(user.role, "scan:read")}
        canFinish={can(user.role, "batch:finish")}
      />
    </>
  );
}
