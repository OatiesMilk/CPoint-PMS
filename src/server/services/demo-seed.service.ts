import { manilaToday } from "@/lib/format";
import { DEFAULT_SCHEDULE, slotsFor } from "@/lib/production-rules";
import { addDays, manilaDayStart } from "@/lib/report-rules";
import {
  renderLeatherImage,
  randomBox,
  scenario,
  UNKNOWN_CLASS,
  type Detection,
  type Random,
} from "@/server/lib/leather-scan";
import { DEMO_SUPPLIERS } from "@/server/lib/demo-suppliers";
import { logger } from "@/server/lib/logger";
import { countBatches } from "@/server/models/batch.model";
import { findInventoryItemBySku } from "@/server/models/inventory.model";
import {
  ensureSupplier,
  listActiveShoeTypes,
  listActiveSuppliers,
  listDefectTypes,
} from "@/server/models/reference-data.model";
import { findUserByEmail } from "@/server/models/user.model";
import { getAttendanceDay, saveAttendanceDay } from "./attendance.service";
import { cancelBatch, createBatch, transitionBatchStage } from "./batch.service";
import { setCameraOperator } from "./camera.service";
import { saveCheckIn, saveQuotas } from "./production.service";
import { createItem, recordMovement } from "./inventory.service";
import { ingestScan } from "./scan-ingest.service";

/**
 * The demo week (D-026, D-090): replays a small, believable past week of production through the
 * real services, each with its own `now`, so rolls, scans, the stock ledger, attendance,
 * check-ins and audit rows all agree. Every section is Pass or Reject and nobody changes it
 * (D-093); the newest roll's last section always shows an unknown class (the random mix adds a few
 * more), rejected and listed in Settings (A-12). Scans are Capture page captures (the
 * website camera, D-069) by the QI, or by the Floor Manager on the day the QI is absent. Opt-in
 * (SEED_DEMO_WEEK or `npm run demo:seed`), and only on a database with no batches. The same seed
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

/** Hours a roll spends at Preparation, from start to Finish roll (D-082). */
export const PREPARATION_HOURS: [number, number] = [2, 3];

/** Sections the camera checks per roll: about 10 pieces, as the Finish roll hint says (D-082). */
export const SECTIONS_PER_ROLL = 10;

/** The model the website camera runs (cv/MODEL_CARD.md), named on every demo scan. */
export const DEMO_MODEL_VERSION = "yolo-v1-1d729fb0";

/**
 * Constructors absent on the demo week's working days before today, oldest first (D-081). On the
 * fourth day (none absent) the Quality Inspector is absent instead, so the Floor Manager captures,
 * and enters that day's check-ins (D-088).
 */
const ABSENT = [0, 1, 5, 0, 3, 2];
const QI_ABSENT_INDEX = 3;

export function preparationMs(random: Random): number {
  const [lo, hi] = PREPARATION_HOURS;
  return (lo + random() * (hi - lo)) * HOUR;
}

/**
 * Demo output per Shoe Constructor present per hour, and the daily quotas (Phase 23). Chosen so
 * a day with one constructor absent still makes the quota and a day with two or more absent
 * doesn't, which lines the shortfalls up with the seeded absences (D-081).
 */
export const DEMO_RATE = { school: 0.9, topsider: 0.45 } as const;
export const DEMO_QUOTA = { school: 85, topsider: 43 } as const;

