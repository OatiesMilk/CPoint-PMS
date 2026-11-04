/**
 * Rolls. The Floor Manager adds each leather roll to its item with its own area (+1 in stock,
 * Phase 30A, D-103); a Shoe Constructor with camera access picks the leather, then the roll, at
 * Capture (Phase 30E, D-113), captures it shot by shot and finishes it, and then it leaves stock
 * (−1) whatever its Defect % (D-112). Nobody ticks rolls Fully used and the Floor Manager no longer
 * returns or keeps them; those rolls from before stay as history. The Floor Manager may remove a
 * roll still in stock or being scanned, with a reason (−1). Every stock change is a ledger movement
 * with the roll's id (D-023). No person is named on a roll (D-008).
 */
import type { Prisma } from "@/generated/prisma/client";
import type { RollStatus } from "@/lib/domain";
import { manilaToday } from "@/lib/format";
import { manilaDayOf } from "@/lib/production-rules";
import { addDays, manilaDayStart } from "@/lib/report-rules";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  formatRollCode,
  oldestOpenRoll,
  planFinish,
  planPutBack,
  planRemove,
  planStart,
  rollClosedMessage,
  rollCodePrefix,
  ROLL_MESSAGES,
  type Plan,
} from "@/lib/roll-rules";
import { rollShare } from "@/lib/measure";
import { AppError, Errors } from "@/server/lib/errors";
import { getCvSettings } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import { findInventoryItem } from "@/server/models/inventory.model";
import { findSupplier, listActiveSuppliers } from "@/server/models/reference-data.model";
import {
  countDefectsForRolls,
  countOpenRolls,
  countVerdictsForRolls,
  listRollFinishTimes,
  findRollDetail,
  findRollState,
  insertRoll,
  listOpenRolls,
  listRollShotMeasures,
  listReadyRolls,
  listRolls,
  listRollsUsedIn,
  moveRoll,
  nextRollCodeNumber,
  rollCodeTaken,
  saveRollMeasure,
  type OpenRollRow,
  type RollDetailRow,
  type RollListRow,
} from "@/server/models/roll.model";
import type { AddRollsValues, RollListQuery } from "@/server/validators/roll.validator";
import { recordAudit } from "./audit.service";
import { postMovement } from "./inventory.service";

type Actor = { id: string };
type Tx = Prisma.TransactionClient;

const area = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Active suppliers, for filters and the item form. */
export function supplierOptions() {
  return listActiveSuppliers();
}

// ───────────── Reports → Rolls, and a leather item's rolls ─────────────

export type RollListItem = Omit<RollListRow, "areaSqFt" | "returnedOn"> & {
  /** The day it went back to the supplier, YYYY-MM-DD (Phase 30C). */
  returnedOn: string | null;
  areaSqFt: number | null;
  passed: number;
  rejected: number;
};

