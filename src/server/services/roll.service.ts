/**
 * Rolls. The Floor Manager adds each leather roll to its item with its own area (+1 in stock,
 * Phase 30A, D-103); a Shoe Constructor with camera access picks the leather, then the roll, at
 * Capture (Phase 30E, D-113), captures it shot by shot and finishes it, and then it leaves stock
 * (−1) whatever its Defect % (D-112). Nobody ticks rolls Fully used and the Floor Manager no longer
 * returns or keeps them; those rolls from before stay as history. The Floor Manager may remove a
 * roll still in stock or being scanned, with a reason (−1). Every stock change is a ledger movement
 * with the roll's id (D-023). No person is named on a roll (D-008).
 */
import { appNow } from "@/lib/clock";
import type { Prisma } from "@/generated/prisma/client";
import type { RollStatus } from "@/lib/domain";
import { formatManilaDateTime, manilaToday } from "@/lib/format";
import { manilaDayOf, type BreakRule } from "@/lib/production-rules";
import {
  averageMs,
  formatScanningTime,
  lunchDays,
  lunchLookup,
  scanningMinutes,
  scanningMs,
  type LunchOn,
} from "@/lib/roll-timer";
import type { RollScale } from "@/lib/scale-marker";
import { addDays, manilaDayStart, parseRange, toCsv } from "@/lib/report-rules";
import { parseSort, sortRows, type SortKey } from "@/lib/table-sort";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  formatRollCode,
  isReturnedToSupplier,
  rollStatusText,
  oldestOpenRoll,
  planFinish,
  planRollEdit,
  ROLL_EDIT_MESSAGES,
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
import { findInventoryItem, listInventoryItems } from "@/server/models/inventory.model";
import { listLunchBreaks } from "@/server/models/production.model";
import { findSupplier, listActiveSuppliers } from "@/server/models/reference-data.model";
import {
  countDefectsForRolls,
  countOpenRolls,
  countVerdictsForRolls,
  listRollFinishes,
  findRollDetail,
  findRollState,
  insertRoll,
  listOpenRolls,
  listRollShotMeasures,
  listReadyRolls,
  listRolls,
  listRollTimes,
  listRollsUsedIn,
  findRollsByCodeOrTag,
  findRollsByIds,
  insertRollMove,
  lastTakenFrom,
  listRollMoves,
  listRollsInLocation,
  moveRoll,
  setRollLocation,
  type RollMoveRow,
  nextRollCodeNumber,
  rollCodeTaken,
  saveRollMeasure,
  updateRollDetails,
  type OpenRollRow,
  type RollDetailRow,
  type RollListRow,
} from "@/server/models/roll.model";
import type {
  AddRollsValues,
  RollListQuery,
  UpdateRollInput,
} from "@/server/validators/roll.validator";
import {
  awaitsPickup,
  locationText,
  mayHoldLocation,
  MOVE_REASON_LABELS,
  noMatchMessage,
  parseScannedCode,
  planMove,
  planPickedUp,
  planSetAside,
  whereText,
  LOCATION_MESSAGES,
} from "@/lib/location-rules";
import {
  findLocation,
  findLocationByCode,
  listLocations as listLocationRows,
} from "@/server/models/location.model";
import type { MoveRollsValues } from "@/server/validators/location.validator";
import { recordAudit } from "./audit.service";
import { toLocation, type Location } from "./location.service";
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
  /** Working time from Start scanning to Finish roll, lunch left out (D-121); null unfinished. */
  scanningMs: number | null;
};

const timeOf = (r: { startedAt: Date | null; finishedAt: Date | null }, lunchOn: LunchOn) =>
  r.startedAt && r.finishedAt ? scanningMs(r.startedAt, r.finishedAt, lunchOn) : null;

async function withVerdicts(rows: RollListRow[]): Promise<RollListItem[]> {
  const [counts, lunchOn] = await Promise.all([
    countVerdictsForRolls(rows.map((r) => r.id)),
    loadLunchOn(),
  ]);
  const count = (id: string, verdict: "PASS" | "REJECT") =>
    counts.find((c) => c.rollId === id && c.finalVerdict === verdict)?._count._all ?? 0;
  return rows.map((r) => ({
    ...r,
    areaSqFt: area(r.areaSqFt),
    returnedOn: dayOf(r.returnedOn),
    passed: count(r.id, "PASS"),
    rejected: count(r.id, "REJECT"),
    scanningMs: timeOf(r, lunchOn),
  }));
}

