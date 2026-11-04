import type { Role } from "./domain";

/**
 * Account and settings rules for the System Admin (D-024). Pure and client-safe: the UI uses them
 * to disable buttons with a reason, and the services enforce them.
 */

export type Result = { ok: true } | { ok: false; reason: string };

// No look-alikes (0/O, 1/l/I) so a temporary password can be read out or copied by hand.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TEMP_PASSWORD_LENGTH = 12;

/** A random temporary password, shown to the admin once. Uses the platform CSPRNG. */
export function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH): string {
  const out: string[] = [];
  const bytes = new Uint8Array(1);
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < length) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) out.push(ALPHABET[bytes[0] % ALPHABET.length]);
  }
  return out.join("");
}

export const TEMP_PASSWORD_ALPHABET = ALPHABET;

type Account = { id: string; role: Role; isActive: boolean };

/**
 * Whether `actorId` may change `target` this way. The admin can't lock themselves out, and the
 * last active System Admin can never be deactivated or demoted (there'd be no way back in except
 * the bootstrap env).
 */
export function checkAccountChange(
  actorId: string,
  target: Account,
  change: { role?: Role; isActive?: boolean },
  activeAdmins: number,
): Result {
  const deactivating = change.isActive === false && target.isActive;
  const demoting = change.role !== undefined && change.role !== target.role;
  if (target.id === actorId) {
    if (deactivating) return { ok: false, reason: "You can't deactivate your own account." };
    if (demoting) return { ok: false, reason: "You can't change your own role." };
  }
  const removesAnAdmin =
    target.role === "SYSTEM_ADMIN" && target.isActive && (deactivating || demoting);
  if (removesAnAdmin && activeAdmins <= 1) {
    return {
      ok: false,
      reason: "This is the last active System Admin. Make another account a System Admin first.",
    };
  }
  return { ok: true };
}

// ───────────── CV rule ─────────────

export const FOUND_AT_MESSAGE = "Enter the found-at value as a percentage from 1 to 100, like 50.";

/**
 * Validates "A defect counts as found at" given as a fraction (0.5 = 50%), the one number the
 * Pass or Reject rule has (D-053, D-093).
 */
export function validateFoundAt(foundAtOrAbove: number) {
  const ok = Number.isFinite(foundAtOrAbove) && foundAtOrAbove >= 0.01 && foundAtOrAbove <= 1;
  return ok ? [] : [{ path: ["foundAtOrAbove"] as const, message: FOUND_AT_MESSAGE }];
}

export const RETURN_LIMIT_MESSAGE =
  "Enter a percentage from 1 to 100, like 10 (one decimal at most).";

/** "Mark a roll Returned to supplier when defects cover more than __%" (Phase 30C, C-9; D-116). */
export function validateReturnLimit(pct: number) {
  const ok =
    Number.isFinite(pct) &&
    pct >= 1 &&
    pct <= 100 &&
    Math.abs(pct * 10 - Math.round(pct * 10)) < 1e-6;
  return ok ? [] : [{ path: ["returnPercent"] as const, message: RETURN_LIMIT_MESSAGE }];
}

export const LENGTH_LIMIT_MESSAGE =
  "Enter the length in inches from 0.1 to 100, like 3, or leave it blank for no length limit.";
export const FLAT_SHARE_MESSAGE =
  "Enter the flat share as a percentage from 0.1 to 100, like 1, or leave it blank to count the defect's box area.";

// ───────────── audit diff ─────────────

export type DiffRow = { key: string; before: unknown; after: unknown };

/** The keys whose values differ between an audit row's before and after (shallow, sorted). */
export function auditDiff(before: unknown, after: unknown): DiffRow[] {
  const a = isRecord(before) ? before : {};
  const b = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((key) => ({ key, before: a[key], after: b[key] }));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
