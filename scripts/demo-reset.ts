/**
 * A clean, freshly organised system for a demo (D-056), keeping the accounts. Rerunnable.
 *
 *   npm run demo:reset              shows what would be removed, changes nothing
 *   npm run demo:reset -- --yes     resets, then seeds a fresh demo week
 *   npm run demo:reset -- --yes --no-demo-week
 *
 * Works on the database in .env and the files under UPLOADS_DIR. Back the database up
 * first. Refuses to run with NODE_ENV=production. Keeps the device token in CV_DEVICE_TOKEN (.env,
 * or an old cv/.env from before the station was retired, D-069), so the simulator keeps working.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { getPrisma } from "../src/server/lib/prisma";
import { previewReset, resetDemoData, resetKeep } from "../src/server/services/demo-reset.service";

function stationToken(): string | undefined {
  try {
    const line = readFileSync("cv/.env", "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith("CV_DEVICE_TOKEN="));
    return line
      ?.split("=", 2)[1]
      ?.trim()
      .replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const LABELS: Record<string, string> = {
  users: "test accounts",
  tokens: "device tokens",
  rolls: "rolls",
  scans: "scans",
  inventoryItems: "inventory items (the demo ones come back with opening stock)",
  movements: "stock movements",
  stockUpdates: "stock updates (the demo week adds its own; reminder days back to Wed and Fri)",
  auditLogs: "audit log rows",
  suppliers: "suppliers tests added",
  defectTypes: "defect types tests added",
  attendanceDays: "days of attendance (the demo week adds its own)",
  checkIns: "finished batches (the demo week adds its own)",
  dayPlans: "day plans and Non-working marks (the demo week plans its own days)",
  lunchBreaks: "lunch breaks the System Admin saved (the default 11:00 to 12:00 comes back)",
};

async function main() {
  const confirmed = process.argv.includes("--yes");
  const demoWeek = !process.argv.includes("--no-demo-week");
  const tokens = [process.env.CV_DEVICE_TOKEN, stationToken()].filter((t): t is string => !!t);
  const keep = resetKeep(tokens);

  console.log(`Keeps: ${keep.emails.join(", ")}`);
  console.log(
    `Keeps ${keep.tokenHashes.length} device token(s) from CV_DEVICE_TOKEN${keep.tokenHashes.length === 0 ? " (none set: every token is removed; make a new one with npm run cv:token)" : ""}.`,
  );
  const counts = await previewReset(keep);
  console.log(confirmed ? "Removing:" : "Would remove:");
  for (const [key, n] of Object.entries(counts))
    console.log(`  ${String(n).padStart(6)}  ${LABELS[key] ?? key}`);
  console.log("  and the scan images and old proof-of-delivery files under UPLOADS_DIR.");

  if (!confirmed) {
    console.log("\nNothing changed. Back up the database, then run: npm run demo:reset -- --yes");
    return;
  }
  const started = Date.now();
  const result = await resetDemoData(keep, { demoWeek });
  console.log(
    `\nReset done in ${Math.round((Date.now() - started) / 1000)}s. Defect types: cut and hole Not accepted, crease and scratch Usable, abrasion and dirt off.`,
  );
  if (result.demoWeek)
    console.log(
      result.demoWeek.seeded
        ? `Seeded a fresh demo week: ${result.demoWeek.rolls} rolls, ${result.demoWeek.scans} scans, ${result.demoWeek.attendanceDays} days of attendance.`
        : `The demo week wasn't seeded: ${result.demoWeek.reason}.`,
    );
}

main()
  .then(() => getPrisma().$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await getPrisma().$disconnect();
    process.exit(1);
  });