function reportFilters(query: RollListQuery, now: Date) {
  const base = {
    reportStatus: query.status,
    supplierId: query.supplierId,
    itemId: query.itemId,
    locationId: query.locationId,
    q: query.q,
  };
  // The period picker (Phase 35) filters on the day a roll was added; no period means any time.
  if (query.period || query.preset || query.from || query.to) {
    const range = parseRange(query, now);
    return { ...base, since: range.start, until: range.end };
  }
  const since = query.days
    ? new Date(
        `${manilaToday(new Date(now.getTime() - (query.days - 1) * 86_400_000))}T00:00:00+08:00`,
      )
    : undefined;
  return { ...base, since };
}

/** The average scanning time of every roll the filters match, over all pages (D-121). */
async function averageScanning(query: RollListQuery, now: Date) {
  const [times, lunchOn] = await Promise.all([
    listRollTimes(reportFilters(query, now)),
    loadLunchOn(),
  ]);
  const ms = times.map((t) => timeOf(t, lunchOn));
  return { averageMs: averageMs(ms), count: ms.filter((t) => t !== null).length };
}

/** A printed Rolls report holds up to this many rows; past it the header says so (A-102). */
export const PRINT_MAX_ROLLS = 500;

/** The columns of Reports → Rolls a click on the header sorts by (table "rolls"). */
const ROLL_SORT: Record<string, SortKey<RollListItem>> = {
  roll: (r) => r.code,
  supplier: (r) => r.supplier?.name ?? null,
  area: (r) => r.areaSqFt,
  scanned: (r) => r.finishedAt?.getTime() ?? null,
  "scanning-time": (r) => r.scanningMs,
  shots: (r) => r._count.scans,
  passed: (r) => r.passed,
  rejected: (r) => r.rejected,
  defect: (r) => r.defectSharePct,
  status: (r) => rollStatusText(r),
};

export async function listRollsForReport(
  query: RollListQuery,
  now: Date = appNow(),
): Promise<{
  rows: RollListItem[];
  total: number;
  page: number;
  pageCount: number;
  scanning: { averageMs: number | null; count: number };
  /** The printed list stopped at PRINT_MAX_ROLLS of a longer one. */
  printCut: boolean;
}> {
  const filters = reportFilters(query, now);
  const sort = parseSort(query.sort, query.dir);
  const sorted = sort?.table === "rolls" && Object.hasOwn(ROLL_SORT, sort.column) ? sort : null;
  const size = query.print ? PRINT_MAX_ROLLS : PAGE_SIZE;
  const page = query.print ? 1 : (query.page ?? 1);
  const scanningP = averageScanning(query, now);
  if (sorted) {
    // shortcut: a sorted list sorts the newest CSV_MAX_ROLLS matches in memory (scanning time and
    // status aren't columns); narrow the filters past that.
    const [{ rows, total }, scanning] = await Promise.all([
      listRolls(filters, { skip: 0, take: CSV_MAX_ROLLS }),
      scanningP,
    ]);
    const ordered = sortRows(await withVerdicts(rows), ROLL_SORT, sorted.column, sorted.dir);
    return {
      rows: ordered.slice((page - 1) * size, page * size),
      total,
      page,
      pageCount: query.print ? 1 : Math.max(1, Math.ceil(total / size)),
      scanning,
      printCut: Boolean(query.print) && total > size,
    };
  }
  const [{ rows, total }, scanning] = await Promise.all([
    listRolls(filters, { skip: (page - 1) * size, take: size }),
    scanningP,
  ]);
  return {
    rows: await withVerdicts(rows),
    total,
    page,
    pageCount: query.print ? 1 : Math.max(1, Math.ceil(total / size)),
    scanning,
    printCut: Boolean(query.print) && total > size,
  };
}

