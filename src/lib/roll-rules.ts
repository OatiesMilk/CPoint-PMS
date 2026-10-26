/**
 * A roll's rules. Since Phase 30A (D-103, D-104) the Floor Manager adds each leather roll to its
 * Inventory item with its own area; a Shoe Constructor with camera access picks it at Capture,
 * captures it shot by shot and finishes it once all of it is in; the Quality Inspector ticks it
 * Fully used at Finish batch, and only then does it leave stock. Several rolls may be open at
 * once; the Capture page's Roll dropdown says where each shot goes (Dylan, 24 Oct 2026). Pure, so
 * every move and refusal is unit-tested.
 */
import type { RollStatus } from "@/lib/domain";

export const ROLL_TAG_MAX = 40;
export const CANCEL_REASON_MAX = 200;
/** Rolls added in one save. */
export const ADD_ROLLS_MAX = 50;
/** Square feet. A cowhide is usually 15 to 60 (Dylan, 26 Oct 2026). */
export const AREA_MIN = 0.1;
export const AREA_MAX = 200;
/** Rolls ticked Fully used in one Finish batch. */
export const USED_ROLLS_MAX = 50;

export const ROLL_MESSAGES = {
  tagTooLong: `The supplier’s tag can be up to ${ROLL_TAG_MAX} characters.`,
  chooseRoll: "Choose the roll this shot belongs to.",
  noOpenRoll: "No roll is being scanned. Pick a roll on the Capture page first.",
  needsShot: "A roll needs at least one shot to finish. Put it back instead.",
  hasShots:
    "This roll has shots, so it can’t be put back. Finish it once all of it is scanned, or ask the Floor Manager.",
  removeReason: "Write why this roll is removed.",
  removeReasonTooLong: `The reason can be up to ${CANCEL_REASON_MAX} characters.`,
  stale: "Someone else changed this roll just now. Refresh to see where it is.",
  addAtLeastOne: "Add at least one roll.",
  tooMany: `Add at most ${ADD_ROLLS_MAX} rolls at a time.`,
  receivedOn: "Enter the day the rolls arrived, like 2026-10-26.",
  receivedInFuture: "The day the rolls arrived can’t be after today.",
} as const;

// ───────────── codes ─────────────

export const SUPPLIER_CODE_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;
export const SUPPLIER_CODE_MESSAGE =
  "Enter a short code of 2 to 6 capital letters or digits, starting with a letter, like MLT.";

/**
 * A supplier's suggested short code: the initials of the words that start with a letter, at most
 * six (Marikina Leather Trading → MLT; JM Leather Supply (Divisoria) → JLS). A name with fewer than
 * two such words takes its first three letters, or SUP. The migration fills existing suppliers the
 * same way.
 */
export function supplierCodeFromName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .map((w) => w[0].toUpperCase())
    .join("")
    .slice(0, 6);
  if (initials.length >= 2) return initials;
  const letters = name
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3);
  return letters.length >= 2 ? letters : "SUP";
}

/** The first code from `base`, base2, base3, … that isn't taken (case-insensitive). */
export function freeSupplierCode(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map((c) => c.toUpperCase()));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const code = `${base.slice(0, 5)}${n}`;
    if (!used.has(code)) return code;
  }
}

/** "LR-MLT" for supplier MLT: the prefix whose numbers run 001, 002, … */
export function rollCodePrefix(supplierCode: string): string {
  return `LR-${supplierCode}`;
}

/** "LR-MLT-007" (Phase 30A, Dylan 26 Oct 2026); R- and B- rolls from before keep their codes. */
export function formatRollCode(supplierCode: string, n: number): string {
  return `${rollCodePrefix(supplierCode)}-${String(n).padStart(3, "0")}`;
}

// ───────────── area ─────────────

export type AreaResult = { ok: true; value: number } | { ok: false; reason: string };

/** A roll's area in square feet from what was typed: 0.1 to 200, at most two decimals. */
export function parseArea(raw: unknown, rollNumber: number): AreaResult {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  const prefix = `Roll ${rollNumber}:`;
  if (text === "")
    return { ok: false, reason: `${prefix} enter its area in square feet, like 24.5.` };
  if (!/^\d+(\.\d+)?$/.test(text))
    return { ok: false, reason: `${prefix} enter the area as a number of square feet, like 24.5.` };
  const value = Number(text);
  if (value < AREA_MIN || value > AREA_MAX)
    return {
      ok: false,
      reason: `${prefix} the area must be between ${AREA_MIN} and ${AREA_MAX} sq ft. Check the stamp or the receipt.`,
    };
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    return { ok: false, reason: `${prefix} use at most two decimals, like 24.75.` };
  return { ok: true, value };
}

/** "24.5 sq ft" */
export function formatArea(sqFt: number | null | undefined): string {
  if (sqFt === null || sqFt === undefined) return "—";
  return `${Number(sqFt).toLocaleString("en-PH", { maximumFractionDigits: 2 })} sq ft`;
}

// ───────────── moves ─────────────

/** The line for a capture sent to a roll that was finished or put back meanwhile. */
export function rollClosedMessage(code: string): string {
  return `${code} isn’t being scanned any more, so this shot wasn’t saved. Choose another roll, or scan a new one.`;
}

export type Plan = { ok: true } | { ok: false; reason: string };

type RollState = {
  code?: string;
  status: RollStatus;
  /** The roll belongs to a leather item (added in Inventory, Phase 30A). */
  fromInventory?: boolean;
};

