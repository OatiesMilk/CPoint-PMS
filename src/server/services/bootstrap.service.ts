import { randomBytes } from "node:crypto";
import { ensureDefaultSchedule } from "./production.service";
import type { Role } from "@/lib/domain";
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
import { findInventoryItemBySku } from "@/server/models/inventory.model";
import { recordAudit } from "./audit.service";
import { DEMO_INVENTORY, seedDemoWeek } from "./demo-seed.service";
import { createItem } from "./inventory.service";

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
    {
      key: "dirt",
      label: "Dirt",
      description: "Stain or dirt on the surface.",
      sortOrder: 4,
      handling: "CLEAN" as const, // cleaned before cutting, not cut around (D-070)
    },
  ],
  cvSettings: { rejectAtOrAbove: 0.9, reworkAtOrAbove: 0.6 }, // D-011
  suppliers: [
    { name: "Sample Leather Supplier", notes: "Placeholder; replace with real suppliers." },
  ],
};

/**
 * One account per role for dev, CI and demos, with the names people see in timelines, remarks and
 * the audit log (D-090). Sign-in uses the email; `demo:reset` puts these names back.
 */
export const DEMO_USERS: { email: string; name: string; role: Role }[] = [
  { email: "manager@cpoint.local", name: "Rodel Pascual", role: "FLOOR_MANAGER" },
  { email: "inspector@cpoint.local", name: "Maricel Dizon", role: "QUALITY_INSPECTOR" },
  { email: "admin@cpoint.local", name: "Jerome Salazar", role: "SYSTEM_ADMIN" },
  // Orders the leather rolls (survey: one staff member does) and may capture at the camera.
  { email: "constructor@cpoint.local", name: "Noel Manalo", role: "SHOE_CONSTRUCTOR" },
];

/**
 * The line's demo Shoe Constructors (D-081, D-090), so Attendance has a believable roster. They
 * never sign in: each gets a random password nobody sees. Kept by `demo:reset`.
 */
export const DEMO_CONSTRUCTORS: { name: string; email: string }[] = [
  { name: "Arnel Bautista", email: "arnel.bautista@cpoint.local" },
  { name: "Jocelyn Reyes", email: "jocelyn.reyes@cpoint.local" },
  { name: "Rommel Dela Cruz", email: "rommel.delacruz@cpoint.local" },
  { name: "Edwin Santos", email: "edwin.santos@cpoint.local" },
  { name: "Marites Villanueva", email: "marites.villanueva@cpoint.local" },
  { name: "Ronaldo Aquino", email: "ronaldo.aquino@cpoint.local" },
  { name: "Lorna Mendoza", email: "lorna.mendoza@cpoint.local" },
  { name: "Jessie Tolentino", email: "jessie.tolentino@cpoint.local" },
  { name: "Wilfredo Ramos", email: "wilfredo.ramos@cpoint.local" },
  { name: "Analyn Garcia", email: "analyn.garcia@cpoint.local" },
  { name: "Danilo Navarro", email: "danilo.navarro@cpoint.local" },
  { name: "Cristina Soriano", email: "cristina.soriano@cpoint.local" },
];

/** How far back the demo accounts are dated, so they are on every demo-week day. */
const DEMO_ACCOUNT_AGE_DAYS = 30;

/**
 * Shoe types, defect types, CV thresholds, a sample supplier and the default check-in schedule
 * (D-083). Never overwrites existing rows.
 */
export async function ensureReferenceData(): Promise<void> {
  await runInTransaction(async (tx) => {
    for (const shoeType of REFERENCE_DATA.shoeTypes) await ensureShoeType(shoeType, tx);
    for (const defectType of REFERENCE_DATA.defectTypes) await ensureDefectType(defectType, tx);
    for (const supplier of REFERENCE_DATA.suppliers) await ensureSupplier(supplier, tx);
    await ensureCvSettings(REFERENCE_DATA.cvSettings, tx);
    await ensureDefaultSchedule(tx);
  });
}