/** The leather items and storage places the Rolls filters offer (Phase 35). */
export async function rollFilterOptions() {
  const [suppliers, items, locations] = await Promise.all([
    listActiveSuppliers(),
    listInventoryItems({ category: "LEATHER_ROLL" }, { skip: 0, take: 200 }),
    listLocationRows({}),
  ]);
  return {
    suppliers,
    items: items.rows.map((i) => ({ id: i.id, name: i.name })),
    locations: locations.map((l) => ({ id: l.id, name: `${l.code} · ${l.name}` })),
  };
}

/** At most this many rows in the Rolls CSV; the filters narrow it. */
const CSV_MAX_ROLLS = 5_000;

/**
 * GET /api/v1/reports/rolls.csv: the rolls the Reports → Rolls filters show, every page, with
 * each roll's scanning time (D-121) for comparing with the manual check. No person named.
 */
export async function rollsCsv(query: RollListQuery, now: Date = appNow()): Promise<string> {
  const { rows } = await listRolls(reportFilters(query, now), { skip: 0, take: CSV_MAX_ROLLS });
  const items = await withVerdicts(rows);
  const when = (d: Date | null) => (d ? formatManilaDateTime(d) : "");
  return toCsv(items, [
    { header: "Roll", value: (r) => r.code },
    { header: "Leather", value: (r) => r.item?.name ?? "" },
    { header: "Supplier", value: (r) => r.supplier?.name ?? "" },
    { header: "Area (sq ft)", value: (r) => r.areaSqFt },
    { header: "Started scanning (Manila)", value: (r) => when(r.startedAt) },
    { header: "Finished (Manila)", value: (r) => when(r.finishedAt) },
    {
      header: "Scanning time",
      value: (r) => (r.scanningMs === null ? "" : formatScanningTime(r.scanningMs)),
    },
    {
      header: "Scanning time (min)",
      // Always two decimals (20.90, not 20.9), so the paper's column lines up (QA run 1, F2).
      value: (r) => (r.scanningMs === null ? null : scanningMinutes(r.scanningMs).toFixed(2)),
    },
    { header: "Shots", value: (r) => r._count.scans },
    { header: "Passed", value: (r) => r.passed },
    { header: "Rejected", value: (r) => r.rejected },
    { header: "Defect %", value: (r) => r.defectSharePct },
    { header: "Status", value: (r) => rollStatusText(r) },
  ]);
}

export type ItemRoll = RollListItem & {
  /** "cut 2, hole 1": the defects the camera found on this roll, most first. */
  defectsFound: string;
  canRemove: boolean;
  /** Where it is kept, in one line (Phase 32). */
  where: string;
  /** In storage, so the Floor Manager may place or move it. */
  canMove: boolean;
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
      where: whereOf(r),
      canMove: mayHoldLocation(storageOf(r)),
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
  /** Working time from Start scanning to Finish roll, lunch left out (D-121). */
  scanningMs: number | null;
  /** Where it is kept, in one line, and its location history (Phase 32). */
  where: string;
  canMove: boolean;
  awaitsPickup: boolean;
  history: RollHistoryEntry[];
};

