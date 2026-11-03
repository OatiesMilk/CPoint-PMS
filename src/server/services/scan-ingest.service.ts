import { randomUUID } from "node:crypto";
import {
  decide,
  detectionOutcome,
  isFound,
  outcomeFor,
  type DecisionSnapshot,
  type DefectOutcome,
} from "@/lib/decision-engine";
import type { ScanSource } from "@/lib/domain";
import { measureShot, scaleOf } from "@/lib/measure";
import { AppError, Errors } from "@/server/lib/errors";
import { imageSize, type ImageType } from "@/server/lib/image-type";
import { logger } from "@/server/lib/logger";
import { getStorage, type StorageService } from "@/server/lib/storage";
import { lockOpenRoll } from "@/server/models/roll.model";
import { rollClosedMessage } from "@/lib/roll-rules";
import { getCvSettings } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import { listDefectTypes } from "@/server/models/reference-data.model";
import {
  findScanByCaptureId,
  insertScanWithDetections,
  nextScanSequence,
} from "@/server/models/scan.model";
import type { DetectionValues } from "@/server/validators/scan.validator";
import { recordAudit } from "./audit.service";
import { resolveCaptureRoll } from "./roll.service";

export type IngestInput = {
  image: { bytes: Uint8Array; type: ImageType };
  detections: DetectionValues[];
  rollId?: string;
  captureId?: string;
  modelVersion?: string;
  source: ScanSource;
  capturedAt?: Date;
  /** Inches across the photo's width, from the phone's calibration (Phase 30C, A-18). */
  widthIn?: number | null;
};

export type IngestResult = {
  scanId: string;
  rollId: string;
  rollCode: string;
  sequence: number;
  verdict: string;
  /** True when this captureId was already received: nothing new was written (D-051). */
  duplicate: boolean;
  /**
   * What each found defect did to the section, for the Capture page's last result (Phase 26):
   * Usable or Not accepted, or null below found-at. Empty for a repeat.
   */
  defects: ScanDefect[];
};

export type ScanDefect = {
  label: string;
  confidence: number;
  effect: DefectOutcome | null;
  /** Its box diagonal in inches; null when the phone isn't calibrated (Phase 30C). */
  lengthIn: number | null;
};

/**
 * Where a scan came from: a camera device's token (the station, the simulator), or the website's
 * Capture page, whose signed-in person is recorded in the audit log only, never on the scan
 * (D-008, D-066).
 */
export type ScanOrigin = { kind?: "device"; id: string } | { kind: "website"; userId: string };

const tokenOf = (origin: ScanOrigin) => (origin.kind === "website" ? null : origin.id);

/**
 * The scan this origin already sent with this capture id, as the first response described it.
 * Another device's id (or a device's id sent from the website) is refused, so one camera can't
 * read or claim another's scans.
 */
export async function earlierCapture(captureId: string, origin: ScanOrigin) {
  const scan = await findScanByCaptureId(captureId);
  if (!scan) return null;
  if (scan.deviceTokenId !== tokenOf(origin)) {
    throw Errors.conflict(
      "Another camera already sent a scan with this captureId. Make a new captureId for each capture.",
    );
  }
  return {
    scanId: scan.id,
    rollId: scan.roll.id,
    rollCode: scan.roll.code,
    sequence: scan.sequence,
    verdict: scan.aiVerdict,
    duplicate: true,
    defects: [],
  } satisfies IngestResult;
}

