import { appNow } from "@/lib/clock";
import { manilaToday } from "@/lib/format";
import { DEFAULT_LUNCH, DEFAULT_SCHEDULE, batchesFor, isoWeekday } from "@/lib/production-rules";
import { addDays, manilaDayStart } from "@/lib/report-rules";
import { measureShot, rollShare, type CountRule } from "@/lib/measure";
import {
  renderLeatherImage,
  scenario,
  type Detection,
  type Random,
  type SceneClass,
} from "@/server/lib/leather-scan";
import { DEMO_SUPPLIERS } from "@/server/lib/demo-suppliers";
import { logger } from "@/server/lib/logger";
import { countRolls } from "@/server/models/roll.model";
import { findInventoryItem, findInventoryItemBySku } from "@/server/models/inventory.model";
import { listActiveSuppliers, listDefectTypes } from "@/server/models/reference-data.model";
import { findUserByEmail } from "@/server/models/user.model";
import { getAttendanceDay, saveAttendanceDay } from "./attendance.service";
import {
  addRolls,
  finishRoll,
  markPickedUp,
  moveRolls,
  removeRoll,
  setAsideRoll,
  startRoll,
} from "./roll.service";
import { ensureLocation } from "./location.service";
import { ensureSupplierWithCode } from "./supplier-code.service";
import { setCameraOperator } from "./camera.service";
import { markNonWorking, queueFromTheStart, saveCheckIn, saveDayPlan } from "./production.service";
import { queuedBatchAt, setBatchPriority } from "./batch-queue.service";
import { createItem } from "./inventory.service";
import { saveStockUpdate } from "./stock-update.service";
import { ingestScan } from "./scan-ingest.service";

/**
 * The demo week (D-026, D-090): replays a small, believable past week of production through the
 * real services, each with its own `now`, so rolls, scans, the stock ledger, attendance,
 * check-ins and audit rows all agree. Every section is Pass or Reject and nobody changes it
 * (D-093). Every detection is a defect type the database knows (D-108). Rolls are started, captured and finished on the
 * Capture page by demo constructors the System Admin allowed (Phase 26, D-095). Opt-in
 * (SEED_DEMO_WEEK or `npm run demo:seed`), and only on a database with no rolls. The same seed
 * gives the same week.
 */

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
const MINUTE = 60_000;

/**
 * Minutes a roll is scanned for, from Start scanning to Finish roll (D-123): small rolls, like the
 * 4.75 sq ft pieces used for the live demo, take a few minutes.
 */
export const PREPARATION_MINUTES: [number, number] = [1, 3];

/** The area of each demo roll, in sq ft (D-123): small pieces, 4 to 7 sq ft. */
export const DEMO_ROLL_AREA_SQ_FT: [number, number] = [4, 7];
/**
 * The demo phones' scale (Phase 30C, D-120): the inches a demo photo covers across, as the fake
 * camera reads the card (16.0 in). Every demo shot is measured with it, so each finished roll has
 * a Defect %.
 */
export const DEMO_WIDTH_IN = 16;
/** The demo photo's height ÷ width (480 × 360). */
const DEMO_ASPECT = 0.75;
/** The sq ft one demo shot covers: 16 × 12 in. */
export const DEMO_SHOT_SQ_FT = (DEMO_WIDTH_IN * DEMO_WIDTH_IN * DEMO_ASPECT) / 144;

/**
 * Shots per demo roll (D-090, D-123): enough to cover its area edge to edge (3 for 4 sq ft, 6 for
 * 7 sq ft). Real rolls vary: a constructor finishes when all of it is in.
 */
export function sectionsFor(areaSqFt: number): number {
  return Math.max(1, Math.ceil(areaSqFt / DEMO_SHOT_SQ_FT - 1e-9));
}
/** How many days back the demo data reaches, today included: two working weeks (D-126). */
export const DEMO_DAYS = 14;
/**
 * When each working day's rolls are laid out (Manila hours), lunch left out: 25 a day, every 17
 * minutes or so, so the line finishes about 300 pairs a day, 12 pairs a leather roll (D-127).
 */
export const DEMO_ROLL_SLOTS = [
  ...Array.from({ length: 10 }, (_, i) => 8 + i * 0.28),
  ...Array.from({ length: 15 }, (_, i) => 12 + i * 0.28),
];
/** Pairs finished per leather roll that the demo aims at: 300 for every 25 rolls (D-127). */
export const DEMO_PAIRS_PER_ROLL = 12;
/**
 * The rolls (by their place in the two weeks, 25 a working day) whose leather is badly damaged: a
 * random mix of holes, scratches, creases and long cuts until each reaches its own share between
 * 11% and 16%, so they go over the 10% limit and are Returned to supplier (D-112, D-116, D-124).
 * Spread over both weeks; all are Marikina Supplier A's, the leather with more defects, so its
 * returned share is well above the line's and it reads High (D-127).
 */
