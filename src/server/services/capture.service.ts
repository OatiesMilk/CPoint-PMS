/**
 * A capture from the website's Capture page (Phase 18, D-064 to D-067): the browser sends only the
 * photo and the roll chosen in the Roll dropdown (Phase 26); the app runs the model and then the
 * same `ingestScan` and decision engine as every scan. Nothing here decides a verdict.
 */
import { appNow } from "@/lib/clock";
import { imageSize, type ImageType } from "@/server/lib/image-type";
import type { MappedDetection } from "@/server/lib/cv/mapper";
import { getModelRunner, modelUnavailable, type ModelRunner } from "@/server/lib/cv/model-runner";
import type { CaptureFields } from "@/server/validators/scan.validator";
import { resolveCaptureRoll } from "./roll.service";
import { earlierCapture, ingestScan, rollScaleFor, type IngestResult } from "./scan-ingest.service";

export type CaptureResult = IngestResult & {
  /** What the model found, in the scan's own boxes. Empty for a repeat (nothing new was run). */
  detections: MappedDetection[];
  modelVersion: string | null;
  inferenceMs: number | null;
};

export async function captureScan(
  image: { bytes: Uint8Array; type: ImageType },
  fields: CaptureFields,
  user: { id: string },
  runner: ModelRunner = getModelRunner(),
  now: Date = appNow(),
): Promise<CaptureResult> {
  const origin = { kind: "website", userId: user.id } as const;

  // A retry of a capture the app already has: answer as the first time, without running the model.
  const earlier = await earlierCapture(fields.captureId, origin);
  if (earlier) return { ...earlier, detections: [], modelVersion: null, inferenceMs: null };

  const model = await runner.status();
  if (model.state !== "ready") throw modelUnavailable(model.message);
  // A roll finished or cancelled since the page loaded is refused before the model runs.
  const roll = await resolveCaptureRoll(fields.rollId, "website");
  // A shot without the card needs the roll's scale (D-121): refused before the model runs.
  if (!fields.markerCorners?.length) await rollScaleFor(roll.id, await imageSize(image.bytes));

  const seen = await runner.detect(image.bytes);
  const result = await ingestScan(
    {
      image,
      detections: seen.detections,
      rollId: fields.rollId,
      captureId: fields.captureId,
      modelVersion: seen.modelVersion,
      source: fields.source,
      capturedAt: fields.capturedAt,
      // The server works out the scale from the card's corners (D-120), or without them from the
      // roll's first shot with the card (D-121).
      markerCorners: fields.markerCorners ?? null,
      scaleFromRoll: true,
    },
    origin,
    now,
  );
  return {
    ...result,
    detections: result.duplicate ? [] : seen.detections,
    modelVersion: seen.modelVersion,
    inferenceMs: seen.inferenceMs,
  };
}

/** For the Capture page: is the model there, and which version. */
export function captureModelStatus(runner: ModelRunner = getModelRunner()) {
  return runner.status();
}