export async function getRollDetail(id: string): Promise<RollDetail | null> {
  const roll = await findRollDetail(id);
  if (!roll) return null;
  const passed = roll.scans.filter((s) => s.finalVerdict === "PASS").length;
  const state = { status: roll.status, fromInventory: !!roll.item };
  const [lunchOn, history] = await Promise.all([loadLunchOn(), rollHistory(roll.id)]);
  return {
    ...roll,
    areaSqFt: area(roll.areaSqFt),
    returnedOn: dayOf(roll.returnedOn),
    passed,
    rejected: roll.scans.length - passed,
    canRemove: planRemove(state).ok,
    scanningMs: timeOf(roll, lunchOn),
    where: whereOf(roll),
    canMove: mayHoldLocation(storageOf(roll)),
    awaitsPickup: awaitsPickup(storageOf(roll)),
    history,
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
  /** The scale its first shot's marker card set (D-121); null before a measured shot. */
  scale: RollScale | null;
  /** The lunch break of each day since it started, so Capture's timer leaves lunch out (D-121). */
  lunches: Record<string, BreakRule | null>;
  /** Where it is kept (Phase 32): a roll waiting at Capture; null once picked. */
  location: { code: string; name: string | null } | null;
  /** Where it was taken from when picked, to prefill Put back (Phase 32). */
  takenFromId: string | null;
};

const scaleOfRoll = (r: OpenRollRow): RollScale | null => {
  const s = r.scans[0];
  return s?.widthIn && s.imageWidth && s.imageHeight
    ? { widthIn: s.widthIn, width: s.imageWidth, height: s.imageHeight, shot: s.sequence }
    : null;
};

const toOpenRoll = (
  r: OpenRollRow,
  viewerId?: string,
  lunchOn?: LunchOn,
  now: Date = appNow(),
): OpenRoll => ({
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
  scale: scaleOfRoll(r),
  lunches: r.startedAt && lunchOn ? lunchDays(r.startedAt, now, lunchOn) : {},
  location: r.location ? { code: r.location.code, name: r.location.name } : null,
  takenFromId: null,
});

/** Settings → Lunch break's rows as a lookup by day, for the scanning timer (D-121). */
async function loadLunchOn(): Promise<LunchOn> {
  return lunchLookup(await listLunchBreaks());
}

/** Every open roll, for the Capture page's Roll dropdown (newest first). */
export async function openRollsForCapture(
  viewer: Actor,
  now: Date = appNow(),
): Promise<OpenRoll[]> {
  const [rows, lunchOn] = await Promise.all([listOpenRolls(), loadLunchOn()]);
  const takenFrom = await lastTakenFrom(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...toOpenRoll(r, viewer.id, lunchOn, now),
    takenFromId: takenFrom.get(r.id) ?? null,
  }));
}

export type ReadyRoll = Pick<
  OpenRoll,
  "id" | "code" | "tagCode" | "supplier" | "item" | "areaSqFt" | "location"
>;

/** Rolls in stock and not scanned yet, oldest first, for Capture's Scan a roll (Phase 30A). */
export async function readyRollsForCapture(): Promise<ReadyRoll[]> {
  return (await listReadyRolls()).map((r) => {
    const { id, code, tagCode, supplier, item, areaSqFt, location } = toOpenRoll(r);
    return { id, code, tagCode, supplier, item, areaSqFt, location };
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
  values: Omit<AddRollsValues, "locationId"> & { locationId?: string | null },
  actor: Actor,
  now: Date = appNow(),
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
  const location = values.locationId ? await activeLocation(values.locationId) : null;

  // About seven statements a roll in one transaction: a delivery of 25 can pass Prisma's default
  // 5 s on a busy laptop (Phase 33 run 1, demo:reset after the e2e suite), so it gets 30 s.
  return runInTransaction(
    async (tx) => {
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
            locationId: location?.id ?? null,
            locatedAt: location ? now : null,
          },
          tx,
        );
        if (location)
          await insertRollMove(
            {
              rollId: row.id,
              fromLocationId: null,
              toLocationId: location.id,
              reason: "PLACED",
              byId: actor.id,
              at: now,
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
          location: location?.code ?? null,
          rolls: added.map(({ code, areaSqFt, tagCode }) => ({ code, areaSqFt, tagCode })),
          quantityOnHand: onHand,
        },
      });
      return { added, quantityOnHand: onHand };
    },
    { timeoutMs: 30_000 },
  );
}