export const DEMO_DAMAGED_ROLLS = [8, 26, 40, 56, 70, 88, 104, 118, 134, 148, 164, 178, 196, 214];
/** The rolls with many defects that still pass, one each week: 7% to 9% (D-124, D-127). */
export const DEMO_NEAR_LIMIT_ROLLS = [63, 187];
/** The return limit the demo aims around (Settings' default, C-9). */
export const DEMO_LIMIT_PCT = 10;
export const DEMO_DAMAGED_SHARE: [number, number] = [11, 16];
export const DEMO_NEAR_LIMIT_SHARE: [number, number] = [7, 9];
/** At most this many defects on one shot of a damaged roll. */
const MAX_DEFECTS_PER_SHOT = 6;
const DEMO_SCALE = { widthIn: DEMO_WIDTH_IN, aspect: DEMO_ASPECT };

/** A defect type as the demo week reads it: its outcome and how it counts (D-110). */
export type DemoClass = SceneClass & CountRule;

/**
 * Box sizes per defect, in fractions of the 16 × 12 in photo: a hole is small, a scratch long
 * and thin, a crease wide, and a long cut always reaches 3 in by its diagonal (3.2 × 1.2 in at
 * least). Other types take the simulator's sizes.
 */
const SHAPES: Record<string, { w: [number, number]; h: [number, number] }> = {
  hole: { w: [0.05, 0.12], h: [0.06, 0.15] },
  scratch: { w: [0.2, 0.45], h: [0.08, 0.22] },
  crease: { w: [0.15, 0.35], h: [0.1, 0.22] },
  cut: { w: [0.2, 0.3], h: [0.1, 0.2] },
};
const OTHER_SHAPE = { w: [0.06, 0.2] as [number, number], h: [0.05, 0.18] as [number, number] };
/** How often each type is drawn on a damaged roll: holes and scratches most, a few cuts. */
const DAMAGE_WEIGHTS: Record<string, number> = { hole: 3, scratch: 3, crease: 2, cut: 1.5 };

/**
 * A roll's defect share as the app works it out (D-103, D-110): the found defects' box area over
 * the roll's area, plus 1% per cut from 3 in, at the demo scale. Found means 50% or more.
 */
export function demoRollShare(
  shots: readonly Detection[][],
  areaSqFt: number,
  classes: readonly DemoClass[],
): number {
  const rules = new Map(classes.map((c) => [c.key, c] as const));
  const measured = shots.map((detections) =>
    measureShot(
      detections.map((d) => {
        const c = rules.get(d.classKey);
        return {
          box: d.box,
          found: d.confidence >= 0.5,
          rule: c ? { notAcceptedFromIn: c.notAcceptedFromIn, flatSharePct: c.flatSharePct } : null,
        };
      }),
      DEMO_SCALE,
    ),
  );
  const share = rollShare(areaSqFt, measured, DEMO_LIMIT_PCT);
  return share.measured ? share.sharePct : 0;
}

/**
 * Adds random found defects (holes, scratches, creases, long cuts) to a roll's shots until its
 * share reaches a random target in `range`, never going above the range's top (D-124). Each
 * damaged roll ends with its own mix.
 */
export function damageRoll(
  random: Random,
  shots: readonly Detection[][],
  areaSqFt: number,
  classes: readonly DemoClass[],
  range: [number, number],
): Detection[][] {
  const rand = (lo: number, hi: number) => lo + random() * (hi - lo);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const out = shots.map((s) => [...s]);
  if (out.length === 0) return out;
  const pool = classes.filter((c) => DAMAGE_WEIGHTS[c.key]);
  const weighted = (pool.length > 0 ? pool : classes).map((c) => ({
    key: c.key,
    weight: DAMAGE_WEIGHTS[c.key] ?? 1,
  }));
  const total = weighted.reduce((t, w) => t + w.weight, 0);
  const draw = () => {
    let r = random() * total;
    for (const w of weighted) if ((r -= w.weight) < 0) return w.key;
    return weighted[weighted.length - 1].key;
  };
  const [lo, hi] = range;
  const goal = rand(lo, hi);
  let share = demoRollShare(out, areaSqFt, classes);
  for (let tries = 0; share < goal && tries < 400; tries++) {
    const key = draw();
    const shape = SHAPES[key] ?? OTHER_SHAPE;
    const width = rand(...shape.w);
    const height = rand(...shape.h);
    const open = out.filter(
      (s) => s.filter((d) => d.confidence >= 0.5).length < MAX_DEFECTS_PER_SHOT,
    );
    if (open.length === 0) break;
    const shot = open[Math.floor(random() * open.length)];
    shot.push({
      classKey: key,
      confidence: round(rand(0.7, 0.98)),
      box: {
        x: round(rand(0.02, 0.98 - width)),
        y: round(rand(0.02, 0.98 - height)),
        width: round(width),
        height: round(height),
      },
    });
    const next = demoRollShare(out, areaSqFt, classes);
    if (next > hi) {
      shot.pop();
      continue;
    }
    share = next;
  }
  return out;
}