const where = (status: RollStatus, code = "This roll"): string =>
  ({
    IN_STOCK: `${code} hasn’t been scanned yet.`,
    OPEN: `${code} is being scanned at Capture.`,
    FINISHED: `${code} is already scanned.`,
    USED: `${code} is already marked fully used.`,
    CANCELLED: `${code} was removed.`,
  })[status];

const refuse = (reason: string): Plan => ({ ok: false, reason });

/** Pick a roll at Capture: only one in stock and not scanned yet. */
export function planStart(roll: RollState): Plan {
  if (roll.status === "IN_STOCK") return { ok: true };
  return refuse(`${where(roll.status, roll.code)} Choose another roll.`);
}

/** Finish: at Capture, once all of the roll is in. It needs at least one shot. */
export function planFinish(roll: RollState & { shots: number }): Plan {
  if (roll.status !== "OPEN") return refuse(where(roll.status, roll.code));
  if (roll.shots === 0) return refuse(ROLL_MESSAGES.needsShot);
  return { ok: true };
}

/**
 * Put back at Capture: a roll picked by mistake, with no shots yet. A roll from Inventory goes
 * back to the rolls waiting to be scanned; one from before Phase 30A is cancelled, as then.
 */
export function planPutBack(roll: RollState & { shots: number }): Plan {
  if (roll.status !== "OPEN") return refuse(where(roll.status, roll.code));
  if (roll.shots > 0) return refuse(ROLL_MESSAGES.hasShots);
  return { ok: true };
}

/**
 * Remove (the Floor Manager, with a reason, checked by the validator): a roll from Inventory that
 * isn't fully used, e.g. damaged, lost or added by mistake; it leaves stock. A roll from before
 * Phase 30A can be removed only while it is open, as the old Cancel. Nothing is deleted.
 */
export function planRemove(roll: RollState): Plan {
  if (roll.fromInventory) {
    if (roll.status === "USED" || roll.status === "CANCELLED")
      return refuse(where(roll.status, roll.code));
    return { ok: true };
  }
  if (roll.status !== "OPEN") return refuse(where(roll.status, roll.code));
  return { ok: true };
}

/**
 * Tick Fully used at Finish batch (Dylan, 26 Oct 2026): only a roll from Inventory that has been
 * scanned, once. A roll is never used before the camera has checked it. (A roll marked Return to
 * supplier joins this rule in Phase 30C.)
 */
export function planUse(roll: RollState): Plan {
  const code = roll.code ?? "This roll";
  if (!roll.fromInventory)
    return refuse(`${code} is from before rolls came from Inventory, so it can’t be ticked.`);
  if (roll.status === "FINISHED") return { ok: true };
  if (roll.status === "IN_STOCK" || roll.status === "OPEN")
    return refuse(`${code} isn’t scanned yet. Scan and finish it at Capture before it’s used.`);
  return refuse(where(roll.status, code));
}

/** Untick in a same-day correction: only a roll ticked in that same batch. */
export function planUnuse(
  roll: RollState & { usedCheckInId: string | null },
  checkInId: string,
): Plan {
  if (roll.status === "USED" && roll.usedCheckInId === checkInId) return { ok: true };
  return refuse(`${roll.code ?? "This roll"} wasn’t ticked in this batch.`);
}

/** The rolls to tick and untick when a correction sends the full list of ticked rolls. */
export function diffUsedRolls(
  before: readonly string[],
  after: readonly string[],
): { add: string[]; remove: string[] } {
  const was = new Set(before);
  const now = new Set(after);
  return {
    add: [...now].filter((id) => !was.has(id)),
    remove: [...was].filter((id) => !now.has(id)),
  };
}

// ───────────── the Capture page's dropdown ─────────────

export type OpenRollOption = {
  id: string;
  startedAt: Date | string;
  /** Picked by the person looking at the dropdown. */
  mine: boolean;
};

/**
 * Which roll the Capture page's dropdown starts on: the roll this browser last captured to, if
 * still open; else the newest roll this person picked; else the only open roll. With several
 * open rolls and none of those, nothing is chosen, so the person picks (no shot goes to a guess).
 * ASSUMPTION (Phase 26): the dropdown lists every open roll, not only the person's own.
 */
export function defaultRollId(
  open: OpenRollOption[],
  ctx: { lastUsedId?: string | null },
): string | null {
  if (ctx.lastUsedId && open.some((r) => r.id === ctx.lastUsedId)) return ctx.lastUsedId;
  const time = (r: OpenRollOption) => new Date(r.startedAt).getTime();
  const own = open.filter((r) => r.mine).sort((a, b) => time(b) - time(a));
  if (own.length > 0) return own[0].id;
  return open.length === 1 ? open[0].id : null;
}

/**
 * Where a device token's scan goes when it names no roll (the simulator, D-020's fallback): the
 * roll open the longest.
 */
export function oldestOpenRoll<T extends { startedAt: Date | string }>(open: T[]): T | null {
  if (open.length === 0) return null;
  return [...open].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  )[0];
}

/**
 * "Open since Tue, 22 Oct" for a roll picked on an earlier Manila day, else null. `today` and
 * `startedDay` are Manila dates (YYYY-MM-DD); `label` is the started day already formatted.
 */
export function openSinceLine(startedDay: string, today: string, label: string): string | null {
  return startedDay < today ? `Open since ${label}. Finish it or keep capturing.` : null;
}
