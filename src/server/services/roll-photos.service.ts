import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorage } from "@/server/lib/storage";
import { findRollPhotos, type RollPhotosRow } from "@/server/models/roll.model";

/**
 * Copies a roll's shots out of the uploads folder for the model toolkit's `measure` command
 * (Phase 30B, `npm run cv:roll-photos -- <roll-code> <folder>`). It reads the database and the
 * scan images and writes only into the new folder: `shot-01.jpg`…, `shots.csv` (each shot's time
 * and verdict) and `roll.toml` (the roll's code and the area the FM entered, D-103). No person is
 * named (D-008). Nothing in the app changes, so there is no audit row.
 */

export class RollPhotosError extends Error {}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extensionFor(shot: { imageMime: string | null; imagePath: string }): string {
  const fromMime = shot.imageMime ? EXT_BY_MIME[shot.imageMime] : undefined;
  return fromMime ?? (path.extname(shot.imagePath).slice(1).toLowerCase() || "jpg");
}

/** An instant as Manila time, e.g. 2026-11-02T14:05:09+08:00 (Manila has no DST). */
export function manilaIso(at: Date): string {
  return new Date(at.getTime() + 8 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "+08:00");
}

function tomlString(value: string): string {
  return JSON.stringify(value); // a TOML basic string takes JSON's escapes for these characters
}

export function rollToml(roll: RollPhotosRow, exportedAt: Date): string {
  const area = roll.areaSqFt === null ? null : Number(roll.areaSqFt.toString());
  return [
    `# Exported by npm run cv:roll-photos on ${manilaIso(exportedAt)}.`,
    roll.item ? `# Item: ${roll.item.name}` : null,
    roll.supplier ? `# Supplier: ${roll.supplier.name}` : null,
    `code = ${tomlString(roll.code)}`,
    `area_sq_ft = ${area}`,
    "# The scale: run python -m cpoint_cv calibrate <photo of the A4 or letter sheet> and write",
    "# width_in = <the width it prints>, or put that photo here as calibration_photo.",
    "# width_in = 18.5",
    '# calibration_photo = "sheet.jpg"',
    '# sheet = "a4"',
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export type ExportedShot = { file: string; sequence: number; capturedAt: Date; verdict: string };

export function shotsCsv(shots: ExportedShot[]): string {
  const rows = shots.map((s) => `${s.file},${s.sequence},${manilaIso(s.capturedAt)},${s.verdict}`);
  return ["file,shot,captured_at,verdict", ...rows, ""].join("\n");
}

export async function exportRollPhotos(
  code: string,
  folder: string,
  now: Date = new Date(),
): Promise<{ roll: string; shots: ExportedShot[]; missing: number[]; folder: string }> {
  const roll = await findRollPhotos(code.trim());
  if (!roll)
    throw new RollPhotosError(`No roll has the code ${code}. Check it under Reports → Rolls.`);
  if (roll.areaSqFt === null)
    throw new RollPhotosError(
      `Roll ${roll.code} has no area. Only rolls added in Inventory (LR-…) have one, and measure needs it. Pick a roll from Inventory.`,
    );
  const withImages = roll.scans.filter(
    (s): s is typeof s & { imagePath: string } => s.imagePath !== null,
  );
  if (withImages.length === 0)
    throw new RollPhotosError(`Roll ${roll.code} has no shots with a photo to export.`);

  const target = path.resolve(folder);
  const existing = await readdir(target).catch(() => [] as string[]);
  if (existing.length > 0)
    throw new RollPhotosError(
      `${target} isn't empty. Give a new folder so nothing is overwritten.`,
    );

  // Read every photo before the folder is made, so a missing file leaves nothing behind.
  const storage = getStorage();
  const found: { shot: (typeof withImages)[number]; bytes: Buffer }[] = [];
  const missing: number[] = [];
  for (const shot of withImages) {
    try {
      found.push({ shot, bytes: await storage.read(shot.imagePath) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      missing.push(shot.sequence);
    }
  }
  if (found.length === 0)
    throw new RollPhotosError(
      `None of roll ${roll.code}'s ${withImages.length} photos is in the uploads folder on this computer (UPLOADS_DIR). Export it on the computer that captured it.`,
    );

  await mkdir(target, { recursive: true });

  const shots: ExportedShot[] = [];
  for (const { shot, bytes } of found) {
    const file = `shot-${String(shot.sequence).padStart(2, "0")}.${extensionFor(shot)}`;
    await writeFile(path.join(target, file), bytes, { flag: "wx" });
    shots.push({
      file,
      sequence: shot.sequence,
      capturedAt: shot.capturedAt,
      verdict: shot.finalVerdict,
    });
  }
  await writeFile(path.join(target, "shots.csv"), shotsCsv(shots), { flag: "wx" });
  await writeFile(path.join(target, "roll.toml"), rollToml(roll, now), { flag: "wx" });
  return { roll: roll.code, shots, missing, folder: target };
}