/**
 * The demo constructors who capture (Phase 26): Noel Manalo and three of the twelve, given camera
 * access by the System Admin. They are never marked absent on a day they capture.
 */
export const DEMO_CAPTURERS = [
  "constructor@cpoint.local",
  "arnel.bautista@cpoint.local",
  "jocelyn.reyes@cpoint.local",
  "rommel.delacruz@cpoint.local",
] as const;

/** The model the website camera runs (cv/MODEL_CARD.md), named on every demo scan. */
export const DEMO_MODEL_VERSION = "yolo-v1-1d729fb0";

/**
 * Constructors absent on the demo's working days before today, oldest first (D-081, D-126). On
 * the eighth day (none absent) the Quality Inspector is absent instead, so the Floor Manager
 * enters that day's check-ins (D-088).
 */
const ABSENT = [0, 1, 0, 4, 0, 1, 5, 0, 3, 2];
const QI_ABSENT_INDEX = 7;

export function preparationMs(random: Random): number {
  const [lo, hi] = PREPARATION_MINUTES;
  return (lo + random() * (hi - lo)) * MINUTE;
}

/** The one daily quota of passed pairs in the demo week (Phase 27, C-30, C-41). */
export const DEMO_QUOTA = 300;

/**
 * Demo output per Shoe Constructor present per working hour. It follows the roster, so a day with
 * one constructor absent still makes the quota after its few failed pairs and a day with two or
 * more absent doesn't, whether the database has the 12 demo constructors or a few more (D-081).
 * The quota sits halfway between the output of `most - 1` and `most - 2` constructors.
 */
export function demoRate(most: number, workingHours: number): number {
  return (DEMO_QUOTA + 3) / (Math.max(workingHours, 1) * Math.max(most - 1.5, 0.5));
}

/**
 * Demo materials (also used by bootstrap when only demo users are on). A leather roll names its
 * supplier (Phase 29, D-102), one of the demo suppliers. A leather item starts at 0: its count
 * follows the rolls the demo week adds (Phase 30A, D-104).
 */
export const DEMO_INVENTORY = [
  {
    sku: "LR-001",
    name: "Black cowhide (school shoes)",
    category: "LEATHER_ROLL",
    unit: "roll",
    reorderLevel: 3,
    openingStock: 0,
    supplier: "Bulacan Supplier A",
  },
  {
    sku: "LR-002",
    name: "Brown suede (topsiders)",
    category: "LEATHER_ROLL",
    unit: "roll",
    reorderLevel: 2,
    openingStock: 0,
    supplier: "Marikina Supplier A",
  },
  {
    sku: "LR-003",
    name: "Black cowhide (store)",
    category: "LEATHER_ROLL",
    unit: "roll",
    reorderLevel: 1,
    openingStock: 0,
    supplier: "Bulacan Supplier B",
  },
  {
    sku: "NL-001",
    name: "Shoe tacks, 12 mm",
    category: "NAILS",
    unit: "box",
    reorderLevel: 5,
    openingStock: 20,
  },
  {
    sku: "AD-001",
    name: "Contact cement",
    category: "ADHESIVE",
    unit: "can",
    reorderLevel: 4,
    openingStock: 6,
  },
  {
    sku: "TH-001",
    name: "Waxed thread, black",
    category: "THREAD",
    unit: "spool",
    reorderLevel: 6,
    openingStock: 10,
  },
] as const;

/** A demo item's form values, with its supplier's id (the supplier is added if missing). */
export async function demoItemValues(item: (typeof DEMO_INVENTORY)[number]) {
  const { supplier, ...values } = item as (typeof DEMO_INVENTORY)[number] & { supplier?: string };
  if (!supplier) return { ...values, supplierId: null };
  const known = DEMO_SUPPLIERS.find((s) => s.name === supplier);
  const row = await ensureSupplierWithCode(known ?? { name: supplier, notes: "" });
  return { ...values, supplierId: row.id };
}

export type DemoSeedResult =
  | {
      seeded: true;
      rolls: number;
      scans: number;
      attendanceDays: number;
      checkIns: number;
      stockUpdates: number;
      ms: number;
    }
  | { seeded: false; reason: string };

/** The demo's placeholder bins (Phase 32, A-53): CPoint's real rack layout isn't known yet. */
export const DEMO_BINS: readonly [string, string][] = [
  ["R1-B1", "Rack 1, bin 1"],
  ["R1-B2", "Rack 1, bin 2"],
  ["R1-B3", "Rack 1, bin 3"],
  ["R2-B1", "Rack 2, bin 1"],
  ["R2-B2", "Rack 2, bin 2"],
  ["R2-B3", "Rack 2, bin 3"],
];

