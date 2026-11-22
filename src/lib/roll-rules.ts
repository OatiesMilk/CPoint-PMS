/**
 * A roll's rules. The Floor Manager adds each leather roll to its Inventory item with its own area
 * (Phase 30A, D-103). A Shoe Constructor with camera access picks the leather, then the roll, at
 * Capture (Phase 30E, D-113), captures it shot by shot and finishes it once all of it is in, and
 * then it leaves stock (D-112). Nobody ticks rolls Fully used and the Floor Manager no longer
 * returns or keeps them. Several rolls may be open at once; the Capture page's Roll dropdown says
 * where each shot goes (Dylan, 24 Oct 2026). Pure, so every move and refusal is unit-tested.
 */
import { formatScanningTime } from "./roll-timer";
import { ROLL_STATUS_LABELS, type RollStatus } from "@/lib/domain";

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
  editReason: "Say why you are correcting this roll, at least 5 characters.",
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
  /** Working time from Start scanning to Finish roll, lunch left out (D-121). */
  scanningMs?: number | null;
};

/**
 * The line after Finish roll (Phase 30E): it is off stock, and over the limit the system marks it
 * Returned to supplier (D-116).
 */
export function finishedLine(
  roll: { code: string; shots: number; item?: string | null },
  data?: FinishData,
): string {
  const line = finishedShareLine(roll, data);
  return data?.scanningMs != null
    ? `${line} Scanning time: ${formatScanningTime(data.scanningMs)}.`
    : line;
}