/** Pick a roll at Capture (Phase 30A): a roll in stock, not scanned yet, becomes Being scanned. */
export async function startRoll(id: string, actor: Actor, now: Date = appNow()) {
  const roll = await loadRoll(id);
  refuse(planStart(stateOf(roll)));
  return runInTransaction(async (tx) => {
    const done = await moveRoll(
      id,
      "IN_STOCK",
      { status: "OPEN", startedAt: now, startedById: actor.id, locationId: null, locatedAt: null },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    // It leaves its place in storage for the table (Phase 32).
    if (roll.locationId)
      await insertRollMove(
        {
          rollId: id,
          fromLocationId: roll.locationId,
          toLocationId: null,
          reason: "TAKEN_FOR_USE",
          byId: actor.id,
          at: now,
        },
        tx,
      );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.start",
      entity: "Roll",
      entityId: id,
      before: { status: "IN_STOCK", location: roll.location?.code ?? null },
      after: { status: "OPEN", code: roll.code, location: null },
    });
    return {
      ...toOpenRoll(
        { ...roll, status: "OPEN", startedAt: now, startedById: actor.id, location: null },
        actor.id,
        await loadLunchOn(),
        now,
      ),
      takenFromId: roll.locationId,
    };
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
  /** Working time from Start scanning to now, lunch left out (D-121). */
  scanningMs: number | null;
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
  now: Date = appNow(),
): Promise<FinishResult> {
  const roll = await loadRoll(id);
  refuse(planFinish(stateOf(roll)));
  const [settings, lunchOn] = await Promise.all([getCvSettings(), loadLunchOn()]);
  const limitPct = settings?.returnSharePct ?? 10;
  const timeMs = roll.startedAt ? scanningMs(roll.startedAt, now, lunchOn) : null;
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
        scanningMs: timeMs,
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
      scanningMs: timeMs,
    };
  });
}

/**
 * Put back at Capture: a roll picked by mistake, with no shots. A roll from Inventory waits to be
 * scanned again; one from before Phase 30A is cancelled, as it was then.
 */
export async function putBackRoll(
  id: string,
  actor: Actor,
  now: Date = appNow(),
  locationId: string | null = null,
) {
  const roll = await loadRoll(id);
  const state = stateOf(roll);
  refuse(planPutBack(state));
  // Where it went (Phase 32): only a roll from Inventory goes back into storage.
  const location = locationId && state.fromInventory ? await activeLocation(locationId) : null;
  return runInTransaction(async (tx) => {
    const done = await moveRoll(
      id,
      "OPEN",
      state.fromInventory
        ? {
            status: "IN_STOCK",
            startedAt: null,
            startedById: null,
            locationId: location?.id ?? null,
            locatedAt: location ? now : null,
          }
        : { status: "CANCELLED", cancelledAt: now, cancelledById: actor.id, cancelledReason: null },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    if (location)
      await insertRollMove(
        {
          rollId: id,
          fromLocationId: null,
          toLocationId: location.id,
          reason: "PUT_BACK",
          byId: actor.id,
          at: now,
        },
        tx,
      );
    const status = state.fromInventory ? ("IN_STOCK" as const) : ("CANCELLED" as const);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: state.fromInventory ? "roll.put_back" : "roll.cancel",
      entity: "Roll",
      entityId: id,
      before: { status: "OPEN" },
      after: { status, code: roll.code, location: location?.code ?? null },
    });
    return { id, code: roll.code, status, location: location?.code ?? null };
  });
}

/**
 * Remove a roll (the Floor Manager, with a reason): a roll from Inventory still in stock or being
 * scanned (damaged, lost, added by mistake) leaves stock (−1); a scanned roll is already off stock.
 * A roll from before Phase 30A can be removed only while open, as the old Cancel. Nothing is
 * deleted: its shots stay, out of the reports.
 */
export async function removeRoll(id: string, reason: string, actor: Actor, now: Date = appNow()) {
  const roll = await loadRoll(id);
  const state = stateOf(roll);
  refuse(planRemove(state));
  return runInTransaction(async (tx) => {
    const done = await moveRoll(
      id,
      roll.status,
      {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: actor.id,
        cancelledReason: reason,
        locationId: null,
        locatedAt: null,
      },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    if (roll.locationId)
      await insertRollMove(
        {
          rollId: id,
          fromLocationId: roll.locationId,
          toLocationId: null,
          reason: "REMOVED",
          note: reason,
          byId: actor.id,
          at: now,
        },
        tx,
      );
    if (state.fromInventory)
      await takeFromStock(tx, roll, `Roll ${roll.code} removed: ${reason}`, actor, now);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.remove",
      entity: "Roll",
      entityId: id,
      before: { status: roll.status, location: roll.location?.code ?? null },
      after: {
        status: "CANCELLED",
        code: roll.code,
        shots: roll._count.scans,
        reason,
        location: null,
      },
    });
    return { id, code: roll.code, status: "CANCELLED" as const };
  });
}

