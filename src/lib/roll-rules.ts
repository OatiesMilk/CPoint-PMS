/**
 * A roll's rules (Phase 26, D-095): a Shoe Constructor with camera access starts a roll at Capture,
 * captures it shot by shot and finishes it once all of it is in. Several rolls may be open at once;
 * the Capture page's Roll dropdown says where each shot goes (Dylan, 24 Oct 2026). Pure, so every
 * move and refusal is unit-tested.
 */
import type { RollStatus } from "@/lib/domain";

export const ROLL_TAG_MAX = 40;
export const CANCEL_REASON_MAX = 200;

export const ROLL_MESSAGES = {
  chooseSupplier: "Choose the supplier this roll came from.",
  tagTooLong: `Roll code can be up to ${ROLL_TAG_MAX} characters.`,
  chooseRoll: "Choose the roll this shot belongs to.",
  noOpenRoll: "No roll is open. Start a roll on the Capture page first.",
  needsShot: "A roll needs at least one shot to finish. Cancel it instead.",
  hasShots:
    "This roll has shots, so it can’t be cancelled here. Finish it once all of it is scanned, or ask the Floor Manager.",
  cancelReason: "Write why this roll is cancelled.",
  cancelReasonTooLong: `The reason can be up to ${CANCEL_REASON_MAX} characters.`,
  stale: "Someone else changed this roll just now. Refresh to see where it is.",
} as const;

/** "R-2026-0012": new rolls from Phase 26; older rolls keep their B- codes (A-1). */
export function formatRollCode(year: number, n: number): string {
  return `R-${year}-${String(n).padStart(4, "0")}`;
}

/** The line for a capture sent to a roll that was finished or cancelled meanwhile. */
export function rollClosedMessage(code: string): string {
  return `${code} was finished or cancelled, so this shot wasn’t saved. Choose another roll, or start one.`;
}

export type Plan = { ok: true } | { ok: false; reason: string };

const closed = (status: RollStatus): Plan => ({
  ok: false,
  reason:
    status === "FINISHED" ? "This roll is already finished." : "This roll is already cancelled.",
});

/** Finish: at Capture, once all of the roll is in. It needs at least one shot. */
export function planFinish(roll: { status: RollStatus; shots: number }): Plan {
  if (roll.status !== "OPEN") return closed(roll.status);
  if (roll.shots === 0) return { ok: false, reason: ROLL_MESSAGES.needsShot };
  return { ok: true };
}

/**
 * Cancel. At Capture (`by: "capture"`) only an empty roll, started by mistake; the Floor Manager
 * (`by: "manager"`) any open roll, with a reason (checked by the validator). Nothing is deleted:
 * the roll reads Cancelled and keeps its shots.
 */
export function planCancel(
  roll: { status: RollStatus; shots: number },
  by: "capture" | "manager",
): Plan {
  if (roll.status !== "OPEN") return closed(roll.status);
  if (by === "capture" && roll.shots > 0) return { ok: false, reason: ROLL_MESSAGES.hasShots };
  return { ok: true };
}

export type OpenRollOption = {
  id: string;
  startedAt: Date | string;
  /** Started by the person looking at the dropdown. */
  mine: boolean;
};

/**
 * Which roll the Capture page's dropdown starts on: the roll this browser last captured to, if
 * still open; else the newest roll this person started; else the only open roll. With several
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
 * "Open since Tue, 22 Oct" for a roll started on an earlier Manila day, else null. `today` and
 * `startedDay` are Manila dates (YYYY-MM-DD); `label` is the started day already formatted.
 */
export function openSinceLine(startedDay: string, today: string, label: string): string | null {
  return startedDay < today ? `Open since ${label}. Finish it or keep capturing.` : null;
}
