import { createHash, randomBytes } from "node:crypto";

/**
 * Device tokens let a camera machine call the API without a person's session.
 * Format: "cpt_" + 32 random bytes (base64url). Only the SHA-256 hash is stored; the plain token is
 * shown once when created. The first 12 characters are kept so admins can tell tokens apart.
 */
export const DEVICE_TOKEN_PREFIX = "cpt_";
export const DEVICE_SCOPES = ["scans:create"] as const;
export type DeviceScope = (typeof DEVICE_SCOPES)[number];

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateDeviceToken(): { token: string; hash: string; prefix: string } {
  const token = `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashDeviceToken(token), prefix: token.slice(0, 12) };
}

/** "Bearer cpt_…" → "cpt_…", or null for anything else. */
export function parseBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  return token?.startsWith(DEVICE_TOKEN_PREFIX) ? token : null;
}
