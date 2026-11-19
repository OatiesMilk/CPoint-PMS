import type { LocationKind, RollMoveReason, RollStatus } from "@/generated/prisma/enums";
import { returnMark, type Plan } from "./roll-rules";

/**
 * Storage locations and where each roll is kept (Phase 32, D-128). Pure, shared by the server,
 * the pages and the QR scanner, and unit-tested. CPoint hasn't confirmed its rack layout (A-53),
 * so codes like R1-B3 are placeholders; the Floor Manager names the real ones.
 */

export const LOCATION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
export const LOCATION_NAME_MAX = 60;
export const LOCATION_NOTES_MAX = 200;
export const MOVE_NOTE_MAX = 200;
/** Rolls moved in one go, like Add rolls (ADD_ROLLS_MAX). */
export const MOVE_MAX = 50;
/** What a location's QR holds before its code (A-80); a roll's QR holds its code alone. */
export const LOCATION_QR_PREFIX = "LOC:";
export const FIND_QUERY_MAX = 60;

export const LOCATION_KINDS = ["RACK", "BIN", "AREA"] as const satisfies readonly LocationKind[];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  RACK: "Rack",
  BIN: "Bin",
  AREA: "Area",
};

export const MOVE_REASON_LABELS: Record<RollMoveReason, string> = {
  PLACED: "Placed",
  MOVED: "Moved",
  TAKEN_FOR_USE: "Taken for scanning",
  PUT_BACK: "Put back",
  REMOVED: "Removed",
  SET_ASIDE_FOR_RETURN: "Set aside for return",
  PICKED_UP_BY_SUPPLIER: "Picked up by supplier",
};

export const LOCATION_MESSAGES = {
  code: "Location code: use 2 to 20 letters, numbers or dashes, like R1-B3.",
  kind: "Choose what it is: a rack, a bin or an area.",
  nameTooLong: `The name can be up to ${LOCATION_NAME_MAX} characters.`,
  notesTooLong: `The notes can be up to ${LOCATION_NOTES_MAX} characters.`,
  noteTooLong: `The note can be up to ${MOVE_NOTE_MAX} characters.`,
  chooseLocation: "Choose where the roll is kept.",
  chooseRolls: "Tick at least one roll to move.",
  tooMany: `Move at most ${MOVE_MAX} rolls at a time.`,
  findQuery: "Type a roll code or tag number, like LR-MLT-004.",
  notActive: "That location is deactivated. Choose another one, or reactivate it first.",
  stale: "Someone else moved this roll just now. Refresh to see where it is.",
} as const;

export function codeTakenMessage(code: string): string {
  return `${code} is already a location. Choose another code.`;
}

/** Trimmed and upper-cased: " r1-b3 " → "R1-B3" ("r1 b3" stays invalid). */
export function normalizeLocationCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isLocationCode(code: string): boolean {
  return LOCATION_CODE_PATTERN.test(code);
}

/** "R1-B3 · Rack 1, bin 3", or the code alone when it has no name. */
export function locationText(location: { code: string; name?: string | null }): string {
  return location.name ? `${location.code} · ${location.name}` : location.code;
}

/** The text inside a location label's QR. */
export function locationQrText(code: string): string {
  return `${LOCATION_QR_PREFIX}${code}`;
}

// ───────────── which rolls are in storage ─────────────

type StorageRoll = {
  status: RollStatus;
  markedForReturn: boolean;
  returnDecision: "RETURNED" | "KEPT" | null;
  pickedUpAt?: Date | string | null;
};

/** Finished as Returned to supplier (D-116) and not yet taken by the supplier (A-77). */
export function awaitsPickup(roll: StorageRoll): boolean {
  return roll.status === "FINISHED" && returnMark(roll) === "to-return" && !roll.pickedUpAt;
}

/**
 * Only a roll in storage has a location (A-55): one in stock, or one Returned to supplier that is
 * waiting for the supplier. A roll being scanned is on the table; a scanned roll that passed is
 * used up; a removed roll is gone.
 */
export function mayHoldLocation(roll: StorageRoll): boolean {
  return roll.status === "IN_STOCK" || awaitsPickup(roll);
}

// ───────────── moves ─────────────

type MoveRoll = StorageRoll & { code: string; locationId: string | null };
type Target = { id: string; code: string; isActive: boolean };

export type MovePlan = { ok: true; reason: "PLACED" | "MOVED" } | { ok: false; reason: string };

const refuse = (reason: string) => ({ ok: false as const, reason });

