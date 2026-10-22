/**
 * A capture from the website's Capture page (Phase 18, D-064 to D-067): the browser sends only the
 * photo; the app runs the model and then the same `ingestScan` and decision engine the camera
 * station uses. Nothing here decides a verdict.
 */
import { AppError } from "@/server/lib/errors";
import type { ImageType } from "@/server/lib/image-type";
import type { MappedDetection } from "@/server/lib/cv/mapper";
import { getModelRunner, modelUnavailable, type ModelRunner } from "@/server/lib/cv/model-runner";
import type { CaptureFields } from "@/server/validators/scan.validator";
import { NO_BATCH_MESSAGE, resolveCameraBatch, type CameraBatch } from "./camera.service";
import { earlierCapture, ingestScan, type IngestResult } from "./scan-ingest.service";

export type CaptureResult = IngestResult & {
  /** What the model found, in the scan's own boxes. Empty for a repeat (nothing new was run). */
  detections: MappedDetection[];
  modelVersion: string | null;
  inferenceMs: number | null;
};

export const batchSummary = (batch: CameraBatch | null) =>
  batch
    ? {
        batchId: batch.id,
        batchCode: batch.code,
        rollCode: batch.rollCode,
        shoeType: batch.shoeType.name,
        /** Sections scanned so far, for "All 10 pieces scanned. Finish this roll?" (D-082). */
        scanned: batch._count.scans,
      }
    : null;

/**
 * The batch this capture goes to: the one the page showed, like the station (D-050). When that
 * batch has left Preparation the capture is refused before the model runs, with the batch the next
 * scan goes to, so the page can update and the person can press Capture again.
 */
async function checkBatch(shownBatchId: string | undefined): Promise<void> {
  const current = await resolveCameraBatch();
  if (!current) throw new AppError(409, "NO_BATCH_AT_PREPARATION", NO_BATCH_MESSAGE);
  if (!shownBatchId || shownBatchId === current.id) return;
  try {
    await resolveCameraBatch(shownBatchId);
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 409) throw error;
    throw new AppError(
      409,
      "BATCH_MOVED",
      `This roll was finished, so this section wasn't saved. The next scan goes to ${current.code}. Press Capture again.`,
      { current: batchSummary(current) },
    );
  }
}

export async function captureScan(
  image: { bytes: Uint8Array; type: ImageType },
  fields: CaptureFields,
  user: { id: string },
  runner: ModelRunner = getModelRunner(),
  now: Date = new Date(),
): Promise<CaptureResult> {
  const origin = { kind: "website", userId: user.id } as const;

  // A retry of a capture the app already has: answer as the first time, without running the model.
  const earlier = await earlierCapture(fields.captureId, origin);
  if (earlier) return { ...earlier, detections: [], modelVersion: null, inferenceMs: null };

  const model = await runner.status();
  if (model.state !== "ready") throw modelUnavailable(model.message);
  await checkBatch(fields.batchId);

  const seen = await runner.detect(image.bytes);
  const result = await ingestScan(
    {
      image,
      detections: seen.detections,
      batchId: fields.batchId,
      captureId: fields.captureId,
      modelVersion: seen.modelVersion,
      source: fields.source,
      capturedAt: fields.capturedAt,
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