/**
 * The Floor Manager corrects a roll's details, with a reason (Phase 35B, A-104): its tag number, the
 * day it was received, its return note (once a decision exists) and its area until Finish roll. The
 * supplier and leather item don't change (stock is counted per item) and its place stays with Move.
 * Only what changes goes in the audit, with the old and the new value.
 */
export async function updateRoll(
  id: string,
  input: UpdateRollInput,
  actor: Actor,
  now: Date = appNow(),
) {
  const roll = await loadRoll(id);
  if (roll.status === "CANCELLED") throw Errors.conflict(ROLL_EDIT_MESSAGES.removed(roll.code));
  if (roll.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString())
    throw Errors.stale(ROLL_MESSAGES.stale);
  const plan = planRollEdit(
    {
      status: roll.status,
      fromInventory: roll.itemId !== null,
      tagCode: roll.tagCode,
      receivedOn: dayOf(roll.receivedAt),
      areaSqFt: area(roll.areaSqFt),
      returnDecision: roll.returnDecision,
      returnNote: roll.returnNote,
    },
    input,
    manilaToday(now),
  );
  if (!plan.ok)
    throw Errors.validation(
      Object.entries(plan.errors).map(([field, message]) => ({
        path: [field],
        message: message as string,
      })),
    );
  const { receivedOn, ...rest } = plan.changes;
  return runInTransaction(async (tx) => {
    const done = await updateRollDetails(
      id,
      roll.updatedAt,
      { ...rest, ...(receivedOn ? { receivedAt: new Date(`${receivedOn}T00:00:00Z`) } : {}) },
      tx,
    );
    if (!done) throw Errors.stale(ROLL_MESSAGES.stale);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.update",
      entity: "Roll",
      entityId: id,
      before: plan.before,
      after: { code: roll.code, ...plan.changes, reason: input.reason },
    });
    return { id, code: roll.code, changed: Object.keys(plan.changes) };
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

/** Rolls scanned on one Manila day, and how many of them were returned to the supplier. */
export type RollDayOutcome = { scanned: number; returned: number };

/**
 * Rolls scanned per Manila day from `from` to `to` (Phase 30E-2, D-114): each roll counts on the
 * day its Finish roll was pressed, whatever the leather; `returned` are those over the defect limit
 * (D-116), so the rolls used that day are `scanned − returned` (D-118). Days with none are left
 * out.
 */
export async function rollOutcomesByDay(
  from: string,
  to: string,
): Promise<Map<string, RollDayOutcome>> {
  const rolls = await listRollFinishes(manilaDayStart(from), manilaDayStart(addDays(to, 1)));
  const out = new Map<string, RollDayOutcome>();
  for (const r of rolls) {
    const day = manilaDayOf(r.finishedAt);
    const now = out.get(day) ?? { scanned: 0, returned: 0 };
    out.set(day, {
      scanned: now.scanned + 1,
      returned: now.returned + (isReturnedToSupplier(r) ? 1 : 0),
    });
  }
  return out;
}

/** Rolls scanned per Manila day from `from` to `to` (Phase 30E-2, D-114). */
export async function rollsScannedByDay(from: string, to: string): Promise<Map<string, number>> {
  const outcomes = await rollOutcomesByDay(from, to);
  return new Map([...outcomes].map(([day, o]) => [day, o.scanned]));
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

// ───────────── Where a roll is kept (Phase 32, D-128) ─────────────

/** A location that may take rolls, or a 404 / 409 that names the fix. */
async function activeLocation(id: string, tx?: Tx) {
  const location = await findLocation(id, tx);
  if (!location) throw Errors.notFound("This location");
  if (!location.isActive) throw Errors.conflict(LOCATION_MESSAGES.notActive);
  return location;
}

type StorageFields = Pick<
  RollListRow,
  "code" | "status" | "markedForReturn" | "returnDecision" | "pickedUpAt" | "locationId"
>;

const storageOf = (r: StorageFields) => ({
  code: r.code,
  status: r.status,
  markedForReturn: r.markedForReturn,
  returnDecision: r.returnDecision,
  pickedUpAt: r.pickedUpAt,
  locationId: r.locationId,
});

/**
 * The Floor Manager places or moves rolls (A-56), up to 50 at a time: all or nothing. Each roll
 * gets one history row (Placed when it had no place, else Moved); one audit row lists them.
 */
export async function moveRolls(values: MoveRollsValues, actor: Actor, now: Date = appNow()) {
  const target = await activeLocation(values.toLocationId);
  const rolls = await findRollsByIds(values.rollIds);
  if (rolls.length !== values.rollIds.length) throw Errors.notFound("One of these rolls");
  const plans = rolls.map((roll) => ({ roll, plan: planMove(storageOf(roll), target) }));
  const refused = plans.find((p) => !p.plan.ok);
  if (refused && !refused.plan.ok) throw Errors.conflict(refused.plan.reason);

  return runInTransaction(async (tx) => {
    // Checked again inside, so a location deactivated meanwhile takes no rolls.
    await activeLocation(target.id, tx);
    const moved = [];
    for (const { roll, plan } of plans) {
      if (!plan.ok) continue;
      const done = await setRollLocation(
        roll.id,
        { status: roll.status, locationId: roll.locationId },
        { locationId: target.id, locatedAt: now },
        tx,
      );
      if (!done) throw Errors.stale(LOCATION_MESSAGES.stale);
      await insertRollMove(
        {
          rollId: roll.id,
          fromLocationId: roll.locationId,
          toLocationId: target.id,
          reason: plan.reason,
          note: values.note,
          byId: actor.id,
          at: now,
        },
        tx,
      );
      moved.push({
        id: roll.id,
        code: roll.code,
        from: roll.location?.code ?? null,
        to: target.code,
      });
    }
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.move",
      entity: "StorageLocation",
      entityId: target.id,
      // Where each roll was before (run 1 F2), and where they all went.
      before: { rolls: moved.map(({ code, from }) => ({ code, location: from })) },
      after: {
        to: target.code,
        note: values.note,
        rolls: moved.map(({ code, from }) => ({ code, from })),
      },
    });
    return { moved };
  });
}