/** Demo materials (also used by bootstrap when only demo users are on). */
export const DEMO_INVENTORY = [
  {
    sku: "LR-001",
    name: "Black cowhide (school shoes)",
    category: "LEATHER_ROLL",
    unit: "roll",
    reorderLevel: 3,
    openingStock: 8,
  },
  {
    sku: "LR-002",
    name: "Brown suede (topsiders)",
    category: "LEATHER_ROLL",
    unit: "roll",
    reorderLevel: 2,
    openingStock: 2,
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

export type DemoSeedResult =
  | {
      seeded: true;
      batches: number;
      scans: number;
      attendanceDays: number;
      checkIns: number;
      ms: number;
    }
  | { seeded: false; reason: string };

export async function seedDemoWeek(
  options: { now?: Date; seed?: number; imageSize?: number } = {},
): Promise<DemoSeedResult> {
  const started = Date.now();
  const now = options.now ?? new Date();
  const random = mulberry32(options.seed ?? 20261003);
  const between = (lo: number, hi: number) => lo + random() * (hi - lo);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const past = (t: Date) => t.getTime() <= now.getTime() - MINUTE;
  const plus = (t: Date, ms: number) => new Date(t.getTime() + ms);

  if ((await countBatches()) > 0) return { seeded: false, reason: "batches already exist" };
  const [fm, qi, admin] = await Promise.all([
    findUserByEmail("manager@cpoint.local"),
    findUserByEmail("inspector@cpoint.local"),
    findUserByEmail("admin@cpoint.local"),
  ]);
  if (!fm || !qi || !admin)
    return { seeded: false, reason: "demo users are missing (set SEED_DEMO_USERS=true)" };
  // Three leather suppliers, so Supplier quality has something to compare (Phase 20, D-090).
  for (const supplier of DEMO_SUPPLIERS) await ensureSupplier(supplier);
  const [shoeTypes, activeSuppliers, defectTypes] = await Promise.all([
    listActiveShoeTypes(),
    listActiveSuppliers(),
    listDefectTypes(),
  ]);
  // The demo's own suppliers, in their listed order (not the bootstrap's placeholder).
  const demoSuppliers = DEMO_SUPPLIERS.flatMap((d) =>
    activeSuppliers.filter((s) => s.name === d.name),
  );
  const suppliers = demoSuppliers.length > 0 ? demoSuppliers : activeSuppliers;
  if (shoeTypes.length === 0) return { seeded: false, reason: "no shoe types" };
  // The week's scans show the defect types active in Settings, as the camera's model would.
  const classes = defectTypes
    .filter((t) => t.isActive)
    .map((t) => ({ key: t.key, outcome: t.outcome }));
  if (classes.length === 0) return { seeded: false, reason: "no active defect types" };

  const today = manilaToday(now);
  const at = (day: string, hour: number) => new Date(manilaDayStart(day).getTime() + hour * HOUR);
  const firstDay = addDays(today, -6);

  // ── inventory: the shelf at the start of the week, then deliveries ──
  const itemIds = new Map<string, string>();
  for (const item of DEMO_INVENTORY) {
    const existing = await findInventoryItemBySku(item.sku);
    const id =
      existing?.id ?? (await createItem({ ...item }, fm, at(addDays(firstDay, -1), 16))).id;
    itemIds.set(item.sku, id);
  }
  const stock = async (
    sku: string,
    type: "IN" | "OUT",
    quantity: number,
    reason: string,
    t: Date,
    batchId?: string,
  ) => {
    if (!past(t)) return;
    try {
      await recordMovement(
        itemIds.get(sku)!,
        type === "IN" ? { type, quantity, reason } : { type, quantity, reason, batchId },
        fm,
        t,
      );
    } catch {
      // Not enough on the shelf in this replay: skip, as a real floor would wait for a delivery.
    }
  };
  await stock("LR-001", "IN", 6, "Delivery from the leather supplier", at(addDays(firstDay, 2), 9));
  await stock("LR-002", "IN", 5, "Delivery from the leather supplier", at(addDays(firstDay, 1), 9));
  await stock("NL-001", "IN", 10, "Delivery received", at(addDays(firstDay, 3), 10));
  await stock("TH-001", "IN", 10, "Delivery received", at(addDays(firstDay, 2), 14));
  await stock("AD-001", "IN", 3, "Delivery received", at(addDays(firstDay, 3), 14));

  // ── rolls: two a working day (Mon–Sat), each started, scanned at Preparation and finished ──
  const workingDays: string[] = [];
  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 0) workingDays.push(d);
  }
  // The days attendance is taken for, and the one the Quality Inspector is away (D-088).
  const attendanceDays = workingDays.filter((d) => d < today).slice(-ABSENT.length);
  const qiAwayDay: string | undefined =
    attendanceDays[QI_ABSENT_INDEX - (ABSENT.length - attendanceDays.length)];
  let qiMarkedAbsent = false;
  let batches = 0;
  let scans = 0;
  let index = 0;

  const SLOTS = [8, 10.5];
  // The last slot whose batch has surely started (a start lands up to 0.3 h after the slot).
  const newestSlot = workingDays
    .flatMap((day) => SLOTS.map((startHour) => ({ day, startHour })))
    .findLast(({ day, startHour }) => past(at(day, startHour + 0.3)));

  for (const day of workingDays) {
    for (const startHour of SLOTS) {
      index += 1;
      // The newest batch to reach the camera; its last section shows an unknown class (A-12).
      const newest = day === newestSlot?.day && startHour === newestSlot.startHour;
      const school = index % 3 !== 0;
      const shoeType = school ? shoeTypes[0] : (shoeTypes[1] ?? shoeTypes[0]);
      const created = at(day, startHour - between(0.5, 1));
      if (!past(created)) continue;
      // Rolls alternate between the two tanneries; every sixth comes from the fallback store. The
      // first demo supplier's leather has more defects.
      const supplier =
        suppliers.length === 0
          ? undefined
          : index % 6 === 0 && suppliers.length > 2
            ? suppliers[2]
            : suppliers[index % Math.min(2, suppliers.length)];
      const worseLeather = supplier?.name === DEMO_SUPPLIERS[0].name;
      const batch = await createBatch(
        {
          rollCode: `LR-${day.slice(2).replaceAll("-", "")}-${String(index).padStart(2, "0")}`,
          shoeTypeId: shoeType.id,
          supplierId: supplier?.id,
          receivedAt: addDays(day, -1),
          notes: undefined,
          rollItemId: itemIds.get(school ? "LR-001" : "LR-002"),
        },
        fm,
        created,
      ).catch(() =>
        // No roll left on the shelf: register the batch without taking one.
        createBatch(
          {
            rollCode: `LR-${day.slice(2).replaceAll("-", "")}-${String(index).padStart(2, "0")}`,
            shoeTypeId: shoeType.id,
            supplierId: supplier?.id,
            receivedAt: addDays(day, -1),
            notes: undefined,
            rollItemId: undefined,
          },
          fm,
          created,
        ),
      );
      batches += 1;
      let t = at(day, startHour + between(0, 0.3));
      if (!past(t)) continue;
      await transitionBatchStage(
        batch.id,
        { action: "start", expectedStage: "PREPARATION" },
        fm,
        t,
      );

      // Preparation: the camera checks each section before cutting, from the Capture page.
      const prep = preparationMs(random);
      const sections = SECTIONS_PER_ROLL;
      const capturer = day === qiAwayDay ? fm : qi;
      const sectionAt = (i: number) => plus(t, ((i + 0.5) * prep) / sections);
      let captured = 0;
      while (captured < sections && past(sectionAt(captured))) captured += 1;
      for (let i = 0; i < sections; i++) {
        const ts = sectionAt(i);
        if (!past(ts)) break;
        let detections: Detection[] = scenario(random, classes);
        // Worse leather: a clean section gets a second chance to show a defect.
        if (worseLeather && detections.length === 0) detections = scenario(random, classes);
        if (newest && i === captured - 1)
          detections = [{ classKey: UNKNOWN_CLASS, confidence: 0.82, box: randomBox(random) }];
        const image = await renderLeatherImage(detections, {
          width: options.imageSize ?? 480,
          height: Math.round((options.imageSize ?? 480) * 0.75),
          random,
        });
        await ingestScan(
          {
            image: { bytes: new Uint8Array(image), type: { mime: "image/jpeg", ext: "jpg" } },
            detections,
            source: "WEBCAM",
            modelVersion: DEMO_MODEL_VERSION,
            capturedAt: ts,
            batchId: batch.id,
          },
          { kind: "website", userId: capturer.id },
          ts,
        );
        scans += 1;
      }
      t = plus(t, prep);

      // The roll is used up: Finish roll (D-082). What the line used for it (thread, cement,
      // nails) is taken from stock the same afternoon, so the ledger still moves. The newest roll
      // stays at Preparation, so the camera has a roll to feed and its page offers Finish roll.
      if (past(t) && !newest) {
        await transitionBatchStage(
          batch.id,
          { action: "finish", expectedStage: "PREPARATION" },
          fm,
          t,
        );
        await stock("TH-001", "OUT", 1, "Stitching uppers", plus(t, 10 * MINUTE), batch.id);
        await stock("AD-001", "OUT", 0.5, "Soling", plus(t, 20 * MINUTE), batch.id);
        await stock("NL-001", "OUT", 1, "Soling", plus(t, 25 * MINUTE), batch.id);
      }
      logger.info({ batch: batch.code }, "Demo week: roll replayed");
    }
  }

  // ── one batch cancelled before production (its roll goes back on the shelf) ──
  const cancelDay = workingDays[Math.max(0, workingDays.length - 3)];
  const cancelCreated = at(cancelDay, 13);
  if (past(plus(cancelCreated, 2 * HOUR))) {
    const cancelled = await createBatch(
      {
        rollCode: `LR-${cancelDay.slice(2).replaceAll("-", "")}-X`,
        shoeTypeId: shoeTypes[0].id,
        supplierId: suppliers[0]?.id,
        receivedAt: cancelDay,
        notes: undefined,
        rollItemId: itemIds.get("LR-001"),
      },
      fm,
      cancelCreated,
    ).catch(() => null);
    if (cancelled) {
      batches += 1;
      await cancelBatch(
        cancelled.id,
        { reason: "Order postponed by the client; roll back to storage." },
        fm,
        plus(cancelCreated, 2 * HOUR),
      );
    }
  }

  // ── tomorrow's roll, registered but not started ──
  const plannedAt = new Date(Math.min(at(today, 15).getTime(), now.getTime() - 30 * MINUTE));
  if (plannedAt.getTime() > at(today, 6).getTime()) {
    await createBatch(
      {
        rollCode: `LR-${today.slice(2).replaceAll("-", "")}-P`,
        shoeTypeId: shoeTypes[0].id,
        supplierId: suppliers[0]?.id,
        receivedAt: today,
        notes: "For tomorrow's first shift.",
        rollItemId: undefined,
      },
      fm,
      plannedAt,
    );
    batches += 1;
  }

  // ── two more deliveries: thread and tacks on the second working day, leather and tacks on the
  //    fourth. The shelf ends where the demo week of D-090 left it. ──
  const workingDay = (i: number) => workingDays[Math.min(i, workingDays.length - 1)];
  const deliveryFrom = (supplier: { name: string } | undefined) =>
    supplier ? `Delivery from ${supplier.name}` : "Delivery received";
  const supplies = deliveryFrom(suppliers[3] ?? suppliers[1] ?? suppliers[0]);
  const leather = deliveryFrom(suppliers[0]);
  await stock("TH-001", "IN", 4, supplies, at(workingDay(1), 14));
  await stock("NL-001", "IN", 5, supplies, at(workingDay(1), 14));
  await stock("LR-001", "IN", 2, leather, at(workingDay(3), 11));
  await stock("NL-001", "IN", 5, leather, at(workingDay(3), 11));

  // ── the demo constructor may capture at the camera (D-075), as the Floor Manager allowed ──
  const demoConstructor = await findUserByEmail("constructor@cpoint.local");
  if (demoConstructor?.isActive && !demoConstructor.canCapture)
    await setCameraOperator(demoConstructor.id, true, fm).catch(() => undefined);

  // ── attendance (D-077, D-081): the past working days, taken by the Floor Manager ──
  const attendanceSaved = await seedAttendance();

  // ── production (Phase 23): quotas, and the QI's check-ins through the real service ──
  const checkIns = await seedProduction();

  const result: DemoSeedResult = {
    seeded: true,
    batches,
    scans,
    attendanceDays: attendanceSaved,
    checkIns,
    ms: Date.now() - started,
  };
  logger.info(result, "Demo week seeded");
  return result;

  /**
   * A week of attendance through the real service (D-077, D-081): the demo week's working days
   * before today (up to six),
   * saved by the Floor Manager at 07:50 that morning, with a few constructors absent on some days
   * (none, 1, 5, none, 3, 2, oldest first) so Phase 23's shortfalls have something to line up
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
      while (absent.size < Math.min(pattern[i], constructors.length))
        absent.add(pick(constructors).id);
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
   * Production progression through the real services (Phase 23, D-083 to D-086):
   *  - the Floor Manager sets a quota per shoe type on the first morning of the week (a first
   *    quota applies from that day, Dylan 5A);
   *  - the QI enters every check-in of the default schedule (12:00, 16:00, 17:00) a few minutes
   *    after its time, with one entered 50 minutes late and one (a 17:00) missed on a full day; on
   *    the day attendance shows the QI absent, the Floor Manager enters them (D-088);
   *  - pairs follow the constructors present (DEMO_RATE), so the days with 2, 3 and 5 absent end
   *    below quota and the others meet it. A day without attendance counts everyone on the roster.
   * Today: check-ins older than 30 minutes are entered; a newer one is left Due.
   */
  async function seedProduction(): Promise<number> {
    const types = shoeTypes.slice(0, 2);
    if (types.length === 0) return 0;
    const school = types[0];
    const top = types[1];
    await saveQuotas(
      {
        quotas: [
          { shoeTypeId: school.id, pairs: DEMO_QUOTA.school, suggestedPairs: null },
          ...(top
            ? [{ shoeTypeId: top.id, pairs: DEMO_QUOTA.topsider, suggestedPairs: null }]
            : []),
        ],
      },
      fm!,
      at(firstDay, 7),
    );
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
    // The missed 17:00 goes on a day with everyone in (it still makes the quota); the late one on
    // another day that makes it, so neither adds a short day of its own.
    const pastDays = workingDays.filter((d) => d < today);
    const most = Math.max(0, ...pastDays.map((d) => views.get(d) ?? 0));
    const missedDay = pastDays.find((d) => views.get(d) === most);
    const lateDay =
      pastDays.find((d) => d !== missedDay && (views.get(d) ?? 0) >= most - 1) ?? missedDay;
    let entered = 0;
    for (const day of workingDays) {
      const slots = slotsFor(DEFAULT_SCHEDULE, day);
      const present = views.get(day) ?? 0;
      for (const [i, slot] of slots.entries()) {
        const hours =
          (slot.at.getTime() - (i === 0 ? at(day, 8) : slots[i - 1].at).getTime()) / HOUR;
        if (day === missedDay && slot.time === "17:00") continue;
        const late = day === lateDay && slot.time === "12:00";
        const when = plus(slot.at, (late ? 50 : 4 + Math.floor(random() * 8)) * MINUTE);
        if (day === today && when.getTime() > now.getTime() - 30 * MINUTE) continue;
        if (!past(when)) continue;
        // 0 or 1 more School Shoes now and then; never fewer, so the full days stay on quota.
        const jitter = Math.round(random());
        const counts = [
          {
            shoeTypeId: school.id,
            pairs: Math.max(0, Math.round(present * hours * DEMO_RATE.school) + jitter),
          },
          ...(top
            ? [{ shoeTypeId: top.id, pairs: Math.round(present * hours * DEMO_RATE.topsider) }]
            : []),
        ];
        // Any other active shoe type gets a 0, as the QI would enter.
        for (const t of shoeTypes.slice(2)) counts.push({ shoeTypeId: t.id, pairs: 0 });
        await saveCheckIn(
          {
            slotAt: slot.at.toISOString(),
            counts,
            notes: late ? "Counted after the lunch break." : undefined,
          },
          day === qiAwayDay && qiMarkedAbsent ? fm! : qi!,
          when,
        );
        entered += 1;
      }
    }
    return entered;
  }
}
