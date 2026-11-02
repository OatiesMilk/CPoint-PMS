/**
 * Copies a roll's shots out of the uploads folder for measuring (Phase 30B, cv/README.md).
 *
 *   npm run cv:roll-photos -- LR-MLT-001 cv/out/LR-MLT-001
 *
 * Reads the database in .env and the scan images under UPLOADS_DIR; writes only into the new
 * folder: the shots, shots.csv and roll.toml (the roll's code and area). Changes nothing in the app.
 * In PowerShell, quote the separator: npm run cv:roll-photos '--' LR-MLT-001 cv/out/LR-MLT-001
 */
import "dotenv/config";
import { getPrisma } from "../src/server/lib/prisma";
import { exportRollPhotos, RollPhotosError } from "../src/server/services/roll-photos.service";

async function main() {
  const [code, folder] = process.argv.slice(2).filter((a) => a !== "--");
  if (!code || !folder) {
    console.error("Usage: npm run cv:roll-photos -- <roll-code> <folder>");
    process.exitCode = 2;
    return;
  }
  const result = await exportRollPhotos(code, folder);
  console.log(`Roll ${result.roll}: ${result.shots.length} shots copied to ${result.folder}.`);
  console.log(
    "Next: calibrate (python -m cpoint_cv calibrate <sheet photo>), put width_in in roll.toml, then python -m cpoint_cv measure <folder>.",
  );
}

main()
  .then(() => getPrisma().$disconnect())
  .catch(async (error) => {
    console.error(error instanceof RollPhotosError ? `error: ${error.message}` : error);
    await getPrisma().$disconnect();
    process.exit(error instanceof RollPhotosError ? 2 : 1);
  });
