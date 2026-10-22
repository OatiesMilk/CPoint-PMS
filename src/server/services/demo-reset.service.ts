import type { DefectAction, DefectHandling } from "@/generated/prisma/client";
import { hashDeviceToken } from "@/server/lib/device-token";
import { getEnv } from "@/server/lib/env";
import { clearUploadFolders } from "@/server/lib/storage";
import { runInTransaction } from "@/server/models/db";
import {
  countResetTargets,
  deleteResetTargets,
  setDemoAccountNames,
  setLeatherRollRequester,
  upsertDefectTypeState,
  type ResetCounts,
  type ResetKeep,
} from "@/server/models/demo-reset.model";
import { recordAudit } from "./audit.service";
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
 * camera station keeps working), the bootstrap shoe types and suppliers, and the defect types.
 * Removes everything else: test accounts and tokens, batches, scans, repairs, salvage, stock
 * movements and items, purchase requests with their files, the audit log, and the image and proof
 * files on disk. Then it sets the camera model's classes (D-052, D-053) and, unless told not to,
 * seeds a fresh demo week, which puts the demo inventory back at its opening stock.
 */

/**
 * The yolo-v1 classes as the demo uses them: the model's four active with "When found" actions,
 * the two placeholder types it never sends turned off (D-052, D-053). Data the reset writes, like
 * the bootstrap's reference data; the System Admin can change all of it in Settings afterwards.
 */
export const MODEL_DEFECT_TYPES: {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  action: DefectAction | null;
  handling: DefectHandling;
}[] = [
  {
    key: "cut",
    label: "Cut",
    description: "Slit or cut through the leather surface.",
    sortOrder: 1,
    isActive: true,
    action: "REJECT",
    handling: "CUT_AROUND",
  },
  {
    key: "hole",
    label: "Hole",
    description: "Puncture or hole in the leather.",
    sortOrder: 2,
    isActive: true,
    action: "REJECT",
    handling: "CUT_AROUND",
  },
  {
    key: "crease",
    label: "Crease",
    description: "A fold line pressed into the grain.",
    sortOrder: 3,
    isActive: true,
    action: "REWORK",
    handling: "CUT_AROUND",
  },
  {
    key: "scratch",
    label: "Scratch",
    description: "A surface scratch that doesn't go through.",
    sortOrder: 4,
    isActive: true,
    action: "REWORK",
    handling: "CUT_AROUND",
  },
  {
    key: "abrasion",
    label: "Abrasion",
    description: "Scuffed or worn grain.",
    sortOrder: 5,
    isActive: false,
    action: null,
    handling: "CUT_AROUND",
  },
  {
    key: "dirt",
    label: "Dirt",
    description: "Stain or dirt on the surface.",
    sortOrder: 6,
    isActive: false,
    action: null,
    handling: "CLEAN",
  },
];

const DEMO_LEATHER_REQUESTER = "constructor@cpoint.local";

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
    shoeTypeCodes: REFERENCE_DATA.shoeTypes.map((s) => s.code),
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

export async function resetDemoData(
  keep: ResetKeep,
  options: { demoWeek?: boolean; now?: Date } = {},
): Promise<ResetResult> {
  if (getEnv().NODE_ENV === "production")
    throw new Error("demo:reset refuses to run with NODE_ENV=production.");
  const removed = await countResetTargets(keep);
  await runInTransaction(
    async (tx) => {
      await deleteResetTargets(keep, tx);
      for (const type of MODEL_DEFECT_TYPES) await upsertDefectTypeState(type, tx);
      await setLeatherRollRequester(DEMO_LEATHER_REQUESTER, true, tx);
      // Accounts made before the demo names (D-090) get them; the constructors list has its own.
      await setDemoAccountNames(
        DEMO_USERS.filter((u) => u.name).map((u) => ({ email: u.email, name: u.name })),
        tx,
      );
      // The audit log starts again with this one row, so anyone can see when and what was reset.
      await recordAudit(tx, {
        actor: { type: "SYSTEM" },
        action: "system.demo_reset",
        entity: "System",
        entityId: "demo-reset",
        before: removed,
        after: {
          keptAccounts: keep.emails,
          keptDeviceTokens: keep.tokenHashes.length,
          defectTypes: MODEL_DEFECT_TYPES.map((d) => ({
            key: d.key,
            isActive: d.isActive,
            action: d.action,
          })),
        },
      });
    },
    { timeoutMs: 120_000 },
  );
  await clearUploadFolders(["scans", "pod"]);
  await ensureDemoConstructors(options.now);
  const demoWeek = options.demoWeek === false ? null : await seedDemoWeek({ now: options.now });
  await ensureDemoInventory();
  return { removed, demoWeek };
}
