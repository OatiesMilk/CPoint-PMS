import type { DefectOutcome } from "@/generated/prisma/client";
import { hashDeviceToken } from "@/server/lib/device-token";
import { getEnv } from "@/server/lib/env";
import { clearUploadFolders } from "@/server/lib/storage";
import { runInTransaction } from "@/server/models/db";
import {
  countResetTargets,
  deleteResetTargets,
  reactivateSuppliers,
  setDemoAccountNames,
  upsertDefectTypeState,
  type ResetCounts,
  type ResetKeep,
} from "@/server/models/demo-reset.model";
import { recordAudit } from "./audit.service";
import { ensureDefaultLunchBreak, ensureDefaultSchedule } from "./production.service";
import { DEMO_SUPPLIERS } from "@/server/lib/demo-suppliers";
import {
  DEMO_CONSTRUCTORS,
  DEMO_USERS,
  ensureDemoConstructors,
  ensureDemoInventory,
  REFERENCE_DATA,
} from "./bootstrap.service";
import { seedDemoWeek } from "./demo-seed.service";

/**
 * `npm run demo:reset` (D-056): a clean, freshly organised system for a demo, keeping the people.
 *
 * Keeps the bootstrap System Admin and the demo accounts, the device tokens given to it (so the
 * camera station keeps working), the bootstrap suppliers, and the defect types.
 * Removes everything else: test accounts and tokens, rolls, scans, stock
 * movements and items, attendance, check-ins, the audit log, and the files on disk. Then it sets
 * the camera model's classes and their outcomes (D-052, A-13) and, unless told not to, seeds a fresh demo week,
 * which puts the demo inventory back at its opening stock.
 */

/**
 * The yolo-v1 classes as the demo uses them: the model's four active with CPoint's outcomes
 * (A-13), the two placeholder types it never sends turned off (D-052). Data the reset writes, like
 * the bootstrap's reference data; the System Admin can change all of it in Settings afterwards.
 */
export const MODEL_DEFECT_TYPES: {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  outcome: DefectOutcome;
  /** Phase 30C: Not accepted from this length (C-37) and its flat share (D-110); null: none. */
  notAcceptedFromIn: number | null;
  flatSharePct: number | null;
}[] = [
  {
    key: "cut",
    label: "Cut",
    description: "Slit or cut through the leather surface. Not accepted from 3 in (C-37).",
    sortOrder: 1,
    isActive: true,
    outcome: "NOT_ACCEPTED",
    notAcceptedFromIn: 3,
    flatSharePct: 1,
  },
  {
    key: "hole",
    label: "Hole",
    description: "Puncture or hole in the leather.",
    sortOrder: 2,
    isActive: true,
    outcome: "NOT_ACCEPTED",
    notAcceptedFromIn: null,
    flatSharePct: null,
  },
  {
    key: "crease",
    label: "Crease",
    description: "A fold line in the grain. CPoint can use it (C-11).",
    sortOrder: 3,
    isActive: true,
    outcome: "USABLE",
    notAcceptedFromIn: null,
    flatSharePct: null,
  },
  {
    key: "scratch",
    label: "Scratch",
    description: "A surface scratch, at any length. CPoint can use it (C-19, C-39).",
    sortOrder: 4,
    isActive: true,
    outcome: "USABLE",
    notAcceptedFromIn: null,
    flatSharePct: null,
  },
  {
    key: "abrasion",
    label: "Abrasion",
    description: "Scuffed or worn grain.",
    sortOrder: 5,
    isActive: false,
    outcome: "NOT_ACCEPTED",
    notAcceptedFromIn: null,
    flatSharePct: null,
  },
  {
    key: "dirt",
    label: "Dirt",
    description: "Stain or dirt on the surface.",
    sortOrder: 6,
    isActive: false,
    outcome: "NOT_ACCEPTED",
    notAcceptedFromIn: null,
    flatSharePct: null,
  },
];