async function withVerdicts(rows: RollListRow[]): Promise<RollListItem[]> {
  const counts = await countVerdictsForRolls(rows.map((r) => r.id));
  const count = (id: string, verdict: "PASS" | "REJECT") =>
    counts.find((c) => c.rollId === id && c.finalVerdict === verdict)?._count._all ?? 0;
  return rows.map((r) => ({
    ...r,
    areaSqFt: area(r.areaSqFt),
    returnedOn: dayOf(r.returnedOn),
    passed: count(r.id, "PASS"),
    rejected: count(r.id, "REJECT"),
  }));
}

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
    {
      status: query.status,
      supplierId: query.supplierId,
      since,
      q: query.q,
    },
    { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE },
  );
  return {
    rows: await withVerdicts(rows),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type ItemRoll = RollListItem & {
  /** "cut 2, hole 1": the defects the camera found on this roll, most first. */
  defectsFound: string;
  canRemove: boolean;
};

/**
 * Inventory → a leather item's rolls (Phase 30A): scanned or not, area, shots, rejected sections
 * and the defects found, and its Defect % once finished (Phase 30C). A defect counts from "A
 * defect counts as found at" as it is set now.
 */
export async function listItemRolls(
  itemId: string,
  query: { status?: RollStatus; page?: number },
): Promise<{ rows: ItemRoll[]; total: number; page: number; pageCount: number }> {
  const page = query.page ?? 1;
  const { rows, total } = await listRolls(
    { itemId, status: query.status },
    { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE },
  );
  const [items, settings] = await Promise.all([withVerdicts(rows), getCvSettings()]);
  const defects = await countDefectsForRolls(
    rows.map((r) => r.id),
    settings?.foundAtOrAbove ?? 0.5,
  );
  return {
    rows: items.map((r) => ({
      ...r,
      defectsFound: defects
        .filter((d) => d.rollId === r.id)
        .map((d) => `${d.label} ${Number(d.detections)}`)
        .join(", "),
      canRemove: planRemove({ status: r.status, fromInventory: true }).ok,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type RollDetail = Omit<RollDetailRow, "areaSqFt" | "returnedOn"> & {
  areaSqFt: number | null;
  /** The day it went back to the supplier: a Phase 30C decision, kept as history. */
  returnedOn: string | null;
  passed: number;
  rejected: number;
  /** What the Floor Manager may do here: remove the roll, with a reason. */
  canRemove: boolean;
};

export async function getRollDetail(id: string): Promise<RollDetail | null> {
  const roll = await findRollDetail(id);
  if (!roll) return null;
  const passed = roll.scans.filter((s) => s.finalVerdict === "PASS").length;
  const state = { status: roll.status, fromInventory: !!roll.item };
  return {
    ...roll,
    areaSqFt: area(roll.areaSqFt),
    returnedOn: dayOf(roll.returnedOn),
    passed,
    rejected: roll.scans.length - passed,
    canRemove: planRemove(state).ok,
  };
}

// ───────────── Capture ─────────────

export type OpenRoll = {
  id: string;
  code: string;
  tagCode: string | null;
  supplier: string | null;
  /** The leather item's name, for a roll from Inventory. */
  item: string | null;
  areaSqFt: number | null;
  shots: number;
  startedAt: string;
  /** Picked by the person asking, only to start the dropdown on their roll (no name, D-008). */
  mine: boolean;
  /** Added in Inventory (Phase 30A): Put back returns it there; older rolls are cancelled. */
  fromInventory: boolean;
};

const toOpenRoll = (r: OpenRollRow, viewerId?: string): OpenRoll => ({
  id: r.id,
  code: r.code,
  tagCode: r.tagCode,
  supplier: r.supplier?.name ?? null,
  item: r.item?.name ?? null,
  areaSqFt: area(r.areaSqFt),
  shots: r._count.scans,
  startedAt: (r.startedAt ?? new Date(0)).toISOString(),
  mine: !!viewerId && r.startedById === viewerId,
  fromInventory: r.itemId !== null,
});

/** Every open roll, for the Capture page's Roll dropdown (newest first). */
export async function openRollsForCapture(viewer: Actor): Promise<OpenRoll[]> {
  return (await listOpenRolls()).map((r) => toOpenRoll(r, viewer.id));
}

export type ReadyRoll = Pick<
  OpenRoll,
  "id" | "code" | "tagCode" | "supplier" | "item" | "areaSqFt"
>;

/** Rolls in stock and not scanned yet, oldest first, for Capture's Scan a roll (Phase 30A). */
export async function readyRollsForCapture(): Promise<ReadyRoll[]> {
  return (await listReadyRolls()).map((r) => {
    const { id, code, tagCode, supplier, item, areaSqFt } = toOpenRoll(r);
    return { id, code, tagCode, supplier, item, areaSqFt };
  });
}

function refuse(plan: Plan): void {
  if (!plan.ok) throw Errors.conflict(plan.reason);
}

async function loadRoll(id: string) {
  const roll = await findRollState(id);
  if (!roll) throw Errors.notFound("This roll");
  return roll;
}

const stateOf = (r: OpenRollRow) => ({
  code: r.code,
  status: r.status,
  fromInventory: r.itemId !== null,
  shots: r._count.scans,
});

/**
 * Add rolls to a leather item (Inventory, the Floor Manager): one record each, with its own area
 * and an optional supplier's tag, coded LR-<supplier code>-001 on. Each is +1 in stock, so the
 * item's count follows its rolls. One transaction; nothing is saved unless every roll is fine.
 */
export async function addRolls(
  itemId: string,
  values: AddRollsValues,
  actor: Actor,
  now: Date = new Date(),
) {
  if (values.receivedOn > manilaToday(now))
    throw Errors.validation([{ path: ["receivedOn"], message: ROLL_MESSAGES.receivedInFuture }]);
  const item = await findInventoryItem(itemId);
  if (!item) throw Errors.notFound("This item");
  if (item.category !== "LEATHER_ROLL")
    throw Errors.conflict(`${item.name} isn’t a leather roll item, so it has no rolls.`);
  if (!item.isActive)
    throw Errors.conflict(`${item.name} is deactivated. Reactivate it to add rolls.`);
  const supplier = item.supplierId ? await findSupplier(item.supplierId) : null;
  if (!supplier)
    throw Errors.conflict(`Choose ${item.name}’s supplier first (Edit), so its rolls get a code.`);
  if (!supplier.isActive)
    throw Errors.conflict(
      `${supplier.name} is no longer an active supplier. Choose another supplier for ${item.name} first.`,
    );

  return runInTransaction(async (tx) => {
    const added = [];
    let onHand = Number(item.quantityOnHand);
    for (const roll of values.rolls) {
      let code: string;
      do {
        code = formatRollCode(
          supplier.code,
          await nextRollCodeNumber(rollCodePrefix(supplier.code), tx),
        );
      } while (await rollCodeTaken(code, tx));
      const row = await insertRoll(
        {
          code,
          tagCode: roll.tagCode ?? null,
          itemId: item.id,
          supplierId: supplier.id,
          areaSqFt: roll.areaSqFt,
          receivedAt: new Date(`${values.receivedOn}T00:00:00Z`),
          status: "IN_STOCK",
          createdById: actor.id,
          createdAt: now,
        },
        tx,
      );
      const moved = await postMovement(
        tx,
        { id: item.id, sku: item.sku, name: item.name, unit: item.unit, quantityOnHand: onHand },
        { type: "IN", delta: 1, reason: `Roll ${code} added`, rollId: row.id },
        actor,
        now,
      );
      onHand = moved.onHandAfter;
      added.push({ id: row.id, code, areaSqFt: roll.areaSqFt, tagCode: roll.tagCode ?? null });
    }
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.add",
      entity: "InventoryItem",
      entityId: item.id,
      after: {
        item: `${item.sku} · ${item.name}`,
        supplier: supplier.name,
        receivedOn: values.receivedOn,
        rolls: added.map(({ code, areaSqFt, tagCode }) => ({ code, areaSqFt, tagCode })),
        quantityOnHand: onHand,
      },
    });
    return { added, quantityOnHand: onHand };
  });
}

/** Pick a roll at Capture (Phase 30A): a roll in stock, not scanned yet, becomes Being scanned. */
export async function startRoll(id: string, actor: Actor, now: Date = new Date()) {
  const roll = await loadRoll(id);
  refuse(planStart(stateOf(roll)));
  return runInTransaction(async (tx) => {
    const done = await moveRoll(
      id,
      "IN_STOCK",
      { status: "OPEN", startedAt: now, startedById: actor.id },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.start",
      entity: "Roll",
      entityId: id,
      before: { status: "IN_STOCK" },
      after: { status: "OPEN", code: roll.code },
    });
    return toOpenRoll({ ...roll, status: "OPEN", startedAt: now, startedById: actor.id }, actor.id);
  });
}

export type FinishResult = {
  id: string;
  code: string;
  status: "FINISHED";
  shots: number;
  /** Its defect share (Phase 30C, D-110); null when it couldn't be measured. */
  sharePct: number | null;
  limitPct: number;
  marked: boolean;
  /** Why it wasn't measured: no area, or shots from a phone that wasn't calibrated (A-28). */
  notMeasured: "no-area" | "no-shots" | "unscaled" | null;
};

/**
 * Finish a roll at Capture once all of it is scanned. It needs at least one shot. It leaves its
 * item's stock (−1) whatever its verdicts (Phase 30E, D-112). Its defect share is worked out and
 * saved (Phase 30C): its shots' defect area over its entered area, plus the flat shares; more than
 * the limit marks it Too many defects, for the Floor Manager's information (C-9).
 */
export async function finishRoll(
  id: string,
  actor: Actor,
  now: Date = new Date(),
): Promise<FinishResult> {
  const roll = await loadRoll(id);
  refuse(planFinish(stateOf(roll)));
  const settings = await getCvSettings();
  const limitPct = settings?.returnSharePct ?? 10;
  return runInTransaction(async (tx) => {
    const done = await moveRoll(
      id,
      "OPEN",
      { status: "FINISHED", finishedAt: now, finishedById: actor.id },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    await takeFromStock(tx, roll, `Roll ${roll.code} scanned at Capture`, actor, now);
    const share = rollShare(area(roll.areaSqFt), await listRollShotMeasures(id, tx), limitPct);
    const measure = share.measured
      ? {
          defectAreaSqIn: Math.round(share.defectAreaSqIn * 100) / 100,
          defectSharePct: Math.round(share.sharePct * 100) / 100,
          returnLimitPct: limitPct,
          markedForReturn: share.over,
        }
      : {
          defectAreaSqIn: null,
          defectSharePct: null,
          returnLimitPct: limitPct,
          markedForReturn: false,
        };
    await saveRollMeasure(id, measure, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.finish",
      entity: "Roll",
      entityId: id,
      before: { status: "OPEN" },
      after: {
        status: "FINISHED",
        code: roll.code,
        shots: roll._count.scans,
        defectSharePct: measure.defectSharePct,
        returnLimitPct: limitPct,
        markedForReturn: measure.markedForReturn,
        ...(share.measured ? {} : { notMeasured: share.reason }),
      },
    });
    return {
      id,
      code: roll.code,
      status: "FINISHED" as const,
      shots: roll._count.scans,
      sharePct: measure.defectSharePct,
      limitPct,
      marked: measure.markedForReturn,
      notMeasured: share.measured ? null : share.reason,
    };
  });
}

/**
 * Put back at Capture: a roll picked by mistake, with no shots. A roll from Inventory waits to be
 * scanned again; one from before Phase 30A is cancelled, as it was then.
 */
export async function putBackRoll(id: string, actor: Actor, now: Date = new Date()) {
  const roll = await loadRoll(id);
  const state = stateOf(roll);
  refuse(planPutBack(state));
  return runInTransaction(async (tx) => {
    const done = await moveRoll(
      id,
      "OPEN",
      state.fromInventory
        ? { status: "IN_STOCK", startedAt: null, startedById: null }
        : { status: "CANCELLED", cancelledAt: now, cancelledById: actor.id, cancelledReason: null },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    const status = state.fromInventory ? ("IN_STOCK" as const) : ("CANCELLED" as const);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: state.fromInventory ? "roll.put_back" : "roll.cancel",
      entity: "Roll",
      entityId: id,
      before: { status: "OPEN" },
      after: { status, code: roll.code },
    });
    return { id, code: roll.code, status };
  });
}

/**
 * Remove a roll (the Floor Manager, with a reason): a roll from Inventory still in stock or being
 * scanned (damaged, lost, added by mistake) leaves stock (−1); a scanned roll is already off stock.
 * A roll from before Phase 30A can be removed only while open, as the old Cancel. Nothing is
 * deleted: its shots stay, out of the reports.
 */
export async function removeRoll(id: string, reason: string, actor: Actor, now: Date = new Date()) {
  const roll = await loadRoll(id);
  const state = stateOf(roll);
  refuse(planRemove(state));
  return runInTransaction(async (tx) => {
    const done = await moveRoll(
      id,
      roll.status,
      { status: "CANCELLED", cancelledAt: now, cancelledById: actor.id, cancelledReason: reason },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    if (state.fromInventory)
      await takeFromStock(tx, roll, `Roll ${roll.code} removed: ${reason}`, actor, now);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.remove",
      entity: "Roll",
      entityId: id,
      before: { status: roll.status },
      after: { status: "CANCELLED", code: roll.code, shots: roll._count.scans, reason },
    });
    return { id, code: roll.code, status: "CANCELLED" as const };
  });
}

/** One roll's −1 on its leather item, in the caller's transaction. */
async function takeFromStock(
  tx: Tx,
  roll: Pick<OpenRollRow, "id" | "itemId">,
  reason: string,
  actor: Actor,
  now: Date,
) {
  const delta = -1;
  if (!roll.itemId) return;
  const item = await findInventoryItem(roll.itemId, tx);
  if (!item) throw Errors.notFound("This roll’s item");
  await postMovement(
    tx,
    { ...item, quantityOnHand: Number(item.quantityOnHand) },
    { type: "OUT", delta, reason, rollId: roll.id },
    actor,
    now,
  );
}

// ───────────── Fully used, before Phase 30E (history) ─────────────

/** The rolls ticked Fully used in each batch before Phase 30E, for Batches' rows (history). */
export async function rollsUsedByCheckIn(checkInIds: string[]) {
  const rows = await listRollsUsedIn(checkInIds);
  const out = new Map<string, { id: string; code: string }[]>();
  for (const r of rows) {
    if (!r.usedCheckInId) continue;
    out.set(r.usedCheckInId, [...(out.get(r.usedCheckInId) ?? []), { id: r.id, code: r.code }]);
  }
  return out;
}

/**
 * Rolls scanned per Manila day from `from` to `to` (Phase 30E-2, D-114): each roll counts on the
 * day its Finish roll was pressed, whatever the leather. Days with none are left out.
 */
export async function rollsScannedByDay(from: string, to: string): Promise<Map<string, number>> {
  const times = await listRollFinishTimes(manilaDayStart(from), manilaDayStart(addDays(to, 1)));
  const out = new Map<string, number>();
  for (const t of times) {
    const day = manilaDayOf(t);
    out.set(day, (out.get(day) ?? 0) + 1);
  }
  return out;
}

// ───────────── where a scan goes ─────────────

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
  const oldest = oldestOpenRoll(await openWithTimes());
  if (!oldest) throw new AppError(409, "NO_OPEN_ROLL", ROLL_MESSAGES.noOpenRoll);
  return { id: oldest.id, code: oldest.code, selection: "oldest" };
}

/** Open rolls with their pick time (always set on an open roll; the epoch only as a fallback). */
async function openWithTimes() {
  return (await listOpenRolls()).map((r) => ({ ...r, startedAt: r.startedAt ?? new Date(0) }));
}

/** For a device token: the roll its next scan goes to, or null when none is open. */
export async function deviceTargetRoll(): Promise<OpenRoll | null> {
  const oldest = oldestOpenRoll(await openWithTimes());
  return oldest ? toOpenRoll(oldest) : null;
}

/** Rolls open now, being captured (the FM home's Rolls today, Phase 28). */
export function openRollCount(): Promise<number> {
  return countOpenRolls();
}
