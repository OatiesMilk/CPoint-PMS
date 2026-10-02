import { ROLE_LABELS, type Role } from "@/lib/domain";
import { getEnv } from "@/server/lib/env";
import { logger } from "@/server/lib/logger";
import { hashPassword } from "@/server/lib/password";
import { runInTransaction } from "@/server/models/db";
import {
  ensureCvSettings,
  ensureDefectType,
  ensureShoeType,
  ensureSupplier,
} from "@/server/models/reference-data.model";
import { countActiveUsersWithRole, createUser, findUserByEmail } from "@/server/models/user.model";
import { recordAudit } from "./audit.service";

const SYSTEM = { type: "SYSTEM" } as const;

export const REFERENCE_DATA = {
  shoeTypes: [
    { code: "SCH", name: "School Shoe", sortOrder: 1 },
    { code: "TOP", name: "Topsider", sortOrder: 2 },
  ],
  // Placeholder classes until the YOLO model is retrained (see docs/STATUS.md).
  defectTypes: [
    {
      key: "cut",
      label: "Cut",
      description: "Slit or cut through the leather surface.",
      sortOrder: 1,
    },
    { key: "hole", label: "Hole", description: "Puncture or hole in the leather.", sortOrder: 2 },
    { key: "abrasion", label: "Abrasion", description: "Scuffed or worn grain.", sortOrder: 3 },
    { key: "dirt", label: "Dirt", description: "Stain or dirt on the surface.", sortOrder: 4 },
  ],
  cvSettings: { rejectAtOrAbove: 0.9, reworkAtOrAbove: 0.6 }, // D-011
  suppliers: [
    { name: "Sample Leather Supplier", notes: "Placeholder; replace with real suppliers." },
  ],
};

export const DEMO_USERS: { email: string; role: Role }[] = [
  { email: "manager@cpoint.local", role: "FLOOR_MANAGER" },
  { email: "inspector@cpoint.local", role: "QUALITY_INSPECTOR" },
  { email: "admin@cpoint.local", role: "SYSTEM_ADMIN" },
  { email: "constructor@cpoint.local", role: "SHOE_CONSTRUCTOR" },
];

/** Shoe types, defect types, CV thresholds and a sample supplier. Never overwrites existing rows. */
export async function ensureReferenceData(): Promise<void> {
  await runInTransaction(async (tx) => {
    for (const shoeType of REFERENCE_DATA.shoeTypes) await ensureShoeType(shoeType, tx);
    for (const defectType of REFERENCE_DATA.defectTypes) await ensureDefectType(defectType, tx);
    for (const supplier of REFERENCE_DATA.suppliers) await ensureSupplier(supplier, tx);
    await ensureCvSettings(REFERENCE_DATA.cvSettings, tx);
  });
}

async function createUserWithAudit(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  await runInTransaction(async (tx) => {
    const user = await createUser(
      { name: input.name, email: input.email.toLowerCase(), passwordHash, role: input.role },
      tx,
    );
    await recordAudit(tx, {
      actor: SYSTEM,
      action: "user.create",
      entity: "User",
      entityId: user.id,
      after: { email: user.email, role: user.role, source: "bootstrap" },
    });
  });
}

export type AdminBootstrapResult = "exists" | "created" | "missing-config" | "email-taken";

/** Guarantees a way into the system: creates the first System Admin from env when none is active. */
export async function ensureAdmin(): Promise<AdminBootstrapResult> {
  if ((await countActiveUsersWithRole("SYSTEM_ADMIN")) > 0) return "exists";

  const { BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password } = getEnv();
  if (!email || !password) {
    logger.warn(
      "No active System Admin. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD and restart.",
    );
    return "missing-config";
  }
  if (await findUserByEmail(email.toLowerCase())) {
    logger.warn(
      { email },
      "BOOTSTRAP_ADMIN_EMAIL belongs to an existing (inactive or non-admin) user",
    );
    return "email-taken";
  }
  await createUserWithAudit({ name: "System Admin", email, password, role: "SYSTEM_ADMIN" });
  logger.info({ email }, "Created bootstrap System Admin");
  return "created";
}

/** One account per role for dev, CI and demos. Opt-in; never resets an existing account. */
export async function ensureDemoUsers(): Promise<number> {
  const { SEED_DEMO_USERS, DEMO_USER_PASSWORD } = getEnv();
  if (!SEED_DEMO_USERS) return 0;
  if (!DEMO_USER_PASSWORD) {
    logger.warn("SEED_DEMO_USERS is on but DEMO_USER_PASSWORD is not set; skipping demo users.");
    return 0;
  }
  let created = 0;
  for (const demo of DEMO_USERS) {
    if (await findUserByEmail(demo.email)) continue;
    await createUserWithAudit({
      name: `Demo ${ROLE_LABELS[demo.role]}`,
      email: demo.email,
      password: DEMO_USER_PASSWORD,
      role: demo.role,
    });
    created += 1;
  }
  if (created > 0) logger.info({ created }, "Created demo users");
  return created;
}

/** Everything the system needs to be usable. Safe to run on every start. */
export async function bootstrap(): Promise<void> {
  await ensureReferenceData();
  await ensureDemoUsers();
  await ensureAdmin();
}