async function createUserWithAudit(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  canRequestLeatherRolls?: boolean;
  createdAt?: Date;
}): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  await runInTransaction(async (tx) => {
    const user = await createUser(
      {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
        canRequestLeatherRolls: input.canRequestLeatherRolls ?? false,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
      tx,
    );
    await recordAudit(tx, {
      actor: SYSTEM,
      action: "user.create",
      entity: "User",
      entityId: user.id,
      after: {
        email: user.email,
        role: user.role,
        ...(input.canRequestLeatherRolls ? { canRequestLeatherRolls: true } : {}),
        source: "bootstrap",
      },
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

/**
 * One account per role for dev, CI and demos. Opt-in; never resets an existing account. Dated
 * back like the constructors, so the FM and QI are on the demo week's attendance (D-090).
 */
export async function ensureDemoUsers(now: Date = new Date()): Promise<number> {
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
      name: demo.name,
      email: demo.email,
      createdAt: new Date(now.getTime() - DEMO_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000),
      password: DEMO_USER_PASSWORD,
      role: demo.role,
      // The demo constructor can also request leather rolls (D-031). Set only when the account is
      // created, so a Floor Manager who stops it isn't overridden on the next start.
      canRequestLeatherRolls: demo.role === "SHOE_CONSTRUCTOR",
    });
    created += 1;
  }
  if (created > 0) logger.info({ created }, "Created demo users");
  return created;
}

/**
 * The demo constructors (D-081), opt-in with the demo users. Only missing ones are created, with a
 * random password and an account dated 30 days back; existing ones are never touched.
 */
export async function ensureDemoConstructors(now: Date = new Date()): Promise<number> {
  if (!getEnv().SEED_DEMO_USERS) return 0;
  const createdAt = new Date(now.getTime() - DEMO_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000);
  let created = 0;
  for (const person of DEMO_CONSTRUCTORS) {
    if (await findUserByEmail(person.email)) continue;
    await createUserWithAudit({
      ...person,
      password: randomBytes(24).toString("base64url"),
      role: "SHOE_CONSTRUCTOR",
      createdAt,
    });
    created += 1;
  }
  if (created > 0) logger.info({ created }, "Created demo Shoe Constructors");
  return created;
}

/** Opt-in with the demo users. Adds only the codes that don't exist yet; never touches stock. */
export async function ensureDemoInventory(): Promise<number> {
  if (!getEnv().SEED_DEMO_USERS) return 0;
  const manager = await findUserByEmail("manager@cpoint.local");
  if (!manager) return 0;
  let created = 0;
  for (const item of DEMO_INVENTORY) {
    if (await findInventoryItemBySku(item.sku)) continue;
    await createItem({ ...item }, manager);
    created += 1;
  }
  if (created > 0) logger.info({ created }, "Created demo inventory items");
  return created;
}

/**
 * A past week of production for demos (D-026). Opt-in with SEED_DEMO_WEEK; runs only on a
 * database with no batches, so restarts never add another week.
 */
export async function ensureDemoWeek(): Promise<void> {
  const { SEED_DEMO_WEEK, SEED_DEMO_USERS } = getEnv();
  if (!SEED_DEMO_WEEK) return;
  if (!SEED_DEMO_USERS) {
    logger.warn("SEED_DEMO_WEEK needs SEED_DEMO_USERS=true; skipping the demo week.");
    return;
  }
  const result = await seedDemoWeek();
  if (!result.seeded) logger.info({ reason: result.reason }, "Demo week not seeded");
}

/**
 * Everything the system needs to be usable. Safe to run on every start.
 *
 * The demo week (~30 s) runs in the background when the server starts, so the app and its
 * healthcheck come up straight away; the week fills in within a minute. `npm run db:seed` waits.
 */
export async function bootstrap(options: { demoWeekInBackground?: boolean } = {}): Promise<void> {
  await ensureReferenceData();
  await ensureDemoUsers();
  await ensureDemoConstructors();
  const demoWeek = ensureDemoWeek().then(ensureDemoInventory);
  if (options.demoWeekInBackground) {
    demoWeek.catch((error) => logger.error({ err: error }, "Demo week failed"));
  } else {
    await demoWeek;
  }
  await ensureAdmin();
}