export async function seedDemoWeek(
  options: { now?: Date; seed?: number; imageSize?: number } = {},
): Promise<DemoSeedResult> {
  const started = Date.now();
  const now = options.now ?? appNow();
  const random = mulberry32(options.seed ?? 20261003);
  const between = (lo: number, hi: number) => lo + random() * (hi - lo);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const past = (t: Date) => t.getTime() <= now.getTime() - MINUTE;
  const plus = (t: Date, ms: number) => new Date(t.getTime() + ms);

  if ((await countRolls()) > 0) return { seeded: false, reason: "rolls already exist" };
  const [fm, qi, admin] = await Promise.all([
    findUserByEmail("manager@cpoint.local"),
    findUserByEmail("inspector@cpoint.local"),
    findUserByEmail("admin@cpoint.local"),
  ]);
  if (!fm || !qi || !admin)
    return { seeded: false, reason: "demo users are missing (set SEED_DEMO_USERS=true)" };
  // Three leather suppliers, so Supplier quality has something to compare (Phase 20, D-090).
  for (const supplier of DEMO_SUPPLIERS) await ensureSupplierWithCode(supplier);
  const [activeSuppliers, defectTypes] = await Promise.all([
    listActiveSuppliers(),
    listDefectTypes(),
  ]);
  // The demo's own suppliers, in their listed order (not the bootstrap's placeholder).
  const demoSuppliers = DEMO_SUPPLIERS.flatMap((d) =>
    activeSuppliers.filter((s) => s.name === d.name),
  );
  const suppliers = demoSuppliers.length > 0 ? demoSuppliers : activeSuppliers;
  if (suppliers.length === 0) return { seeded: false, reason: "no active suppliers" };
  // The System Admin lets the capturers capture (C-23); each gets it once, as in Users.
  const capturers = [];
  for (const email of DEMO_CAPTURERS) {
    const person = await findUserByEmail(email);
    if (!person?.isActive) continue;
    if (!person.canCapture) await setCameraOperator(person.id, true, admin);
    capturers.push(person);
  }
  if (capturers.length === 0)
    return { seeded: false, reason: "demo constructors are missing (set SEED_DEMO_USERS=true)" };
  const capturerIds = new Set(capturers.map((c) => c.id));
  // The week's scans show the defect types active in Settings, as the camera's model would.
  const classes = defectTypes
    .filter((t) => t.isActive)
    .map((t): DemoClass => ({
      key: t.key,
      outcome: t.outcome,
      notAcceptedFromIn: t.notAcceptedFromIn == null ? null : Number(t.notAcceptedFromIn),
      flatSharePct: t.flatSharePct == null ? null : Number(t.flatSharePct),
    }));
  if (classes.length === 0) return { seeded: false, reason: "no active defect types" };

  const today = manilaToday(now);
  const at = (day: string, hour: number) => new Date(manilaDayStart(day).getTime() + hour * HOUR);
  const firstDay = addDays(today, -(DEMO_DAYS - 1));

  // ── inventory: the shelf at the start of the week. What came in and what the line used is
  //    noted as it happens, and the Floor Manager enters it on the Update stock sheet on the
  //    week's Wednesday and Friday (Phase 29, D-102); see seedStockUpdates. ──
  const itemIds = new Map<string, string>();
  for (const item of DEMO_INVENTORY) {
    const existing = await findInventoryItemBySku(item.sku);
    const id =
      existing?.id ??
      (await createItem(await demoItemValues(item), fm, at(addDays(firstDay, -1), 16))).id;
    itemIds.set(item.sku, id);
  }
  const shelf: { sku: string; type: "IN" | "OUT"; quantity: number; t: Date }[] = [];
  const stock = async (
    sku: string,
    type: "IN" | "OUT",
    quantity: number,
    _note: string,
    t: Date,
  ) => {
    if (past(t)) shelf.push({ sku, type, quantity, t });
  };
  await stock("NL-001", "IN", 10, "Delivery received", at(addDays(firstDay, 3), 10));
  await stock("TH-001", "IN", 10, "Delivery received", at(addDays(firstDay, 2), 14));
  await stock("AD-001", "IN", 3, "Delivery received", at(addDays(firstDay, 3), 14));
  // The second week's deliveries (D-126).
  await stock("TH-001", "IN", 6, "Delivery received", at(addDays(firstDay, 9), 14));
  await stock("AD-001", "IN", 3, "Delivery received", at(addDays(firstDay, 10), 14));

  // ── storage locations (Phase 32, D-128): placeholder racks and bins and a return area. CPoint
  //    hasn't confirmed its rack layout (A-53), so these codes are the demo's only. ──
  const bins: string[] = [];
  for (const [code, name] of DEMO_BINS)
    bins.push((await ensureLocation({ code, name, kind: "BIN", notes: null }, fm)).id);
  const returnArea = (
    await ensureLocation(
      {
        code: "RETURN",
        name: "Return area",
        kind: "AREA",
        notes: "Rolls Returned to supplier wait here for the supplier.",
      },
      fm,
    )
  ).id;
  let delivery = 0;

  // ── leather rolls (Phase 30A, D-103, D-104): the Floor Manager adds each roll to its item with
  //    its own area, the evening before the week and when a delivery comes in. A constructor picks
  //    the oldest roll of the item at Capture. ──
  const shelfRolls = new Map<
    string,
    { id: string; code: string; addedAt: Date; areaSqFt: number; locationId: string }[]
  >();
  const addDemoRolls = async (sku: string, count: number, t: Date) => {
    if (!past(t)) return;
    const [minArea, maxArea] = DEMO_ROLL_AREA_SQ_FT;
    // Each delivery goes into the next bin (Phase 32).
    const locationId = bins[delivery++ % bins.length];
    const areas = Array.from(
      { length: count },
      () => Math.round(between(minArea, maxArea) * 4) / 4,
    );
    const result = await addRolls(
      itemIds.get(sku)!,
      {
        receivedOn: manilaToday(t),
        rolls: areas.map((areaSqFt, i) => ({
          areaSqFt,
          tagCode:
            i % 2 === 0 ? `T${manilaToday(t).slice(5).replace("-", "")}-${i + 1}` : undefined,
        })),
        locationId,
      },
      fm,
      t,
    );
    const list = shelfRolls.get(sku) ?? [];
    result.added.forEach((r, i) =>
      list.push({ id: r.id, code: r.code, addedAt: t, areaSqFt: areas[i], locationId }),
    );
    shelfRolls.set(sku, list);
  };
  // Enough for 25 rolls a working day, with a few left on the shelf (D-127).
  await addDemoRolls("LR-001", 60, at(addDays(firstDay, -1), 16));
  await addDemoRolls("LR-002", 40, at(addDays(firstDay, -1), 16.1));
  await addDemoRolls("LR-003", 30, at(addDays(firstDay, -1), 16.2));
  await addDemoRolls("LR-001", 35, at(addDays(firstDay, 2), 9));
  await addDemoRolls("LR-002", 25, at(addDays(firstDay, 3), 11));
  // The second week's leather (D-126).
  await addDemoRolls("LR-001", 40, at(addDays(firstDay, 9), 9));
  await addDemoRolls("LR-002", 25, at(addDays(firstDay, 10), 11));
  await addDemoRolls("LR-003", 20, at(addDays(firstDay, 10), 11.1));
  /** The oldest roll of the item on the shelf at `t`, taken off the list. */
  const pickRoll = (sku: string, t: Date) => {
    const list = shelfRolls.get(sku) ?? [];
    const i = list.findIndex((r) => r.addedAt.getTime() <= t.getTime());
    return i === -1 ? null : list.splice(i, 1)[0];
  };
  let marked = 0;
  /** Rolls Returned to supplier, set aside in the return area, oldest first (A-77). */
  const setAside: { id: string; at: Date }[] = [];

  // ── rolls: two a working day (Mon–Fri, D-105), each picked, captured shot by shot and finished at
  //    Capture by a demo constructor (Phase 26, 30A) ──
  const workingDays: string[] = [];
  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    if (isoWeekday(d) <= 5) workingDays.push(d);
  }
  // The days attendance is taken for, and the one the Quality Inspector is away (D-088).
  const attendanceDays = workingDays.filter((d) => d < today).slice(-ABSENT.length);
  const qiAwayDay: string | undefined =
    attendanceDays[QI_ABSENT_INDEX - (ABSENT.length - attendanceDays.length)];
  let qiMarkedAbsent = false;
  let rolls = 0;
  let scans = 0;
  let index = 0;

  const SLOTS = DEMO_ROLL_SLOTS;
  // The last slot whose roll has surely started (a start lands up to 0.3 h after the slot).
  const newestSlot = workingDays
    .flatMap((day) => SLOTS.map((startHour) => ({ day, startHour })))
    .findLast(({ day, startHour }) => past(at(day, startHour + 0.3)));

  for (const day of workingDays) {
    for (const startHour of SLOTS) {
      index += 1;
      // The newest roll to reach the camera stays open.
      const newest = day === newestSlot?.day && startHour === newestSlot.startHour;
      const capturer = capturers[index % capturers.length];
      const created = at(day, startHour + between(0, 0.3));
      if (!past(created)) continue;
      // Rolls alternate between the two tanneries' items; every sixth comes from the fallback
      // store. Marikina Supplier A's leather (the first demo supplier) has more defects.
      const sku = index % 6 === 0 ? "LR-003" : index % 2 === 0 ? "LR-002" : "LR-001";
      const picked = pickRoll(sku, created) ?? pickRoll("LR-001", created);
      if (!picked) continue;
      const worseLeather = sku === "LR-002";
      const roll = await startRoll(picked.id, capturer, created);
      rolls += 1;
      let t = created;

      // Shot by shot from the Capture page, edge to edge.
      const prep = preparationMs(random);
      const sections = sectionsFor(picked.areaSqFt);
      // Each shot's defects, drawn up front so a damaged roll's mix can be aimed at its share.
      let plan: Detection[][] = Array.from({ length: sections }, () => {
        const detections = scenario(random, classes);
        // Worse leather: a clean section gets a second chance to show a defect.
        return worseLeather && detections.length === 0 ? scenario(random, classes) : detections;
      });
      if (DEMO_DAMAGED_ROLLS.includes(index))
        plan = damageRoll(random, plan, picked.areaSqFt, classes, DEMO_DAMAGED_SHARE);
      else if (DEMO_NEAR_LIMIT_ROLLS.includes(index))
        plan = damageRoll(random, plan, picked.areaSqFt, classes, DEMO_NEAR_LIMIT_SHARE);
      const sectionAt = (i: number) => plus(t, ((i + 0.5) * prep) / sections);
      let captured = 0;
      while (captured < sections && past(sectionAt(captured))) captured += 1;
      for (let i = 0; i < sections; i++) {
        const ts = sectionAt(i);
        if (!past(ts)) break;
        const detections = plan[i];
        const image = await renderLeatherImage(detections, {
          width: options.imageSize ?? 480,
          height: Math.round((options.imageSize ?? 480) * DEMO_ASPECT),
          random,
        });
        await ingestScan(
          {
            image: { bytes: new Uint8Array(image), type: { mime: "image/jpeg", ext: "jpg" } },
            detections,
            source: "PHONE",
            modelVersion: DEMO_MODEL_VERSION,
            capturedAt: ts,
            rollId: roll.id,
            widthIn: DEMO_WIDTH_IN,
          },
          { kind: "website", userId: capturer.id },
          ts,
        );
        scans += 1;
      }
      t = plus(t, prep);

      // All of it is in: Finish roll at Capture. The newest roll stays open, so Capture opens on
      // a roll.
      if (past(t) && !newest && captured > 0) {
        const finished = await finishRoll(roll.id, capturer, t);
        if (finished.marked) {
          marked += 1;
          // The constructor sets it aside for the supplier (Phase 32, A-77).
          const asideAt = plus(t, 2 * MINUTE);
          if (past(asideAt)) {
            await setAsideRoll(roll.id, returnArea, capturer, asideAt);
            setAside.push({ id: roll.id, at: asideAt });
          }
        }
      }
      logger.info({ roll: roll.code }, "Demo week: roll replayed");
    }
    // What the line used that day (thread, cement, tacks) goes on the next stock update.
    await stock("TH-001", "OUT", 2, "Stitching uppers", at(day, 16.75));
    await stock("AD-001", "OUT", 1, "Soling", at(day, 16.75));
    await stock("NL-001", "OUT", 2, "Soling", at(day, 16.75));
  }

  // ── one roll on the shelf found water-damaged: the Floor Manager removes it with a reason
  //    (Phase 30A); it never reached the camera and leaves stock ──
  const removeDay = workingDays[Math.max(0, workingDays.length - 3)];
  const removeAt = at(removeDay, 15);
  const damaged = past(removeAt) ? (shelfRolls.get("LR-002") ?? []).pop() : undefined;
  if (damaged)
    await removeRoll(damaged.id, "Water damage in storage; the supplier was told.", fm, removeAt);

  logger.info({ marked }, "Demo week: rolls with too many defects");

  // ── where rolls are kept (Phase 32): on the last working day before today the Floor Manager
  //    moves two rolls still on the shelf to another bin, and the supplier picks up the oldest
  //    returned roll a day after it was set aside ──
  const moveDay = workingDays.filter((d) => d < today).at(-1) ?? workingDays[0];
  const moveAt = at(moveDay, 14);
  const toMove = (shelfRolls.get("LR-001") ?? [])
    .filter((r) => r.addedAt.getTime() <= moveAt.getTime())
    .slice(-2);
  const moveTo = bins.findLast((b) => toMove.every((r) => r.locationId !== b));
  if (past(moveAt) && toMove.length > 0 && moveTo)
    await moveRolls(
      {
        rollIds: toMove.map((r) => r.id),
        toLocationId: moveTo,
        note: "The first bin was full.",
      },
      fm,
      moveAt,
    );
  const pickup = setAside[0];
  const pickupAt = pickup ? plus(pickup.at, 24 * HOUR) : null;
  if (pickup && pickupAt && past(pickupAt)) await markPickedUp(pickup.id, fm, pickupAt);

  // ── two more deliveries: thread and tacks on the second working day, tacks on the fourth (with
  //    the leather rolls added above). They reach the ledger on the next stock update. ──
  const workingDay = (i: number) => workingDays[Math.min(i, workingDays.length - 1)];
  const deliveryFrom = (supplier: { name: string } | undefined) =>
    supplier ? `Delivery from ${supplier.name}` : "Delivery received";
  const supplies = deliveryFrom(suppliers[3] ?? suppliers[1] ?? suppliers[0]);
  await stock("TH-001", "IN", 4, supplies, at(workingDay(1), 14));
  await stock("NL-001", "IN", 5, supplies, at(workingDay(1), 14));
  await stock("NL-001", "IN", 5, supplies, at(workingDay(3), 11));

  // ── stock updates (Phase 29): the Floor Manager's Wednesday and Friday sheets ──
  const stockUpdates = await seedStockUpdates();

  // ── attendance (D-077, D-081): the past working days, taken by the Floor Manager ──
  const attendanceSaved = await seedAttendance();

  // ── batches (Phases 23, 27): the quota, and the QI finishing batches through the real service ──
  const checkIns = await seedProduction();

  const result: DemoSeedResult = {
    seeded: true,
    rolls,
    scans,
    attendanceDays: attendanceSaved,
    checkIns,
    stockUpdates,
    ms: Date.now() - started,
  };
  logger.info(result, "Demo week seeded");
  return result;

  /**
   * The Update stock sheet through the real service (Phase 29, D-102, C-32): on each of the week's
   * Wednesday and Friday at 16:30 the Floor Manager enters per item what came in and what the line
   * used since the last update (leather rolls laid out, thread, cement, tacks). Used is capped at
   * what's on the shelf. Friday's sheet also corrects the tacks after a recount. What happens after
   * the last update waits for the next one, as on the floor.
   */
  async function seedStockUpdates(): Promise<number> {
    const days = workingDays.filter((d) => [3, 5].includes(isoWeekday(d)));
    let since = new Date(0);
    let saved = 0;
    for (const [n, day] of days.entries()) {
      const when = at(day, 16.5);
      if (!past(when)) continue;
      const lines = [];
      for (const [sku, itemId] of itemIds) {
        // Leather is counted from its rolls (Phase 30A), never on the sheet.
        if (sku.startsWith("LR-")) continue;
        const events = shelf.filter((e) => e.sku === sku && e.t > since && e.t <= when);
        const sum = (type: "IN" | "OUT") =>
          events.filter((e) => e.type === type).reduce((t, e) => t + e.quantity, 0);
        const item = await findInventoryItem(itemId);
        if (!item) continue;
        const onHand = Number(item.quantityOnHand);
        const added = sum("IN");
        const used = Math.min(sum("OUT"), onHand + added);
        const recount = n === 1 && sku === "NL-001" && onHand + added - used >= 1;
        if (!added && !used && !recount) continue;
        lines.push({
          itemId,
          seenQuantity: onHand,
          added: added || undefined,
          used: used || undefined,
          correction: recount ? -1 : undefined,
          reason: recount ? "Recounted the shelf: one box was damp and thrown out." : undefined,
        });
      }
      since = when;
      if (lines.length === 0) continue;
      await saveStockUpdate({ lines }, fm!, when);
      saved += 1;
    }
    return saved;
  }

  /**
   * Attendance through the real service (D-077, D-081): the demo's working days before today (up
   * to ten, D-126),
   * saved by the Floor Manager at 07:50 that morning, with a few constructors absent on some days
   * (none, 1, none, 4, none, 1, 5, none, 3, 2, oldest first) so Phase 23's shortfalls have something to line up
   * with. Today is left "Not taken" so the demo starts with Take attendance. The office roles are
   * marked present, except the Quality Inspector on one day (D-088). Who is absent is drawn from
   * the seed, never the same person every time.
   */
  async function seedAttendance(): Promise<number> {
    const days = attendanceDays;
    const pattern = ABSENT.slice(ABSENT.length - days.length);
    let saved = 0;
    for (const [i, day] of days.entries()) {
      const when = at(day, 7 + 50 / 60);
      if (!past(when)) continue;
      const view = await getAttendanceDay(day, fm!, when);
      const constructors = view.roster.filter((p) => p.role === "SHOE_CONSTRUCTOR");
      if (constructors.length === 0) continue;
      const absent = new Set<string>();
      // The capturers are in every day they capture, so the log book and the rolls agree.
      const mayBeAbsent = constructors.filter((p) => !capturerIds.has(p.id));
      while (absent.size < Math.min(pattern[i], mayBeAbsent.length))
        absent.add(pick(mayBeAbsent).id);
      if (day === qiAwayDay && view.roster.some((p) => p.id === qi!.id)) {
        absent.add(qi!.id);
        qiMarkedAbsent = true;
      }
      await saveAttendanceDay(
        day,
        {
          expectedUpdatedAt: view.updatedAt,
          marks: view.roster.map((p) => ({ userId: p.id, present: !absent.has(p.id) })),
        },
        fm!,
        when,
      );
      saved += 1;
    }
    return saved;
  }

  /**
   * Batches through the real services (Phase 27, D-097 to D-099):
   *  - the Floor Manager plans each working day that morning on the calendar (D-114): 25 rolls
   *    (D-127), the one quota, every 4 hours, 08:00 to 17:00; the first day plans two more and the
   *    second two fewer, so planned against scanned shows a day under and a day over; a weekday next week is
   *    marked Non-working / Holiday;
   *  - the QI finishes every batch of the default schedule and lunch (08:00–13:00 with lunch
   *    11:00–12:00, and 13:00–17:00) a few minutes after its end, with a pair or two failing
   *    inspection in each; one finished 50 minutes late on a day that makes the quota, and one
   *    missed on the shortest-handed day, so it adds no short day of its own; on the day attendance
   *    shows the QI absent, the Floor Manager finishes them (D-088); the missed one stays in the
   *    Inspection queue (Phase 33), marked Urgent by the Floor Manager with a reason;
   *  - pairs follow the constructors present and the working hours (demoRate, from the roster),
   *    so the days with 2, 3, 4 and 5 absent end below quota on passed pairs and the others meet it. A day without
   *    attendance counts everyone on the roster.
   * Today: batches finished more than 30 minutes ago are saved; a newer one is left Due.
   */
  async function seedProduction(): Promise<number> {
    await queueFromTheStart();
    for (const [i, day] of workingDays.entries()) {
      const plannedAt = at(day, 7);
      await saveDayPlan(
        day,
        {
          rollsPlanned: i === 0 ? SLOTS.length + 2 : i === 1 ? SLOTS.length - 2 : SLOTS.length,
          quota: DEMO_QUOTA,
          suggestedQuota: null,
          intervalMinutes: DEFAULT_SCHEDULE.intervalMinutes,
          shiftStart: DEFAULT_SCHEDULE.shiftStart,
          shiftEnd: DEFAULT_SCHEDULE.shiftEnd,
          expectedUpdatedAt: null,
        },
        fm!,
        plannedAt.getTime() < now.getTime() ? plannedAt : now,
      );
    }
    // Next week's Wednesday: a holiday, marked ahead (no name, D-114).
    let holiday = addDays(today, 7);
    while (isoWeekday(holiday) !== 3) holiday = addDays(holiday, 1);
    await markNonWorking(holiday, { expectedUpdatedAt: null }, fm!, now);
    const views = new Map<string, number>();
    for (const day of workingDays) {
      const view = await getAttendanceDay(day, fm!, at(day, 12));
      views.set(
        day,
        view.workforce.taken
          ? view.workforce.constructorsPresent
          : view.workforce.constructorsOnRoster,
      );
    }
    const pastDays = workingDays.filter((d) => d < today);
    const most = Math.max(0, ...pastDays.map((d) => views.get(d) ?? 0));
    const fewest = Math.min(...pastDays.map((d) => views.get(d) ?? 0));
    const missedDay = pastDays.find((d) => views.get(d) === fewest);
    const lateDay = pastDays.find((d) => d !== missedDay && (views.get(d) ?? 0) >= most - 1);
    const fullDay = workingDays.length
      ? batchesFor(DEFAULT_SCHEDULE, [DEFAULT_LUNCH], workingDays[0])
      : [];
    const hours = fullDay.reduce((t, b) => t + b.workingMinutes, 0) / 60;
    const rate = hours > 0 ? demoRate(most, hours) : 0;
    let entered = 0;
    for (const day of workingDays) {
      const batches = batchesFor(DEFAULT_SCHEDULE, [DEFAULT_LUNCH], day);
      const present = views.get(day) ?? 0;
      for (const batch of batches) {
        if (day === missedDay && batch.number === batches.length) continue;
        const late = day === lateDay && batch.number === 1;
        const when = plus(batch.at, (late ? 50 : 4 + Math.floor(random() * 8)) * MINUTE);
        if (day === today && when.getTime() > now.getTime() - 30 * MINUTE) continue;
        if (!past(when)) continue;
        const pairs = Math.round(present * (batch.workingMinutes / 60) * rate);
        const failedPairs = Math.min(pairs, 1 + Math.floor(random() * 2));
        await saveCheckIn(
          {
            slotAt: batch.at.toISOString(),
            pairs,
            failedPairs,
            notes: late ? "Counted late: the sole press was down." : undefined,
          },
          day === qiAwayDay && qiMarkedAbsent ? fm! : qi!,
          when,
        );
        entered += 1;
      }
    }
    // The missed batch waits in the Inspection queue (Phase 33): the Floor Manager marks it Urgent.
    if (missedDay) {
      const last = batchesFor(DEFAULT_SCHEDULE, [DEFAULT_LUNCH], missedDay).at(-1);
      const queued = last ? await queuedBatchAt(missedDay, last.at) : null;
      const markedAt = last ? plus(last.at, 45 * MINUTE) : null;
      if (queued && markedAt && past(markedAt))
        await setBatchPriority(
          queued.id,
          {
            priority: "URGENT",
            reason: "Count it first: the customer picks these up today.",
            expectedUpdatedAt: queued.updatedAt,
          },
          { ...fm!, role: "FLOOR_MANAGER" },
          markedAt,
        );
    }
    return entered;
  }
}
