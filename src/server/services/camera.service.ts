import { Errors } from "@/server/lib/errors";
import {
  findPreparationBatchById,
  listBatchesAtPreparation,
  type PreparationBatch,
} from "@/server/models/batch.model";
import { getCvSettings, updateActiveBatch } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import { findLatestScan } from "@/server/models/scan.model";
import {
  findUserById,
  listCameraOperatorCandidates,
  setCanCapture,
} from "@/server/models/user.model";
import type { Role } from "@/lib/domain";
import { can } from "@/server/policies/permissions";
import { recordAudit } from "./audit.service";

export type CameraBatch = PreparationBatch & { selection: "explicit" | "selected" | "oldest" };

const atPreparation = (b: PreparationBatch | null): b is PreparationBatch =>
  !!b && b.status === "IN_PROGRESS" && b.currentStage === "PREPARATION";

export const NO_BATCH_MESSAGE =
  "No roll is at Preparation. Start one on the Batches page, then scan again.";

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

/** Active Shoe Constructors and whether each may capture at the camera (D-075). */
export function listCameraOperators() {
  return listCameraOperatorCandidates();
}

/**
 * Allow or stop a Shoe Constructor capturing at the camera (D-075), as the Floor Manager or the
 * System Admin. Applies on the person's next request; they stay signed in.
 */
export async function setCameraOperator(
  userId: string,
  canCapture: boolean,
  actor: { id: string; role: Role },
) {
  if (!can(actor.role, "camera:operators"))
    throw Errors.forbidden(
      "Only the Floor Manager or the System Admin chooses who can capture at the camera.",
    );
  const target = await findUserById(userId);
  if (!target) throw Errors.notFound("This person");
  if (target.role !== "SHOE_CONSTRUCTOR" || !target.isActive)
    throw Errors.conflict(
      "Only an active Shoe Constructor can be allowed to capture. The QI and the Floor Manager already can.",
    );
  if (target.canCapture === canCapture) return { id: userId, canCapture };
  await runInTransaction(async (tx) => {
    await setCanCapture(userId, canCapture, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: canCapture ? "camera.capture_access.grant" : "camera.capture_access.revoke",
      entity: "User",
      entityId: userId,
      before: { email: target.email, canCapture: target.canCapture },
      after: { email: target.email, canCapture },
    });
  });
  return { id: userId, canCapture };
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
   * capturing / simulator: a scan arrived in the last minute (the Capture page, or a device token
   * other than the simulator). idle: nothing for a minute. The station check-in (D-054) was
   * retired with the station app in Phase 20 (D-069).
   */
  state: "idle" | "simulator" | "capturing";
  lastScan: {
    id: string;
    at: Date;
    source: string;
    device: string | null;
    modelVersion: string | null;
  } | null;
  earlyModelNotice: boolean;
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
    state: recent ? (latest.source === "SIMULATOR" ? "simulator" : "capturing") : "idle",
    lastScan: latest
      ? {
          id: latest.id,
          at: latest.createdAt,
          source: latest.source,
          device: latest.deviceToken?.name ?? null,
          modelVersion: latest.modelVersion,
        }
      : null,
    earlyModelNotice: settings?.earlyModelNotice ?? true,
    current,
    candidates,
    selectedBatchId: settings?.activeBatchId ?? null,
  };
}