/**
 * Set a roll that finished Returned to supplier aside for the supplier, e.g. in the return area
 * (A-77): the constructor right after Finish roll, or the Floor Manager later.
 */
export async function setAsideRoll(
  id: string,
  locationId: string,
  actor: Actor,
  now: Date = appNow(),
) {
  const roll = await loadRoll(id);
  const target = await activeLocation(locationId);
  refuse(planSetAside(storageOf(roll), target));
  return runInTransaction(async (tx) => {
    const done = await setRollLocation(
      id,
      { status: roll.status, locationId: roll.locationId },
      { locationId: target.id, locatedAt: now },
      tx,
    );
    if (!done) throw Errors.stale(LOCATION_MESSAGES.stale);
    await insertRollMove(
      {
        rollId: id,
        fromLocationId: roll.locationId,
        toLocationId: target.id,
        reason: "SET_ASIDE_FOR_RETURN",
        byId: actor.id,
        at: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.set_aside",
      entity: "Roll",
      entityId: id,
      before: { location: roll.location?.code ?? null },
      after: { code: roll.code, location: target.code },
    });
    return { id, code: roll.code, location: { code: target.code, name: target.name } };
  });
}

/** The supplier took a Returned to supplier roll (A-77): it leaves storage for good. */
export async function markPickedUp(id: string, actor: Actor, now: Date = appNow()) {
  const roll = await loadRoll(id);
  refuse(planPickedUp(storageOf(roll)));
  return runInTransaction(async (tx) => {
    const done = await setRollLocation(
      id,
      { status: roll.status, locationId: roll.locationId },
      { locationId: null, locatedAt: null, pickedUpAt: now },
      tx,
    );
    if (!done) throw Errors.stale(LOCATION_MESSAGES.stale);
    await insertRollMove(
      {
        rollId: id,
        fromLocationId: roll.locationId,
        toLocationId: null,
        reason: "PICKED_UP_BY_SUPPLIER",
        byId: actor.id,
        at: now,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll.picked_up",
      entity: "Roll",
      entityId: id,
      before: { location: roll.location?.code ?? null, pickedUpAt: null },
      after: { code: roll.code, location: null, pickedUpAt: now },
    });
    return { id, code: roll.code, pickedUpAt: now.toISOString() };
  });
}