function finishedShareLine(
  roll: { code: string; shots: number; item?: string | null },
  data?: FinishData,
): string {
  const shots = `${roll.shots} ${roll.shots === 1 ? "shot" : "shots"}`;
  const off = roll.item ? ` It is taken off the ${roll.item} stock.` : "";
  const done = `${roll.code} is finished with ${shots}.${off}`;
  if (!data) return done;
  const pct = (n: number) => `${n.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`;
  if (data.marked && data.sharePct !== null)
    return `${done} ${pct(data.sharePct)} of it has defects, over the ${pct(data.limitPct)} limit, so it is marked Returned to supplier. Set it aside for the Floor Manager.`;
  if (data.sharePct !== null) return `${done} ${pct(data.sharePct)} of it has defects.`;
  if (data.notMeasured === "unscaled")
    return `${done} Some of its shots were taken before the marker card, so it couldn’t be checked for defects.`;
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
 * A roll's mark: "to-return" is Returned to supplier (D-116); "kept" is a
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

/** The three statuses Reports → Rolls filters by (D-116). */
export const ROLL_REPORT_STATUSES = ["NOT_SCANNED", "PASSED", "RETURNED"] as const;
export type RollReportStatus = (typeof ROLL_REPORT_STATUSES)[number];
export const ROLL_REPORT_STATUS_LABELS: Record<RollReportStatus, string> = {
  NOT_SCANNED: "Not yet scanned",
  PASSED: "Scanning passed",
  RETURNED: "Returned to supplier",
};

type StatusRoll = {
  status: RollStatus;
  markedForReturn: boolean;
  returnDecision: "RETURNED" | "KEPT" | null;
};

/**
 * Returned to supplier (D-116): the system flags a roll whose defects cover more than the limit
 * (10%) of its area when it is finished at Capture. Rolls sent back in Phase 30C count too.
 */
export function isReturnedToSupplier(roll: StatusRoll): boolean {
  if (roll.status === "RETURNED") return true;
  return (roll.status === "FINISHED" || roll.status === "USED") && returnMark(roll) === "to-return";
}

/** A roll's report status, or null while it is being scanned or after it was removed. */
export function rollReportStatus(roll: StatusRoll): RollReportStatus | null {
  if (roll.status === "IN_STOCK") return "NOT_SCANNED";
  if (isReturnedToSupplier(roll)) return "RETURNED";
  if (roll.status === "FINISHED" || roll.status === "USED") return "PASSED";
  return null;
}

/** The Status column's words, as the badge shows them (the Rolls CSV, D-121). */
export function rollStatusText(roll: StatusRoll): string {
  const report = rollReportStatus(roll);
  return report ? ROLL_REPORT_STATUS_LABELS[report] : ROLL_STATUS_LABELS[roll.status];
}

// ───────────── the Floor Manager's corrections to a roll (Phase 35B) ─────────────

export const ROLL_EDIT_MESSAGES = {
  noChange: "Nothing changed. Change a field, or close this window.",
  areaLocked:
    "The area can't change after Finish roll: the defect share and the return mark were worked out from it.",
  areaNotFromInventory: "Only a roll from Inventory has an area to correct.",
  noDecision: "This roll has no return decision, so it has no return note to change.",
  keptNeedsReason:
    "A kept roll needs the reason it was kept. Write it, or leave the note as it was.",
  noteTooLong: `Keep the note under ${CANCEL_REASON_MAX} characters.`,
  removed: (code: string) => `${code} was removed, so its details can't change.`,
} as const;

export type RollEditField = "tagCode" | "receivedOn" | "areaSqFt" | "returnNote";

/** What the form sends: a field left out (undefined) is not changed. */
export type RollEditInput = Partial<Record<RollEditField, unknown>>;

export type RollEditCurrent = {
  status: RollStatus;
  fromInventory: boolean;
  tagCode: string | null;
  /** "2026-10-26" or null */
  receivedOn: string | null;
  areaSqFt: number | null;
  returnDecision: "RETURNED" | "KEPT" | null;
  returnNote: string | null;
};

export type RollChanges = {
  tagCode?: string | null;
  receivedOn?: string;
  areaSqFt?: number;
  returnNote?: string | null;
};

/** The area can be corrected until Finish roll worked out the defect share from it (A-104). */
export const areaEditable = (roll: { status: RollStatus; fromInventory: boolean }) =>
  roll.fromInventory && (roll.status === "IN_STOCK" || roll.status === "OPEN");

/**
 * The corrections the Floor Manager asked for, checked against the roll as it is (A-104): a tag, the
 * day it was received (not after today), the area only before Finish roll, and the return note only
 * once a decision exists. Returns just what changes, with the old values for the audit; each error
 * names its field and the fix.
 */
export function planRollEdit(
  roll: RollEditCurrent,
  input: RollEditInput,
  today: string,
):
  | { ok: true; changes: RollChanges; before: RollChanges }
  | { ok: false; errors: Partial<Record<RollEditField | "form", string>> } {
  const errors: Partial<Record<RollEditField | "form", string>> = {};
  const changes: RollChanges = {};
  const before: RollChanges = {};

  if (input.tagCode !== undefined) {
    const tag = typeof input.tagCode === "string" ? input.tagCode.trim() : null;
    if (tag === null || tag.length > ROLL_TAG_MAX) errors.tagCode = ROLL_MESSAGES.tagTooLong;
    else if ((tag || null) !== roll.tagCode) {
      changes.tagCode = tag || null;
      before.tagCode = roll.tagCode;
    }
  }

  if (input.receivedOn !== undefined) {
    const day = typeof input.receivedOn === "string" ? input.receivedOn.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)))
      errors.receivedOn = ROLL_MESSAGES.receivedOn;
    else if (day > today) errors.receivedOn = ROLL_MESSAGES.receivedInFuture;
    else if (day !== roll.receivedOn) {
      changes.receivedOn = day;
      before.receivedOn = roll.receivedOn ?? undefined;
    }
  }

  if (input.areaSqFt !== undefined) {
    // parseArea speaks of "Roll 0:"; one roll is being edited, so its words are used without it.
    const parsed = parseArea(input.areaSqFt, 0);
    if (!parsed.ok) {
      const bare = parsed.reason.replace(/^Roll 0:\s*/, "");
      errors.areaSqFt = bare.charAt(0).toUpperCase() + bare.slice(1);
    } else if (parsed.value !== roll.areaSqFt) {
      if (!roll.fromInventory) errors.areaSqFt = ROLL_EDIT_MESSAGES.areaNotFromInventory;
      else if (!areaEditable(roll)) errors.areaSqFt = ROLL_EDIT_MESSAGES.areaLocked;
      else {
        changes.areaSqFt = parsed.value;
        before.areaSqFt = roll.areaSqFt ?? undefined;
      }
    }
  }

  if (input.returnNote !== undefined) {
    const note = typeof input.returnNote === "string" ? input.returnNote.trim() : null;
    if (note === null || note.length > CANCEL_REASON_MAX)
      errors.returnNote = ROLL_EDIT_MESSAGES.noteTooLong;
    else if ((note || null) !== roll.returnNote) {
      if (roll.returnDecision === null) errors.returnNote = ROLL_EDIT_MESSAGES.noDecision;
      else if (roll.returnDecision === "KEPT" && !note)
        errors.returnNote = ROLL_EDIT_MESSAGES.keptNeedsReason;
      else {
        changes.returnNote = note || null;
        before.returnNote = roll.returnNote;
      }
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  if (Object.keys(changes).length === 0)
    return { ok: false, errors: { form: ROLL_EDIT_MESSAGES.noChange } };
  return { ok: true, changes, before };
}
