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

/** The first active supplier (a leather item's rolls are coded from its short code). */
export async function supplierId(): Promise<string> {
  return withDb(
    async (db) =>
      (await db.query(`SELECT id FROM suppliers WHERE "isActive" ORDER BY name LIMIT 1`)).rows[0]
        .id,
  );
}

/**
 * Adds one leather roll to Inventory as the Floor Manager would (Phase 30A, D-104): an e2e leather
 * item per supplier (LR-E2E-<code>), the next LR-<code>-NNN code, the roll In stock with its area,
 * and +1 on the ledger, all in one transaction, so stock still equals the ledger.
 */
export async function addInventoryRoll(
  options: { supplierId?: string; tagCode?: string; areaSqFt?: number } = {},
): Promise<{ id: string; code: string; itemId: string }> {
  const supplier = options.supplierId ?? (await supplierId());
  return withDb(async (db) => {
    await db.query("BEGIN");
    try {
      const { code: supplierCode } = (
        await db.query(`SELECT code FROM suppliers WHERE id = $1`, [supplier])
      ).rows[0];
      const fm = (
        await db.query(
          `SELECT id FROM users WHERE role = 'FLOOR_MANAGER' AND "isActive" ORDER BY "createdAt" LIMIT 1`,
        )
      ).rows[0].id as string;
      // An item of its own per roll, so tests running in parallel never share a count (QA 30A F2).
      const sku = `LR-E2E-${supplierCode}-${randomBytes(2).toString("hex").toUpperCase()}`;
      await db.query(
        `INSERT INTO inventory_items (id, sku, name, category, unit, "quantityOnHand", "reorderLevel",
           "isActive", "updatedAt", "supplierId")
         VALUES (gen_random_uuid(), $1, $2, 'LEATHER_ROLL', 'roll', 0, 0, true, now(), $3)
         ON CONFLICT (sku) DO NOTHING`,
        [sku, `E2E leather ${sku}`, supplier],
      );
      const itemId = (
        await db.query(`SELECT id FROM inventory_items WHERE sku = $1 FOR UPDATE`, [sku])
      ).rows[0].id as string;
      const prefix = `LR-${supplierCode}`;
      let code = "";
      for (;;) {
        const n = (
          await db.query(
            `INSERT INTO roll_code_sequences ("prefix", "lastValue") VALUES ($1, 1)
             ON CONFLICT ("prefix") DO UPDATE SET "lastValue" = roll_code_sequences."lastValue" + 1
             RETURNING "lastValue"`,
            [prefix],
          )
        ).rows[0].lastValue as number;
        code = `${prefix}-${String(n).padStart(3, "0")}`;
        if ((await db.query(`SELECT 1 FROM batches WHERE code = $1`, [code])).rowCount === 0) break;
      }
      const id = randomUUID();
      await db.query(
        `INSERT INTO batches (id, code, "rollCode", "supplierId", "itemId", "areaSqFt", "receivedAt",
           status, "createdById", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, date_trunc('day', now()), 'IN_STOCK', $7, now())`,
        [
          id,
          code,
          options.tagCode ?? `E2E-${randomBytes(3).toString("hex").toUpperCase()}`,
          supplier,
          itemId,
          options.areaSqFt ?? 24.5,
          fm,
        ],
      );
      await db.query(
        `INSERT INTO inventory_movements (id, "itemId", type, "quantityDelta", reason, "batchId", "createdById")
         VALUES (gen_random_uuid(), $1, 'IN', 1, $2, $3, $4)`,
        [itemId, `Roll ${code} added`, id, fm],
      );
      await db.query(
        `UPDATE inventory_items SET "quantityOnHand" = "quantityOnHand" + 1, "updatedAt" = now()
         WHERE id = $1`,
        [itemId],
      );
      await db.query("COMMIT");
      return { id, code, itemId };
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  });
}

/**
 * An API client signed in as the given account. It signs in through the real form, then keeps only
 * the session cookie in a standalone request context and closes the page: an open page per call
 * kept a browser renderer alive until the worker ended, and those piled up over a full run until
 * Chromium crashed.
 */
async function apiAs(
  browser: Browser,
  account: { email: string; home: string },
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

/** The Quality Inspector's API client. */
export function inspectorApi(browser: Browser): Promise<APIRequestContext> {
  return apiAs(browser, ACCOUNTS.inspector);
}

/**
 * An API client for a fresh Shoe Constructor with camera access (Phase 26: only they start, capture
 * and finish rolls). Each call makes its own account, so parallel tests never share one.
 */
export async function captureApi(browser: Browser): Promise<APIRequestContext> {
  const sc = await makeConstructor({ canCapture: true });
  return apiAs(browser, { email: sc.email, home: "/camera/capture" });
}

/**
 * A roll being scanned (Phase 30A): added to Inventory, then picked at Capture by a constructor
 * with camera access (POST /api/v1/rolls/{id}/start). The roll is open.
 */
export async function createRoll(
  api: APIRequestContext,
  options: { supplierId?: string; tagCode?: string; areaSqFt?: number } = {},
): Promise<{ id: string; code: string; itemId: string }> {
  const roll = await addInventoryRoll(options);
  const res = await api.post(`/api/v1/rolls/${roll.id}/start`, { data: {} });
  expect(res.status()).toBe(200);
  return roll;
}

/** Finish roll at Capture (it needs at least one shot). */
export async function finishRoll(api: APIRequestContext, id: string) {
  const res = await api.post(`/api/v1/rolls/${id}/finish`, { data: {} });
  expect(res.status()).toBe(200);
}

let jpeg: Buffer | undefined;
export async function sampleJpeg(): Promise<Buffer> {
  jpeg ??= await sharp({ create: { width: 64, height: 48, channels: 3, background: "#7a4a26" } })
    .jpeg()
    .toBuffer();
  return jpeg;
}

/**
 * The tests post "cut", "hole", "abrasion" and "dirt" and expect Pass or Reject (D-093): cut and
 * hole Not accepted, abrasion and dirt Usable. The database's own types may differ (Settings, or
 * npm run demo:reset turning abrasion and dirt off), so the tests post their own copies instead:
 * active, with these outcomes, whatever Settings say.
 */
const RULE_TYPES = {
  cut: "NOT_ACCEPTED",
  hole: "NOT_ACCEPTED",
  abrasion: "USABLE",
  dirt: "USABLE",
} as const;
export const e2eKey = (key: string) => (key in RULE_TYPES ? `e2e-rule-${key}` : key);

let ruleTypes: Promise<void> | undefined;
export function ensureRuleTypes(): Promise<void> {
  ruleTypes ??= withDb(async (db) => {
    for (const [i, [key, outcome]] of Object.entries(RULE_TYPES).entries()) {
      await db.query(
        `INSERT INTO defect_types (id, key, label, "isActive", outcome, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4::"DefectOutcome", $5, now(), now())
         ON CONFLICT (key) DO UPDATE SET "isActive" = true, outcome = $4::"DefectOutcome"`,
        [randomUUID(), e2eKey(key), `E2E ${key}`, outcome, 900 + i],
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
  rollId: string,
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
      rollId,
      source: "SIMULATOR",
    },
  });
}

/**
 * A fresh Shoe Constructor account (tests run in parallel, so none of them toggles the shared demo
 * constructor). It reuses the demo constructor's password hash, so it signs in with the demo
 * password.
 */
export async function makeConstructor(
  options: { canCapture?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `sc-${randomBytes(4).toString("hex")}@e2e.local`;
  await withDb((db) =>
    db.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "canCapture", "updatedAt")
       SELECT $1, $2, $3, "passwordHash", 'SHOE_CONSTRUCTOR', $4, now() FROM users
       WHERE email = 'constructor@cpoint.local'`,
      [id, `E2E Constructor ${email.slice(3, 11)}`, email, options.canCapture ?? false],
    ),
  );
  return { id, email };
}
