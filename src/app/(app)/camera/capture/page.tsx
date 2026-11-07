/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor the System Admin allows (C-23), with their own phone on a stand at a
 *        fixed position (C-24), or at a PC with Floor view; capturing one roll shot by shot.
 * What:  see today's rolls scanned against the Floor Manager's plan (D-118), pick the leather,
 *        then the roll (Phase 30E), choose it, capture it edge to edge, see Pass or Reject for each shot,
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
import { capturePlan } from "@/server/services/production.service";
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

  const [status, model, rolls, ready, plan] = await Promise.all([
    cameraStatus(),
    captureModelStatus(),
    openRollsForCapture(user),
    readyRollsForCapture(),
    capturePlan(),
  ]);

  return (
    <>
      <PageHeader
        title="Capture"
        description={
          // Hidden from view on a phone so the live picture is on the first screen (30F-3).
          <span className="max-sm:sr-only">
            Choose the leather, then the roll on the table, and capture it shot by shot. The app
            checks each shot and gives the verdict.
          </span>
        }
      />
      <CaptureClient
        initialRolls={rolls}
        initialPlan={plan}
        ready={ready}
        model={model}
        earlyModelNotice={status.earlyModelNotice}
      />
    </>
  );
}
