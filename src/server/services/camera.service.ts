import { Errors } from "@/server/lib/errors";
import { countOpenRolls } from "@/server/models/roll.model";
import { getCvSettings } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import { findLatestScan } from "@/server/models/scan.model";
import { findUserById, setCanCapture } from "@/server/models/user.model";
import type { Role } from "@/lib/domain";
import { can } from "@/server/policies/permissions";
import { recordAudit } from "./audit.service";

export const CAMERA_OPERATORS_FORBIDDEN = "Only the System Admin chooses who can capture.";

/**
 * Allow or stop a Shoe Constructor capturing (D-075), as the System Admin only (C-23, D-095).
 * Applies on the person's next request; they stay signed in.
 */
export async function setCameraOperator(
  userId: string,
  canCapture: boolean,
  actor: { id: string; role: Role },
) {
  if (!can(actor.role, "camera:operators")) throw Errors.forbidden(CAMERA_OPERATORS_FORBIDDEN);
  const target = await findUserById(userId);
  if (!target) throw Errors.notFound("This person");
  if (target.role !== "SHOE_CONSTRUCTOR" || !target.isActive)
    throw Errors.conflict("Only an active Shoe Constructor can be allowed to capture.");
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
  /** Rolls being captured now (Phase 26: rolls start and finish at Capture). */
  openRolls: number;
};

const ACTIVE_WINDOW_MS = 60_000;

export async function cameraStatus(now: Date = new Date()): Promise<CameraStatus> {
  const [latest, openRolls, settings] = await Promise.all([
    findLatestScan(),
    countOpenRolls(),
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
    openRolls,
  };
}
