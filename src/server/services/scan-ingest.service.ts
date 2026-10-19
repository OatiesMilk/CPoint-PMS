import { randomUUID } from "node:crypto";
import { decide, type Thresholds } from "@/lib/decision-engine";
import type { ScanSource } from "@/lib/domain";
import { Errors } from "@/server/lib/errors";
import type { ImageType } from "@/server/lib/image-type";
import { logger } from "@/server/lib/logger";
import { getStorage, type StorageService } from "@/server/lib/storage";
import { lockBatchRow } from "@/server/models/batch.model";
import { getCvSettings } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import { insertReworkTicket, insertSalvageItem } from "@/server/models/outcome.model";
import { listDefectTypes } from "@/server/models/reference-data.model";
import {
  findScanByCaptureId,
  insertScanWithDetections,
  nextScanSequence,
} from "@/server/models/scan.model";
import type { DetectionValues } from "@/server/validators/scan.validator";
import { recordAudit } from "./audit.service";
import { NO_BATCH_MESSAGE, resolveCameraBatch } from "./camera.service";

export type IngestInput = {
  image: { bytes: Uint8Array; type: ImageType };
  detections: DetectionValues[];
  batchId?: string;
  captureId?: string;
  modelVersion?: string;
  source: ScanSource;
  capturedAt?: Date;
};

export type IngestResult = {
  scanId: string;
  batchId: string;
  batchCode: string;
  sequence: number;
  verdict: string;
  status: string;
  /** True when this captureId was already received: nothing new was written (D-051). */
  duplicate: boolean;
};

/**
 * The scan a device already sent with this capture id, as the first response described it.
 * Another device's id is refused, so one camera can't read or claim another's scans.
 */
async function earlierCapture(captureId: string, device: { id: string }) {
  const scan = await findScanByCaptureId(captureId);
  if (!scan) return null;
  if (scan.deviceTokenId !== device.id) {
    throw Errors.conflict(
      "Another camera already sent a scan with this captureId. Make a new captureId for each capture.",
    );
  }
  return {
    scanId: scan.id,
    batchId: scan.batch.id,
    batchCode: scan.batch.code,
    sequence: scan.sequence,
    verdict: scan.aiVerdict,
    status: scan.status,
    duplicate: true,
  } satisfies IngestResult;
}

function storageKey(now: Date, ext: string): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `scans/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

/**
 * One camera capture → one scan (D-005, D-011, D-020). The decision is made here, with the
 * thresholds in force right now (snapshotted on the scan). REWORK opens a repair ticket and REJECT
 * creates a salvage item in the same transaction (D-007). A captureId the same device already
 * sent returns the first scan instead, so a camera's retry never makes a second one (D-051).
 */
export async function ingestScan(
  input: IngestInput,
  device: { id: string },
  now: Date = new Date(),
  storage: StorageService = getStorage(),
): Promise<IngestResult> {
  if (input.captureId) {
    const earlier = await earlierCapture(input.captureId, device);
    if (earlier) return earlier;
  }

  const batch = await resolveCameraBatch(input.batchId);
  if (!batch) throw Errors.conflict(NO_BATCH_MESSAGE);

  const [settings, defectTypes] = await Promise.all([getCvSettings(), listDefectTypes()]);
  if (!settings)
    throw new Error("CV settings row is missing; the bootstrap should have created it.");
  const thresholds: Thresholds = {
    rejectAtOrAbove: settings.rejectAtOrAbove,
    reworkAtOrAbove: settings.reworkAtOrAbove,
  };
  const byKey = new Map(defectTypes.map((t) => [t.key, t]));
  const decision = decide(input.detections, byKey, thresholds);
  const pending = decision.verdict === "NEEDS_REVIEW";

  const key = storageKey(now, input.image.type.ext);
  await storage.put(key, input.image.bytes);

  try {
    return await runInTransaction(async (tx) => {
      await lockBatchRow(batch.id, tx);
      const sequence = await nextScanSequence(batch.id, tx);
      const scan = await insertScanWithDetections(
        {
          batchId: batch.id,
          sequence,
          imagePath: key,
          imageMime: input.image.type.mime,
          source: input.source,
          modelVersion: input.modelVersion ?? null,
          deviceTokenId: device.id,
          captureId: input.captureId ?? null,
          aiVerdict: decision.verdict,
          maxConfidence: decision.maxConfidence,
          thresholdsSnapshot: thresholds,
          finalVerdict: pending ? null : decision.verdict,
          status: pending ? "PENDING_REVIEW" : "DECIDED",
          decidedAt: pending ? null : now,
          capturedAt: input.capturedAt ?? now,
          createdAt: now,
        },
        input.detections.map((d) => {
          const type = byKey.get(d.classKey);
          return {
            defectTypeId: type?.id ?? null,
            rawClassKey: d.classKey,
            isUnknownClass: !type,
            confidence: d.confidence,
            x: d.box.x,
            y: d.box.y,
            width: d.box.width,
            height: d.box.height,
          };
        }),
        tx,
      );
      if (decision.verdict === "REWORK") await insertReworkTicket(scan.id, tx, now);
      if (decision.verdict === "REJECT")
        await insertSalvageItem({ scanId: scan.id, originBatchId: batch.id, createdAt: now }, tx);
      await recordAudit(tx, {
        actor: { type: "DEVICE", tokenId: device.id },
        action: "scan.create",
        entity: "Scan",
        entityId: scan.id,
        after: {
          batch: batch.code,
          sequence,
          verdict: decision.verdict,
          maxConfidence: decision.maxConfidence,
          detections: input.detections.length,
          unknownKeys: decision.unknownKeys,
          batchSelection: batch.selection,
        },
      });
      return {
        scanId: scan.id,
        batchId: batch.id,
        batchCode: batch.code,
        sequence,
        verdict: decision.verdict,
        status: scan.status,
        duplicate: false,
      };
    });
  } catch (error) {
    // Don't leave an orphan image when the database write fails.
    await storage
      .remove(key)
      .catch((err) => logger.warn({ err, key }, "Could not remove orphaned scan image"));
    // Two copies of one capture arrived together: the other one won, so answer as it did.
    if (input.captureId && (error as { code?: string })?.code === "P2002") {
      const earlier = await earlierCapture(input.captureId, device);
      if (earlier) return earlier;
    }
    throw error;
  }
}
