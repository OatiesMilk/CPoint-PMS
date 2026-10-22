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

// ───────────── CV thresholds ─────────────

/**
 * Validates thresholds given as fractions (0.9 = 90%). Rework must stay below Reject (D-011);
 * the found-at value (D-053) only needs to be a real percentage.
 */
export function validateThresholds(t: {
  rejectAtOrAbove: number;
  reworkAtOrAbove: number;
  foundAtOrAbove?: number;
}) {
  const errors: {
    path: ["rejectAtOrAbove" | "reworkAtOrAbove" | "foundAtOrAbove"];
    message: string;
  }[] = [];
  const pct = (n: number) => Math.round(n * 1000) / 10;
  if (!(t.rejectAtOrAbove > 0 && t.rejectAtOrAbove <= 1))
    errors.push({ path: ["rejectAtOrAbove"], message: "Use a value above 0% and up to 100%." });
  if (!(t.reworkAtOrAbove > 0 && t.reworkAtOrAbove < 1))
    errors.push({ path: ["reworkAtOrAbove"], message: "Use a value above 0% and below 100%." });
  if (errors.length === 0 && t.reworkAtOrAbove >= t.rejectAtOrAbove)
    errors.push({
      path: ["reworkAtOrAbove"],
      message: `Fixable must start below Reject (${pct(t.rejectAtOrAbove)}%).`,
    });
  if (t.foundAtOrAbove !== undefined && !(t.foundAtOrAbove > 0 && t.foundAtOrAbove < 1))
    errors.push({ path: ["foundAtOrAbove"], message: "Use a value above 0% and below 100%." });
  return errors;
}

/** "≥ 90% → Reject · 60–89.9% → Fixable · below 60% → Pass" for the settings page. */
export function describeThresholds(t: { rejectAtOrAbove: number; reworkAtOrAbove: number }) {
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  const below = Math.round(t.rejectAtOrAbove * 1000 - 1) / 10;
  return {
    reject: `${pct(t.rejectAtOrAbove)} and above`,
    rework: `${pct(t.reworkAtOrAbove)} to ${below}%`,
    pass: `below ${pct(t.reworkAtOrAbove)}`,
  };
}

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
