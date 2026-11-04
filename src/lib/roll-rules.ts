/**
 * A roll's rules. The Floor Manager adds each leather roll to its Inventory item with its own area
 * (Phase 30A, D-103). A Shoe Constructor with camera access picks the leather, then the roll, at
 * Capture (Phase 30E, D-113), captures it shot by shot and finishes it once all of it is in, and
 * then it leaves stock (D-112). Nobody ticks rolls Fully used and the Floor Manager no longer
 * returns or keeps them. Several rolls may be open at once; the Capture page's Roll dropdown says
 * where each shot goes (Dylan, 24 Oct 2026). Pure, so every move and refusal is unit-tested.
 */
import type { RollStatus } from "@/lib/domain";

export const ROLL_TAG_MAX = 40;
export const CANCEL_REASON_MAX = 200;
/** Rolls added in one save. */
export const ADD_ROLLS_MAX = 50;
/** Square feet. A cowhide is usually 15 to 60 (Dylan, 26 Oct 2026). */
export const AREA_MIN = 0.1;
export const AREA_MAX = 200;

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
  // Phase 30E: pick the leather, then the roll (D-113).
  chooseLeather: "Choose the leather you’re scanning.",
  chooseRollOfLeather: "Choose the roll on the table. Its code is on its label.",
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
    USED: `${code} was marked fully used.`,
    RETURNED: `${code} was returned to the supplier.`,
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
/**
 * Remove (the Floor Manager, with a reason, checked by the validator): a roll from Inventory that
 * is still in stock or being scanned, e.g. damaged, lost or added by mistake; it leaves stock. A
 * scanned roll is already off stock (D-112), so it can't be removed. A roll from before Phase 30A
 * can be removed only while it is open, as the old Cancel. Nothing is deleted.
 */
export function planRemove(roll: RollState): Plan {
  if (roll.fromInventory) {
    if (roll.status === "IN_STOCK" || roll.status === "OPEN") return { ok: true };
    return refuse(where(roll.status, roll.code));
  }
  if (roll.status !== "OPEN") return refuse(where(roll.status, roll.code));
  return { ok: true };
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

// ───────────── Finish roll (Phase 30C) ─────────────

/** What POST …/finish answers about the roll's defect share (Phase 30C). */
export type FinishData = {
  sharePct: number | null;
  limitPct: number;
  marked: boolean;
  notMeasured: "no-area" | "no-shots" | "unscaled" | null;
};

/**
 * The line after Finish roll (Phase 30E): it is off stock, and over the limit the Floor Manager
 * sees it has too many defects (for information only, D-112).
 */
export function finishedLine(
  roll: { code: string; shots: number; item?: string | null },
  data?: FinishData,
): string {
  const shots = `${roll.shots} ${roll.shots === 1 ? "shot" : "shots"}`;
  const off = roll.item ? ` It is taken off the ${roll.item} stock.` : "";
  const done = `${roll.code} is finished with ${shots}.${off}`;
  if (!data) return done;
  const pct = (n: number) => `${n.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`;
  if (data.marked && data.sharePct !== null)
    return `${done} ${pct(data.sharePct)} of it has defects, which is too many. The Floor Manager will see it.`;
  if (data.sharePct !== null) return `${done} ${pct(data.sharePct)} of it has defects.`;
  if (data.notMeasured === "unscaled")
    return `${done} Set up this phone next time so the roll can be checked for defects.`;
  if (data.notMeasured === "no-area")
    return `${done} It has no size in Inventory, so it couldn’t be checked for defects.`;
  return done;
}

/** A roll's Defect % as the lists show it (Phase 30C): "12.4%", "Not measured", or "—". */
export function defectShareText(roll: {
  status: RollStatus;
  defectSharePct: number | null;
  finishedAt?: Date | string | null;
}): string {
  if (roll.defectSharePct !== null)
    return `${roll.defectSharePct.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`;
  if (roll.status === "IN_STOCK" || roll.status === "OPEN") return "—";
  return roll.finishedAt ? "Not measured" : "—";
}

/**
 * A roll's mark: "to-return" shows Too many defects (for information since Phase 30E); "kept" is a
 * Floor Manager's Keep from Phase 30C, kept as history.
 */
export function returnMark(roll: {
  markedForReturn: boolean;
  returnDecision: "RETURNED" | "KEPT" | null;
}): "to-return" | "kept" | null {
  if (roll.returnDecision === "KEPT") return "kept";
  if (roll.markedForReturn && roll.returnDecision === null) return "to-return";
  return null;
}