/** Why a roll can't be placed anywhere, in one sentence. */
function notInStorage(roll: MoveRoll): string {
  switch (roll.status) {
    case "OPEN":
      return `${roll.code} is being scanned at Capture. Put it back first.`;
    case "FINISHED":
    case "USED":
      return roll.pickedUpAt
        ? `${roll.code} was picked up by the supplier, so it has no place in storage.`
        : `${roll.code} is already scanned and used, so it has no place in storage.`;
    case "CANCELLED":
      return `${roll.code} was removed, so it has no place in storage.`;
    default:
      return `${roll.code} was returned to the supplier, so it has no place in storage.`;
  }
}

/** The Floor Manager places or moves a roll in storage (A-56). */
export function planMove(roll: MoveRoll, target: Target): MovePlan {
  if (!mayHoldLocation(roll)) return refuse(notInStorage(roll));
  if (!target.isActive) return refuse(LOCATION_MESSAGES.notActive);
  if (roll.locationId === target.id) return refuse(`${roll.code} is already in ${target.code}.`);
  return { ok: true, reason: roll.locationId ? "MOVED" : "PLACED" };
}

/** Set a Returned to supplier roll aside for the supplier (A-77). */
export function planSetAside(roll: MoveRoll, target: Target): Plan {
  if (!awaitsPickup(roll))
    return refuse(
      `${roll.code} isn’t waiting for the supplier. Only a roll Returned to supplier is set aside.`,
    );
  if (!target.isActive) return refuse(LOCATION_MESSAGES.notActive);
  if (roll.locationId === target.id) return refuse(`${roll.code} is already in ${target.code}.`);
  return { ok: true };
}

/** The supplier took a Returned to supplier roll (A-77). */
export function planPickedUp(roll: MoveRoll): Plan {
  if (roll.status === "FINISHED" && returnMark(roll) === "to-return" && roll.pickedUpAt)
    return refuse(`${roll.code} is already marked picked up by the supplier.`);
  if (!awaitsPickup(roll))
    return refuse(`${roll.code} isn’t Returned to supplier, so the supplier doesn’t pick it up.`);
  return { ok: true };
}

/** Only an empty location can be deactivated. */
export function planDeactivate(code: string, rollsIn: number): Plan {
  if (rollsIn === 0) return { ok: true };
  const rolls = rollsIn === 1 ? "1 roll" : `${rollsIn} rolls`;
  return refuse(`${code} still holds ${rolls}. Move them first.`);
}

/** A code is printed on its label, so it changes only while no roll was ever placed there (A-79). */
export function planCodeChange(code: string, everUsed: boolean): Plan {
  if (!everUsed) return { ok: true };
  return refuse(
    `${code} is printed on labels and has held rolls, so its code can’t change. Change its name instead, or add a new location.`,
  );
}

// ───────────── reading a label ─────────────

export type ScannedCode = { kind: "roll"; code: string } | { kind: "location"; code: string };

/**
 * What a scanned QR (or a typed code) points to (A-80): `LOC:R1-B3` is a location, anything else
 * a roll code (LR-…, or R-… and B-… from before). Null when there is nothing to look up.
 */
export function parseScannedCode(raw: string): ScannedCode | null {
  const text = raw.trim().toUpperCase();
  if (!text) return null;
  if (text.startsWith(LOCATION_QR_PREFIX)) {
    const code = text.slice(LOCATION_QR_PREFIX.length).trim();
    return isLocationCode(code) ? { kind: "location", code } : null;
  }
  if (text.length > FIND_QUERY_MAX) return null;
  return { kind: "roll", code: text };
}

export function noMatchMessage(text: string): string {
  return `No roll or location has the code ${text.trim()}. Check the label or type the code.`;
}

// ───────────── where a roll is, in one line ─────────────

/**
 * Where a roll is now, in words for Find roll and the roll's page: its place in storage, or why
 * it has none. `formatDate` shows a date in Manila time.
 */
export function whereText(
  roll: StorageRoll & {
    location: { code: string; name?: string | null } | null;
    finishedAt?: Date | null;
    cancelledAt?: Date | null;
  },
  formatDate: (d: Date) => string,
): string {
  if (roll.location) return locationText(roll.location);
  const on = (d: Date | null | undefined) => (d ? ` on ${formatDate(d)}` : "");
  switch (roll.status) {
    case "IN_STOCK":
      return "Not placed yet";
    case "OPEN":
      return "Being scanned at Capture";
    case "CANCELLED":
      return `Removed${on(roll.cancelledAt)}`;
    case "RETURNED":
      return "Returned to the supplier";
    default:
      if (roll.pickedUpAt)
        return `Picked up by the supplier${on(roll.pickedUpAt ? new Date(roll.pickedUpAt) : null)}`;
      if (awaitsPickup(roll)) return "Waiting for the supplier, not set aside yet";
      return `Left storage: scanned${on(roll.finishedAt)}`;
  }
}
