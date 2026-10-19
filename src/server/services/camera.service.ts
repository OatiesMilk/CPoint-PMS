import { Errors } from "@/server/lib/errors";
import { findLatestUsedCameraToken } from "@/server/models/api-token.model";
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
  /**
   * camera / simulator: a scan arrived in the last minute. waiting: no scan for a minute, but a
   * camera station checked in recently (D-054). not_connected: neither.
   */
  state: "not_connected" | "waiting" | "simulator" | "camera";
  lastScan: {
    id: string;
    at: Date;
    source: string;
    device: string | null;
    modelVersion: string | null;
  } | null;
  /** The station that checked in most recently, while it counts as connected. */
  station: { name: string; seenAt: Date } | null;
  earlyModelNotice: boolean;
  current: CameraBatch | null;
  candidates: PreparationBatch[];
  selectedBatchId: string | null;
};

const ACTIVE_WINDOW_MS = 60_000;
/**
 * A waiting station asks for the current batch every 20 s, and the app records a token's use at
 * most once a minute, so a station counts as connected for two minutes after its last check-in.
 */
export const STATION_WINDOW_MS = 120_000;

export async function cameraStatus(now: Date = new Date()): Promise<CameraStatus> {
  const [latest, current, candidates, settings, token] = await Promise.all([
    findLatestScan(),
    resolveCameraBatch(),
    listBatchesAtPreparation(),
    getCvSettings(),
    findLatestUsedCameraToken(),
  ]);
  const recent = latest && now.getTime() - latest.createdAt.getTime() <= ACTIVE_WINDOW_MS;
  // The simulator never checks in between scans; a token whose last scan was simulated is not a
  // station, so its recent use doesn't read as "waiting".
  const stationSeen =
    token?.lastUsedAt &&
    now.getTime() - token.lastUsedAt.getTime() <= STATION_WINDOW_MS &&
    token.scans[0]?.source !== "SIMULATOR"
      ? { name: token.name, seenAt: token.lastUsedAt }
      : null;
  return {
    state: recent
      ? latest.source === "SIMULATOR"
        ? "simulator"
        : "camera"
      : stationSeen
        ? "waiting"
        : "not_connected",
    lastScan: latest
      ? {
          id: latest.id,
          at: latest.createdAt,
          source: latest.source,
          device: latest.deviceToken?.name ?? null,
          modelVersion: latest.modelVersion,
        }
      : null,
    station: stationSeen,
    earlyModelNotice: settings?.earlyModelNotice ?? true,
    current,
    candidates,
    selectedBatchId: settings?.activeBatchId ?? null,
  };
}