/** What the reset keeps. `deviceTokens` are plain tokens (from CV_DEVICE_TOKEN); only hashes go on. */
export function resetKeep(deviceTokens: string[]): ResetKeep {
  const admin = getEnv().BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
  return {
    emails: [
      ...new Set([
        ...DEMO_USERS.map((u) => u.email),
        ...DEMO_CONSTRUCTORS.map((u) => u.email),
        ...(admin ? [admin] : []),
      ]),
    ],
    tokenHashes: [...new Set(deviceTokens.filter(Boolean).map(hashDeviceToken))],
    supplierNames: [
      ...REFERENCE_DATA.suppliers.map((s) => s.name),
      ...DEMO_SUPPLIERS.map((s) => s.name),
    ],
    defectTypeKeys: [
      ...new Set([
        ...REFERENCE_DATA.defectTypes.map((d) => d.key),
        ...MODEL_DEFECT_TYPES.map((d) => d.key),
      ]),
    ],
  };
}

/** What a reset would remove, without changing anything. */
export function previewReset(keep: ResetKeep): Promise<ResetCounts> {
  return countResetTargets(keep);
}

export type ResetResult = {
  removed: ResetCounts;
  demoWeek: Awaited<ReturnType<typeof seedDemoWeek>> | null;
};

export type ResetOptions = {
  demoWeek?: boolean;
  now?: Date;
  /** Where the reset was started, kept in its audit row: the command line or the login page. */
  origin?: "command line" | "login page";
  /**
   * Run even with NODE_ENV=production. Only Reset demo data on the login page passes it, and only
   * while DEMO_LOGIN_TOOLS is on (D-101); the command line keeps refusing (D-056).
   */
  allowInProduction?: boolean;
};

export async function resetDemoData(
  keep: ResetKeep,
  options: ResetOptions = {},
): Promise<ResetResult> {
  if (getEnv().NODE_ENV === "production" && !options.allowInProduction)
    throw new Error("demo:reset refuses to run with NODE_ENV=production.");
  const removed = await countResetTargets(keep);
  await runInTransaction(
    async (tx) => {
      await deleteResetTargets(keep, tx);
      // The demo week adds its leather items for the demo suppliers, so they must be on.
      const suppliersReactivated = await reactivateSuppliers(keep.supplierNames, tx);
      // The audit log starts again with this row first, so anyone can see when and what was reset;
      // the default lunch and the defect types it sets come after it.
      await recordAudit(tx, {
        actor: { type: "SYSTEM" },
        action: "system.demo_reset",
        entity: "System",
        entityId: "demo-reset",
        before: removed,
        after: {
          origin: options.origin ?? "command line",
          keptAccounts: keep.emails,
          keptDeviceTokens: keep.tokenHashes.length,
          suppliersReactivated,
          defectTypes: MODEL_DEFECT_TYPES.map((d) => ({
            key: d.key,
            isActive: d.isActive,
            outcome: d.outcome,
            notAcceptedFromIn: d.notAcceptedFromIn,
            flatSharePct: d.flatSharePct,
          })),
        },
      });
      // The default schedule (Monday to Friday, D-105) and lunch, in force from the start: the old
      // batches are gone (Phase 27).
      await ensureDefaultSchedule(tx);
      await ensureDefaultLunchBreak(tx, options.now);
      for (const type of MODEL_DEFECT_TYPES) await upsertDefectTypeState(type, tx);
      // Accounts made before the demo names (D-090) get them; the constructors list has its own.
      await setDemoAccountNames(
        DEMO_USERS.filter((u) => u.name).map((u) => ({ email: u.email, name: u.name })),
        tx,
      );
    },
    { timeoutMs: 120_000 },
  );
  // Scan images, and the proof-of-delivery files kept from before Phase 24 (D-091).
  await clearUploadFolders(["scans", "pod"]);
  await ensureDemoConstructors(options.now);
  const demoWeek = options.demoWeek === false ? null : await seedDemoWeek({ now: options.now });
  await ensureDemoInventory();
  return { removed, demoWeek };
}
