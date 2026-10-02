import { Errors } from "@/server/lib/errors";
import {
  findPreparationBatchById,
  listBatchesAtPreparation,
  type PreparationBatch,
} from "@/server/models/batch.model";
import { getCvSettings, updateActiveBatch } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import { findLatestScan } from "@/server/models/scan.model";
import { recordAudit } from "./audit.service";

export type CameraBatch = PreparationBatch & { selection: "explicit" | "selected" | "oldest" };

const atPreparation = (b: PreparationBatch | null): b is PreparationBatch =>
  !!b && b.status === "IN_PROGRESS" && b.currentStage === "PREPARATION";

export const NO_BATCH_MESSAGE =
  "No batch is at Preparation. Start one on the Batches page, then scan again.";

/**
 * Which batch a scan belongs to (D-020): an explicit batchId from the device, else the batch picked
 * on the Camera page, else the longest-waiting batch at Preparation. Null when none is at Preparation.
 */
export async function resolveCameraBatch(explicitBatchId?: string): Promise<CameraBatch | null> {
  if (explicitBatchId) {
    const batch = await findPreparationBatchById(explicitBatchId);
    if (!atPreparation(batch)) {
      throw Errors.conflict(
        "That batch isn't in progress at Preparation, so it can't receive scans.",
      );
    }
    return { ...batch, selection: "explicit" };
  }
  const settings = await getCvSettings();
  if (settings?.activeBatchId) {
    const selected = await findPreparationBatchById(settings.activeBatchId);
    if (atPreparation(selected)) return { ...selected, selection: "selected" };
  }
  const [oldest] = await listBatchesAtPreparation();
  return oldest ? { ...oldest, selection: "oldest" } : null;
}

/** Pick the batch the camera feeds, or null to go back to "oldest at Preparation". */
export async function setActiveBatch(batchId: string | null, actor: { id: string }) {
  if (batchId) {
    const batch = await findPreparationBatchById(batchId);
    if (!atPreparation(batch))
      throw Errors.conflict("Only a batch in progress at Preparation can be the camera's batch.");
  }
  const before = await getCvSettings();
  await runInTransaction(async (tx) => {
    await updateActiveBatch(batchId, actor.id, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "camera.set_batch",
      entity: "CvSettings",
      entityId: "1",
      before: { activeBatchId: before?.activeBatchId ?? null },
      after: { activeBatchId: batchId },
    });
  });
}

export type CameraStatus = {
  state: "not_connected" | "simulator" | "camera";
  lastScan: { id: string; at: Date; source: string; device: string | null } | null;
  current: CameraBatch | null;
  candidates: PreparationBatch[];
  selectedBatchId: string | null;
};

const ACTIVE_WINDOW_MS = 60_000;

export async function cameraStatus(now: Date = new Date()): Promise<CameraStatus> {
  const [latest, current, candidates, settings] = await Promise.all([
    findLatestScan(),
    resolveCameraBatch(),
    listBatchesAtPreparation(),
    getCvSettings(),
  ]);
  const recent = latest && now.getTime() - latest.createdAt.getTime() <= ACTIVE_WINDOW_MS;
  return {
    state: !recent ? "not_connected" : latest.source === "SIMULATOR" ? "simulator" : "camera",
    lastScan: latest
      ? {
          id: latest.id,
          at: latest.createdAt,
          source: latest.source,
          device: latest.deviceToken?.name ?? null,
        }
      : null,
    current,
    candidates,
    selectedBatchId: settings?.activeBatchId ?? null,
  };
}
