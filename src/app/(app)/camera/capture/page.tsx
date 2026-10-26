/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor the System Admin allows (C-23), with their own phone on a stand at a
 *        fixed position (C-24), or at a PC with Floor view; capturing one roll shot by shot.
 * What:  pick a roll from Inventory (Phase 30A), choose it, capture it edge to edge, see Pass or Reject for each shot,
 *        finish it once all of it is in (Phase 26, D-095).
 * Worst: a shot sent to the wrong roll, a capture saved twice, or a verdict trusted when the model
 *        never ran. The chosen roll is repeated in large text; one press makes one scan; Capture is
 *        off whenever the model or a roll is missing, and says why.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/features/page-header";
import { requireRole } from "@/server/policies/guard";
import { canCaptureFor } from "@/server/policies/permissions";
import { cameraStatus } from "@/server/services/camera.service";
import { captureModelStatus } from "@/server/services/capture.service";
import { openRollsForCapture, readyRollsForCapture } from "@/server/services/roll.service";
import { CaptureClient } from "./capture-client";

export const metadata: Metadata = { title: "Capture" };

export default async function CapturePage() {
  // Only Shoe Constructors capture (C-18); the QI and the Floor Manager get the forbidden page.
  const user = await requireRole("SHOE_CONSTRUCTOR");
  await connection();

  if (!canCaptureFor(user)) {
    return (
      <>
        <PageHeader title="Capture" />
        <p className="text-lg" data-testid="no-camera-access">
          Ask the System Admin for camera access.
        </p>
      </>
    );
  }

  const [status, model, rolls, ready] = await Promise.all([
    cameraStatus(),
    captureModelStatus(),
    openRollsForCapture(user),
    readyRollsForCapture(),
  ]);

  return (
    <>
      <PageHeader
        title="Capture"
        description="Pick the roll on the table, then capture it shot by shot. The app checks each shot and gives the verdict."
      />
      <CaptureClient
        initialRolls={rolls}
        ready={ready}
        model={model}
        earlyModelNotice={status.earlyModelNotice}
      />
    </>
  );
}