function storageKey(now: Date, ext: string): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `scans/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

/**
 * One camera capture → one scan, a shot of a roll (D-005, D-095). The verdict, Pass or Reject, is made here with the
 * rule in force right now (snapshotted on the scan) and is final: nobody changes it (D-093). A
 * captureId the same origin already sent returns the first scan instead, so a camera's retry
 * never makes a second one (D-051).
 */
export async function ingestScan(
  input: IngestInput,
  origin: ScanOrigin,
  now: Date = new Date(),
  storage: StorageService = getStorage(),
): Promise<IngestResult> {
  if (input.captureId) {
    const earlier = await earlierCapture(input.captureId, origin);
    if (earlier) return earlier;
  }

  // Phase 26: the roll chosen at Capture, or for a device token the roll open the longest.
  const roll = await resolveCaptureRoll(
    input.rollId,
    origin.kind === "website" ? "website" : "device",
  );

  const [settings, defectTypes] = await Promise.all([getCvSettings(), listDefectTypes()]);
  if (!settings)
    throw new Error("CV settings row is missing; the bootstrap should have created it.");
  const rule = { foundAtOrAbove: settings.foundAtOrAbove };
  const byKey = new Map(defectTypes.map((t) => [t.key, t]));
  // A class with no defect type is dropped here: not stored, no effect on the verdict (D-108).
  const detections = input.detections.filter((d) => byKey.has(d.classKey));

  // Phase 30C: each defect's length and area from the phone's calibration, and what the shot's
  // found defects add to its roll (D-106, D-110). Without a calibration nothing is measured.
  const size = await imageSize(input.image.bytes);
  const widthIn = input.widthIn ?? null;
  const scale = scaleOf(widthIn, size?.width, size?.height);
  const liveType = (key: string) => {
    const type = byKey.get(key);
    return type?.isActive ? type : undefined;
  };
  const shot = measureShot(
    detections.map((d) => {
      const type = liveType(d.classKey);
      return {
        box: d.box,
        found: isFound(d.confidence, rule),
        rule: type
          ? {
              notAcceptedFromIn: type.notAcceptedFromIn ?? null,
              flatSharePct: type.flatSharePct ?? null,
            }
          : null,
      };
    }),
    scale,
  );
  const measured = detections.map((d, i) => ({ ...d, lengthIn: shot.sizes[i].lengthIn }));
  const decision = decide(measured, byKey, rule);
  // The rule in force, kept with the found-at value so the verdict stays explainable.
  const active = defectTypes.filter((t) => t.isActive);
  const pick = (value: (t: (typeof active)[number]) => number | null | undefined) =>
    Object.fromEntries(
      active.flatMap((t) => {
        const v = value(t);
        return v == null ? [] : [[t.key, v]];
      }),
    ) as Record<string, number>;
  const snapshot: Omit<DecisionSnapshot, "earlierRule"> = {
    ...rule,
    outcomes: Object.fromEntries(active.map((t) => [t.key, t.outcome])),
    lengthLimits: pick((t) => t.notAcceptedFromIn),
    flatShares: pick((t) => t.flatSharePct),
    widthIn: scale ? widthIn : null,
  };

  const defects: ScanDefect[] = measured.map((d) => {
    const type = liveType(d.classKey);
    return {
      label: byKey.get(d.classKey)?.label ?? d.classKey,
      confidence: d.confidence,
      effect: detectionOutcome(
        d.confidence,
        outcomeFor(type?.outcome, type?.notAcceptedFromIn, d.lengthIn),
        rule,
      ),
      lengthIn: d.lengthIn,
    };
  });

  const key = storageKey(now, input.image.type.ext);
  await storage.put(key, input.image.bytes);

  try {
    return await runInTransaction(async (tx) => {
      // Finished or cancelled since it was chosen: refuse, so no shot lands on a closed roll.
      if (!(await lockOpenRoll(roll.id, tx))) {
        throw new AppError(409, "ROLL_CLOSED", rollClosedMessage(roll.code));
      }
      const sequence = await nextScanSequence(roll.id, tx);
      const scan = await insertScanWithDetections(
        {
          rollId: roll.id,
          sequence,
          imagePath: key,
          imageMime: input.image.type.mime,
          source: input.source,
          modelVersion: input.modelVersion ?? null,
          deviceTokenId: tokenOf(origin),
          captureId: input.captureId ?? null,
          aiVerdict: decision.verdict,
          maxConfidence: decision.maxConfidence,
          thresholdsSnapshot: snapshot,
          finalVerdict: decision.verdict,
          capturedAt: input.capturedAt ?? now,
          createdAt: now,
          imageWidth: size?.width ?? null,
          imageHeight: size?.height ?? null,
          widthIn: scale ? widthIn : null,
          defectAreaSqIn: shot.defectAreaSqIn,
          flatSharePct: shot.flatSharePct,
        },
        detections.map((d, i) => {
          const type = byKey.get(d.classKey);
          return {
            defectTypeId: type?.id ?? null,
            rawClassKey: d.classKey,
            confidence: d.confidence,
            x: d.box.x,
            y: d.box.y,
            width: d.box.width,
            height: d.box.height,
            lengthIn: shot.sizes[i].lengthIn,
            areaSqIn: shot.sizes[i].areaSqIn,
          };
        }),
        tx,
      );
      await recordAudit(tx, {
        actor:
          origin.kind === "website"
            ? { type: "USER", userId: origin.userId }
            : { type: "DEVICE", tokenId: origin.id },
        action: "scan.create",
        entity: "Scan",
        entityId: scan.id,
        after: {
          roll: roll.code,
          sequence,
          verdict: decision.verdict,
          maxConfidence: decision.maxConfidence,
          detections: detections.length,
          rollSelection: roll.selection,
          ...(origin.kind === "website" ? { origin: "website" } : {}),
        },
      });
      return {
        scanId: scan.id,
        rollId: roll.id,
        rollCode: roll.code,
        sequence,
        verdict: decision.verdict,
        duplicate: false,
        defects,
      };
    });
  } catch (error) {
    // Don't leave an orphan image when the database write fails.
    await storage
      .remove(key)
      .catch((err) => logger.warn({ err, key }, "Could not remove orphaned scan image"));
    // Two copies of one capture arrived together: the other one won, so answer as it did.
    if (input.captureId && (error as { code?: string })?.code === "P2002") {
      const earlier = await earlierCapture(input.captureId, origin);
      if (earlier) return earlier;
    }
    throw error;
  }
}
