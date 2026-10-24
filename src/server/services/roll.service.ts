/**
 * Rolls (Phase 26, D-095). A Shoe Constructor with camera access starts a roll at Capture, captures
 * it shot by shot and finishes it once all of it is in; several rolls may be open at once and the
 * Capture page's Roll dropdown says where each shot goes. The Floor Manager reads every roll in
 * Reports → Rolls and may cancel an open one with a reason. No person is named on a roll (D-008).
 */
import { manilaToday, manilaYear } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  formatRollCode,
  oldestOpenRoll,
  planCancel,
  planFinish,
  rollClosedMessage,
  ROLL_MESSAGES,
  type Plan,
} from "@/lib/roll-rules";
import { AppError, Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import { findSupplier, listActiveSuppliers } from "@/server/models/reference-data.model";
import {
  closeRoll,
  countVerdictsForRolls,
  findRollDetail,
  findRollState,
  insertRoll,
  listOpenRolls,
  listRolls,
  nextRollNumber,
  type OpenRollRow,
  type RollDetailRow,
  type RollListRow,
} from "@/server/models/roll.model";
import type { RollListQuery, StartRollValues } from "@/server/validators/roll.validator";
import { recordAudit } from "./audit.service";

type Actor = { id: string };

// ───────────── Reports → Rolls ─────────────

export type RollListItem = RollListRow & { passed: number; rejected: number };

export async function listRollsForReport(
  query: RollListQuery,
  now: Date = new Date(),
): Promise<{ rows: RollListItem[]; total: number; page: number; pageCount: number }> {
  const page = query.page ?? 1;
  const since = query.days
    ? new Date(
        `${manilaToday(new Date(now.getTime() - (query.days - 1) * 86_400_000))}T00:00:00+08:00`,
      )
    : undefined;
  const { rows, total } = await listRolls(
    { status: query.status, supplierId: query.supplierId, since, q: query.q },
    { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE },
  );
  const counts = await countVerdictsForRolls(rows.map((r) => r.id));
  const count = (id: string, verdict: "PASS" | "REJECT") =>
    counts.find((c) => c.rollId === id && c.finalVerdict === verdict)?._count._all ?? 0;
  return {
    rows: rows.map((r) => ({ ...r, passed: count(r.id, "PASS"), rejected: count(r.id, "REJECT") })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type RollDetail = RollDetailRow & {
  passed: number;
  rejected: number;
  /** What the Floor Manager may do here: cancel an open roll, with a reason. */
  canCancel: boolean;
};

export async function getRollDetail(id: string): Promise<RollDetail | null> {
  const roll = await findRollDetail(id);
  if (!roll) return null;
  const passed = roll.scans.filter((s) => s.finalVerdict === "PASS").length;
  return {
    ...roll,
    passed,
    rejected: roll.scans.length - passed,
    canCancel: planCancel({ status: roll.status, shots: roll.scans.length }, "manager").ok,
  };
}

export function supplierOptions() {
  return listActiveSuppliers();
}

// ───────────── Capture ─────────────

export type OpenRoll = {
  id: string;
  code: string;
  tagCode: string | null;
  supplier: string | null;
  shots: number;
  startedAt: string;
  /** Started by the person asking, only to start the dropdown on their roll (no name, D-008). */
  mine: boolean;
};

const toOpenRoll = (r: OpenRollRow, viewerId?: string): OpenRoll => ({
  id: r.id,
  code: r.code,
  tagCode: r.tagCode,
  supplier: r.supplier?.name ?? null,
  shots: r._count.scans,
  startedAt: r.startedAt.toISOString(),
  mine: r.createdById === viewerId,
});

/** Every open roll, for the Capture page's Roll dropdown (newest first). */
export async function openRollsForCapture(viewer: Actor): Promise<OpenRoll[]> {
  return (await listOpenRolls()).map((r) => toOpenRoll(r, viewer.id));
}

function refuse(plan: Plan): void {
  if (!plan.ok) throw Errors.conflict(plan.reason);
}

/** Start a roll at Capture: an active supplier is required, the tag's number optional. */
export async function startRoll(values: StartRollValues, actor: Actor, now: Date = new Date()) {
  const supplier = await findSupplier(values.supplierId);
  if (!supplier?.isActive) {
    throw Errors.validation([{ path: ["supplierId"], message: ROLL_MESSAGES.chooseSupplier }]);
  }
  return runInTransaction(async (tx) => {
    const code = formatRollCode(manilaYear(now), await nextRollNumber(manilaYear(now), tx));
    const roll = await insertRoll(
      {
        code,
        tagCode: values.tagCode ?? null,
        supplierId: supplier.id,
        status: "OPEN",
        createdById: actor.id,
        startedAt: now,
        createdAt: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.start",
      entity: "Roll",
      entityId: roll.id,
      after: { code, tagCode: roll.tagCode, supplier: supplier.name },
    });
    return toOpenRoll(roll, actor.id);
  });
}

async function loadRoll(id: string) {
  const roll = await findRollState(id);
  if (!roll) throw Errors.notFound("This roll");
  return roll;
}

/** Finish a roll at Capture once all of it is scanned. It needs at least one shot. */
export async function finishRoll(id: string, actor: Actor, now: Date = new Date()) {
  const roll = await loadRoll(id);
  refuse(planFinish({ status: roll.status, shots: roll._count.scans }));
  return runInTransaction(async (tx) => {
    const done = await closeRoll(
      id,
      { status: "FINISHED", finishedAt: now, finishedById: actor.id },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.finish",
      entity: "Roll",
      entityId: id,
      before: { status: "OPEN" },
      after: { status: "FINISHED", code: roll.code, shots: roll._count.scans },
    });
    return { id, code: roll.code, status: "FINISHED" as const, shots: roll._count.scans };
  });
}

/**
 * Cancel a roll. At Capture only an empty roll (started by mistake); the Floor Manager any open
 * roll, with a reason. Nothing is deleted: the roll reads Cancelled and keeps its shots.
 */
export async function cancelRoll(
  id: string,
  input: { by: "capture" } | { by: "manager"; reason: string },
  actor: Actor,
  now: Date = new Date(),
) {
  const roll = await loadRoll(id);
  refuse(planCancel({ status: roll.status, shots: roll._count.scans }, input.by));
  const reason = input.by === "manager" ? input.reason : null;
  return runInTransaction(async (tx) => {
    const done = await closeRoll(
      id,
      { status: "CANCELLED", cancelledAt: now, cancelledById: actor.id, cancelledReason: reason },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.cancel",
      entity: "Roll",
      entityId: id,
      before: { status: "OPEN" },
      after: { status: "CANCELLED", code: roll.code, shots: roll._count.scans, reason },
    });
    return { id, code: roll.code, status: "CANCELLED" as const };
  });
}

export type CaptureRoll = { id: string; code: string; selection: "chosen" | "oldest" };

/**
 * Where a scan goes. From the Capture page the roll chosen in the dropdown, which must still be
 * open. A device token (the simulator) may name a roll; otherwise its scan goes to the roll open
 * the longest (D-020's fallback).
 */
export async function resolveCaptureRoll(
  rollId: string | undefined,
  from: "website" | "device",
): Promise<CaptureRoll> {
  if (rollId) {
    const roll = await findRollState(rollId);
    if (!roll) throw Errors.notFound("This roll");
    if (roll.status !== "OPEN") {
      throw new AppError(409, "ROLL_CLOSED", rollClosedMessage(roll.code));
    }
    return { id: roll.id, code: roll.code, selection: "chosen" };
  }
  if (from === "website") throw new AppError(409, "NO_ROLL_CHOSEN", ROLL_MESSAGES.chooseRoll);
  const oldest = oldestOpenRoll(await listOpenRolls());
  if (!oldest) throw new AppError(409, "NO_OPEN_ROLL", ROLL_MESSAGES.noOpenRoll);
  return { id: oldest.id, code: oldest.code, selection: "oldest" };
}

/** For a device token: the roll its next scan goes to, or null when none is open. */
export async function deviceTargetRoll(): Promise<OpenRoll | null> {
  const oldest = oldestOpenRoll(await listOpenRolls());
  return oldest ? toOpenRoll(oldest) : null;
}
