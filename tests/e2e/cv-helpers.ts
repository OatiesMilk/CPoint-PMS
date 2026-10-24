import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, request, type Browser, type APIRequestContext } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";
import { ACCOUNTS, signIn } from "./helpers";

export async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** A device token straight in the DB (same format and hashing as the app), owned by an admin. */
export async function createDeviceToken(
  name = `E2E device ${Date.now()}`,
): Promise<{ token: string; id: string }> {
  const token = `cpt_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  const id = await withDb(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO api_tokens (id, name, "tokenPrefix", "tokenHash", scopes, "createdById")
       SELECT gen_random_uuid(), $1, $2, $3, ARRAY['scans:create'], id FROM users
       WHERE role = 'SYSTEM_ADMIN' AND "isActive" ORDER BY "createdAt" LIMIT 1 RETURNING id`,
      [name, token.slice(0, 12), hash],
    );
    return rows[0].id as string;
  });
  return { token, id };
}

export async function shoeTypeId(): Promise<string> {
  return withDb(
    async (db) => (await db.query(`SELECT id FROM shoe_types WHERE code = 'SCH'`)).rows[0].id,
  );
}

/**
 * An API client signed in as the given account. It signs in through the real form, then keeps only
 * the session cookie in a standalone request context and closes the page: an open page per call
 * kept a browser renderer alive until the worker ended, and those piled up over a full run until
 * Chromium crashed.
 */
async function apiAs(
  browser: Browser,
  account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS],
): Promise<APIRequestContext> {
  const page = await browser.newPage();
  try {
    await page.goto("/login");
    await signIn(page, account.email);
    await expect(page).toHaveURL(account.home);
    const { origin } = new URL(page.url());
    const storageState = await page.context().storageState();
    return await request.newContext({ baseURL: origin, storageState });
  } finally {
    await page.close();
  }
}

export function managerApi(browser: Browser): Promise<APIRequestContext> {
  return apiAs(browser, ACCOUNTS.manager);
}

export function adminApi(browser: Browser): Promise<APIRequestContext> {
  return apiAs(browser, ACCOUNTS.admin);
}

/** Flagged scans are the Quality Inspector's to decide (D-028). */
export function inspectorApi(browser: Browser): Promise<APIRequestContext> {
  return apiAs(browser, ACCOUNTS.inspector);
}

export async function createBatch(
  api: APIRequestContext,
  start = true,
): Promise<{ id: string; code: string }> {
  const res = await api.post("/api/v1/batches", {
    data: {
      rollCode: `E2E-CV-${randomBytes(3).toString("hex").toUpperCase()}`,
      shoeTypeId: await shoeTypeId(),
      receivedAt: "2026-01-15",
    },
  });
  expect(res.status()).toBe(201);
  const { id, code } = (await res.json()).data;
  if (start) {
    const s = await api.post(`/api/v1/batches/${id}/stages`, {
      data: { action: "start", expectedStage: "PREPARATION" },
    });
    expect(s.status()).toBe(200);
  }
  return { id, code };
}

let jpeg: Buffer | undefined;
export async function sampleJpeg(): Promise<Buffer> {
  jpeg ??= await sharp({ create: { width: 64, height: 48, channels: 3, background: "#7a4a26" } })
    .jpeg()
    .toBuffer();
  return jpeg;
}

/**
 * The tests post "cut", "hole", "abrasion" and "dirt" and expect the confidence rule (D-011). The
 * database's own types may differ (npm run demo:reset turns abrasion and dirt off and gives cut
 * and hole a "When found" action, D-053, D-056), so the tests post their own copies instead:
 * active, with no action, whatever Settings say.
 */
const RULE_KEYS = ["cut", "hole", "abrasion", "dirt"];
export const e2eKey = (key: string) => (RULE_KEYS.includes(key) ? `e2e-rule-${key}` : key);

let ruleTypes: Promise<void> | undefined;
export function ensureRuleTypes(): Promise<void> {
  ruleTypes ??= withDb(async (db) => {
    for (const [i, key] of RULE_KEYS.entries()) {
      await db.query(
        `INSERT INTO defect_types (id, key, label, "isActive", action, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NULL, $4, now(), now())
         ON CONFLICT (key) DO UPDATE SET "isActive" = true, action = NULL`,
        [randomUUID(), e2eKey(key), `E2E ${key}`, 900 + i],
      );
    }
  });
  return ruleTypes;
}

export type Det = {
  classKey: string;
  confidence: number;
  box?: { x: number; y: number; width: number; height: number };
};

export async function postScan(
  request: APIRequestContext,
  token: string,
  batchId: string,
  detections: Det[],
  image?: Buffer,
) {
  await ensureRuleTypes();
  return request.post("/api/v1/scans", {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      image: { name: "capture.jpg", mimeType: "image/jpeg", buffer: image ?? (await sampleJpeg()) },
      detections: JSON.stringify(
        detections.map((d, i) => ({
          ...d,
          classKey: e2eKey(d.classKey),
          box: d.box ?? { x: 0.1 + i * 0.3, y: 0.2, width: 0.2, height: 0.2 },
        })),
      ),
      batchId,
      source: "SIMULATOR",
    },
  });
}

/**
 * A fresh Shoe Constructor account (tests run in parallel, so none of them toggles the shared demo
 * constructor). It reuses the demo constructor's password hash, so it signs in with the demo
 * password.
 */
export async function makeConstructor(): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `sc-${randomBytes(4).toString("hex")}@e2e.local`;
  await withDb((db) =>
    db.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "updatedAt")
       SELECT $1, $2, $3, "passwordHash", 'SHOE_CONSTRUCTOR', now() FROM users
       WHERE email = 'constructor@cpoint.local'`,
      [id, `E2E Constructor ${email.slice(3, 11)}`, email],
    ),
  );
  return { id, email };
}