export type RollHistoryEntry = {
  id: string;
  at: string;
  reason: RollMoveRow["reason"];
  /** "Moved", "Taken for scanning", … */
  label: string;
  from: string | null;
  to: string | null;
  note: string | null;
};

const toHistory = (m: RollMoveRow): RollHistoryEntry => ({
  id: m.id,
  at: m.at.toISOString(),
  reason: m.reason,
  label: MOVE_REASON_LABELS[m.reason],
  from: m.fromLocation ? locationText(m.fromLocation) : null,
  to: m.toLocation ? locationText(m.toLocation) : null,
  note: m.note,
});

/** A roll's location history, newest first, with no names (A-78). */
export async function rollHistory(id: string): Promise<RollHistoryEntry[]> {
  return (await listRollMoves(id)).map(toHistory);
}

export type FoundRoll = {
  id: string;
  code: string;
  /** Its code before Phase 33's rename (D-129), shown as "Formerly B-2026-0003". */
  formerCode: string | null;
  tagCode: string | null;
  status: RollStatus;
  /** "Not yet scanned", "Returned to supplier", … as the badge reads. */
  statusText: string;
  item: string | null;
  supplier: string | null;
  areaSqFt: number | null;
  receivedOn: string | null;
  location: { id: string; code: string; name: string | null } | null;
  /** Where it is, in one line: "R1-B3 · Rack 1, bin 3", "Not placed", "Being scanned at Capture"… */
  where: string;
  /** The Floor Manager may place or move it. */
  canMove: boolean;
  /** Returned to supplier and not yet taken (A-77). */
  awaitsPickup: boolean;
};

/** Where a roll is now, in one line (Phase 32). */
function whereOf(
  r: StorageFields & Pick<RollListRow, "location" | "finishedAt" | "cancelledAt">,
): string {
  return whereText(
    { ...storageOf(r), location: r.location, finishedAt: r.finishedAt, cancelledAt: r.cancelledAt },
    (d) => formatManilaDateTime(d),
  );
}

export function toFoundRoll(r: RollListRow): FoundRoll {
  const storage = storageOf(r);
  return {
    id: r.id,
    code: r.code,
    formerCode: r.formerCode,
    tagCode: r.tagCode,
    status: r.status,
    statusText: rollStatusText(r),
    item: r.item?.name ?? null,
    supplier: r.supplier?.name ?? null,
    areaSqFt: area(r.areaSqFt),
    receivedOn: dayOf(r.receivedAt),
    location: r.location,
    where: whereOf(r),
    canMove: mayHoldLocation(storage),
    awaitsPickup: awaitsPickup(storage),
  };
}

export type FindResult = {
  rolls: FoundRoll[];
  location: (Location & { contents: FoundRoll[] }) | null;
  /** Nothing matched: the message to show, naming the fix. */
  message: string | null;
};

/**
 * Find roll (Phase 32): a typed or scanned code. `LOC:R1-B3` (a location label) lists what is
 * there; anything else is a roll code or supplier tag, and when no roll matches, a location code
 * typed by hand.
 */
export async function findRolls(q: string): Promise<FindResult> {
  const scanned = parseScannedCode(q);
  if (!scanned) return { rolls: [], location: null, message: noMatchMessage(q) };
  const locationResult = async (code: string) => {
    const row = await findLocationByCode(code);
    if (!row) return null;
    const contents = (await listRollsInLocation(row.id)).map(toFoundRoll);
    return { ...toLocation(row), contents };
  };
  if (scanned.kind === "location") {
    const location = await locationResult(scanned.code);
    return { rolls: [], location, message: location ? null : noMatchMessage(scanned.code) };
  }
  const rolls = (await findRollsByCodeOrTag(scanned.code)).map(toFoundRoll);
  const location = rolls.length === 0 ? await locationResult(scanned.code) : null;
  const message = rolls.length === 0 && !location ? noMatchMessage(scanned.code) : null;
  return { rolls, location, message };
}
