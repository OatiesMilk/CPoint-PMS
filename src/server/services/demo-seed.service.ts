import type { Role, Stage } from "@/lib/domain";
import { manilaToday } from "@/lib/format";
import { addDays, manilaDayStart } from "@/lib/report-rules";
import {
  renderLeatherImage,
  randomBox,
  scenario,
  UNKNOWN_CLASS,
  type Detection,
  type Random,
} from "@/server/lib/leather-scan";
import { logger } from "@/server/lib/logger";
import { countBatches, listOpenBatches } from "@/server/models/batch.model";
import { findInventoryItemBySku } from "@/server/models/inventory.model";
import { findLiveOutcomes } from "@/server/models/outcome.model";
import { listActiveShoeTypes, listActiveSuppliers } from "@/server/models/reference-data.model";
import { findUserByEmail } from "@/server/models/user.model";
import { createDeviceToken } from "./api-token.service";
import { cancelBatch, createBatch, transitionBatchStage } from "./batch.service";
import { createItem, recordMovement } from "./inventory.service";
import { moveReworkTicket } from "./rework.service";
import { assignSalvage, discardSalvage } from "./salvage.service";
import { actOnRequest, addRemark, createRequest, setRequester } from "./procurement.service";
import { decideScan } from "./scan-decision.service";
import { ingestScan } from "./scan-ingest.service";

/**
 * The demo week (D-026): replays a believable past week of production through the real services,
 * each with its own `now`, so stage logs, scans, repairs, salvage, the stock ledger and audit rows
 * all agree. Opt-in (SEED_DEMO_WEEK or `npm run demo:seed`), and only on a database with no
 * batches. The same seed gives the same week.
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

/** Hours per stage visit. Upper Making is the bottleneck, as the client described (survey). */
export const STAGE_HOURS: Record<Stage, [number, number]> = {
  PREPARATION: [2, 3],
  UPPER_MAKING: [6, 9],
  SOLEING: [4, 6],
  FINISHING: [1, 2],
};

export function stageDurationMs(stage: Stage, random: Random): number {
  const [lo, hi] = STAGE_HOURS[stage];
  return (lo + random() * (hi - lo)) * HOUR;
}

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
  | { seeded: true; batches: number; scans: number; requests: number; ms: number }
  | { seeded: false; reason: string };

type Actor = { id: string; role: Role };

export async function seedDemoWeek(
  options: { now?: Date; seed?: number; imageSize?: number } = {},
): Promise<DemoSeedResult> {
  const started = Date.now();
  const now = options.now ?? new Date();
  const random = mulberry32(options.seed ?? 20261003);
  const between = (lo: number, hi: number) => lo + random() * (hi - lo);
  const chance = (p: number) => random() < p;
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
  const [shoeTypes, suppliers] = await Promise.all([listActiveShoeTypes(), listActiveSuppliers()]);
  if (shoeTypes.length === 0) return { seeded: false, reason: "no shoe types" };

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

  const token = await createDeviceToken({ name: "Demo camera (seed)" }, admin);
  const device = { id: token.id };

  // ── batches: two a working day (Mon–Sat), each replayed stage by stage ──
  const workingDays: string[] = [];
  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 0) workingDays.push(d);
  }
  let batches = 0;
  let scans = 0;
  const salvage: { id: string; originBatchId: string; at: Date }[] = [];
  let index = 0;

  const SLOTS = [8, 10.5];
  // The last slot whose batch has surely started (a start lands up to 0.3 h after the slot).
  const newestSlot = workingDays
    .flatMap((day) => SLOTS.map((startHour) => ({ day, startHour })))
    .findLast(({ day, startHour }) => past(at(day, startHour + 0.3)));

  for (const day of workingDays) {
    for (const startHour of SLOTS) {
      index += 1;
      // The newest batch to reach the camera; its last two sections stay in the review queue.
      const newest = day === newestSlot?.day && startHour === newestSlot.startHour;
      const school = index % 3 !== 0;
      const shoeType = school ? shoeTypes[0] : (shoeTypes[1] ?? shoeTypes[0]);
      const created = at(day, startHour - between(0.5, 1));
      if (!past(created)) continue;
      const batch = await createBatch(
        {
          rollCode: `LR-${day.slice(2).replaceAll("-", "")}-${String(index).padStart(2, "0")}`,
          shoeTypeId: shoeType.id,
          supplierId: suppliers[0]?.id,
          receivedAt: addDays(day, -1),
          targetQuotaPairs: Math.round(between(100, 160)),
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
            supplierId: suppliers[0]?.id,
            receivedAt: addDays(day, -1),
            targetQuotaPairs: Math.round(between(100, 160)),
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

      // Preparation: the camera checks each section before cutting.
      const prep = stageDurationMs("PREPARATION", random);
      const sections = Math.round(between(20, 30));
      const sectionAt = (i: number) => plus(t, ((i + 0.5) * prep) / sections);
      let captured = 0;
      while (captured < sections && past(sectionAt(captured))) captured += 1;
      for (let i = 0; i < sections; i++) {
        const ts = sectionAt(i);
        if (!past(ts)) break;
        let detections: Detection[] = scenario(random);
        const keepPending = newest && i >= captured - 2;
        if (keepPending)
          detections = [{ classKey: UNKNOWN_CLASS, confidence: 0.82, box: randomBox(random) }];
        const image = await renderLeatherImage(detections, {
          width: options.imageSize ?? 480,
          height: Math.round((options.imageSize ?? 480) * 0.75),
          random,
        });
        const result = await ingestScan(
          {
            image: { bytes: new Uint8Array(image), type: { mime: "image/jpeg", ext: "jpg" } },
            detections,
            source: "SIMULATOR",
            modelVersion: "demo-seed",
            capturedAt: ts,
            batchId: batch.id,
          },
          device,
          ts,
        );
        scans += 1;
        await afterScan(result, ts, keepPending);
      }
      t = plus(t, prep);

      // The rest of the line. One batch goes back from Sole-ing to redo stitching.
      const route: {
        action: "advance" | "move_back" | "complete";
        from: Stage;
        reason?: string;
      }[] = [
        { action: "advance", from: "PREPARATION" },
        { action: "advance", from: "UPPER_MAKING" },
        ...(index === 4
          ? [
              {
                action: "move_back" as const,
                from: "SOLEING" as Stage,
                reason: "Two pairs had loose stitching; redo before soling.",
              },
              { action: "advance" as const, from: "UPPER_MAKING" as Stage },
            ]
          : []),
        { action: "advance", from: "SOLEING" },
        { action: "complete", from: "FINISHING" },
      ];
      for (const step of route) {
        if (!past(t)) break;
        await transitionBatchStage(
          batch.id,
          { action: step.action, expectedStage: step.from, reason: step.reason },
          fm,
          t,
        );
        const next: Stage | null =
          step.action === "complete"
            ? null
            : step.action === "move_back"
              ? "UPPER_MAKING"
              : ((
                  {
                    PREPARATION: "UPPER_MAKING",
                    UPPER_MAKING: "SOLEING",
                    SOLEING: "FINISHING",
                  } as const
                )[step.from as "PREPARATION" | "UPPER_MAKING" | "SOLEING"] ?? null);
        if (next === "UPPER_MAKING" && step.action === "advance")
          await stock("TH-001", "OUT", 1, "Stitching uppers", plus(t, 10 * MINUTE), batch.id);
        if (next === "SOLEING") {
          await stock("AD-001", "OUT", 0.5, "Soling", plus(t, 10 * MINUTE), batch.id);
          await stock("NL-001", "OUT", 1, "Soling", plus(t, 15 * MINUTE), batch.id);
        }
        if (next === null) break;
        t = plus(t, step.action === "move_back" ? 2 * HOUR : stageDurationMs(next, random));
      }
      logger.info({ batch: batch.code }, "Demo week: batch replayed");
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
        targetQuotaPairs: 80,
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
        targetQuotaPairs: 120,
        notes: "For tomorrow's first shift.",
        rollItemId: undefined,
      },
      fm,
      plannedAt,
    );
    batches += 1;
  }

  // ── salvage: some rejected leather reused in open batches, some discarded ──
  // Reuse goes to batches on the line (not tomorrow's planned roll), at most 4 pieces each.
  const open = (await listOpenBatches()).filter((b) => b.status === "IN_PROGRESS");
  const reused = new Map<string, number>();
  for (const item of salvage) {
    const when = new Date(Math.min(item.at.getTime() + 6 * HOUR, now.getTime() - 10 * MINUTE));
    const target = open.find((b) => b.id !== item.originBatchId && (reused.get(b.id) ?? 0) < 4);
    const roll = random();
    if (target && roll < 0.35) {
      const ok = await assignSalvage(
        item.id,
        {
          batchId: target.id,
          expectedStatus: "AVAILABLE",
          note: "Cut for linings and small parts",
        },
        fm,
        when,
      ).then(
        () => true,
        () => false,
      );
      if (ok) reused.set(target.id, (reused.get(target.id) ?? 0) + 1);
    } else if (roll < 0.6) {
      await discardSalvage(
        item.id,
        {
          reason: pick([
            "Hole too large to cut around",
            "Grain damage across the whole section",
            "Too small for any component",
          ]),
          expectedStatus: "AVAILABLE",
        },
        fm,
        when,
      ).catch(() => undefined);
    }
  }

  // ── purchase requests (D-029): the constructor asks, the Floor Manager decides ──
  const requests = await seedRequests();

  const result: DemoSeedResult = {
    seeded: true,
    batches,
    scans,
    requests,
    ms: Date.now() - started,
  };
  logger.info(result, "Demo week seeded");
  return result;

  /**
   * A handful of requests through the real services, one in each state: received (posts stock IN,
   * so the ledger still balances), rejected with a reason, cancelled, approved and waiting for the
   * delivery, and an urgent one pending for the low Contact cement.
   */
  async function seedRequests(): Promise<number> {
    const found = await findUserByEmail("constructor@cpoint.local");
    if (!found || !found.isActive) return 0;
    if (!found.canRequestMaterials) await setRequester(found.id, true, fm!);
    const sc = { id: found.id, role: found.role, canRequestMaterials: true };
    const item = (sku: string) => itemIds.get(sku);
    const last = workingDays[workingDays.length - 1];
    const beforeLast = workingDays[Math.max(0, workingDays.length - 2)];
    let made = 0;

    const send = async (
      when: Date,
      values: {
        priority: "NORMAL" | "URGENT";
        neededBy?: string;
        justification: string;
        lines: { inventoryItemId?: string; itemName?: string; unit?: string; quantity: number }[];
      },
    ) => {
      if (!past(when) || values.lines.some((l) => !l.inventoryItemId && !l.itemName)) return null;
      made += 1;
      return createRequest(values, sc, when);
    };
    const later = (t: Date, hours: number) => {
      const next = plus(t, hours * HOUR);
      return past(next) ? next : null;
    };

    // Monday: thread and tacks for the week, approved, then received the next afternoon.
    const t1 = at(workingDays[0], 9);
    const r1 = await send(t1, {
      priority: "NORMAL",
      justification: "Thread and tacks for this week's school shoe batches.",
      lines: [
        { inventoryItemId: item("TH-001"), quantity: 4 },
        { inventoryItemId: item("NL-001"), quantity: 5 },
      ],
    });
    if (r1) {
      const ok = later(t1, 1.5);
      if (ok) {
        await actOnRequest(
          r1.id,
          { action: "approve", note: "Ordering from the usual supplier today." },
          fm!,
          ok,
        );
        const note = later(t1, 2);
        if (note) await addRemark(r1.id, "Supplier delivers tomorrow afternoon.", fm!, note);
        const got = at(workingDays[1], 14);
        if (past(got)) await actOnRequest(r1.id, { action: "receive" }, fm!, got);
      }
    }

    // Midweek: topsider leather the FM already has coming.
    const t2 = at(workingDays[2], 10);
    const r2 = await send(t2, {
      priority: "NORMAL",
      justification: "Only two suede rolls left for the topsider orders.",
      lines: [{ inventoryItemId: item("LR-002"), quantity: 2 }],
    });
    const no = r2 && later(t2, 3);
    if (r2 && no)
      await actOnRequest(
        r2.id,
        { action: "reject", reason: "Two suede rolls arrive with Thursday's leather delivery." },
        fm!,
        no,
      );

    // Something not in inventory, then found in storage.
    const t3 = at(workingDays[Math.min(3, workingDays.length - 1)], 13);
    const r3 = await send(t3, {
      priority: "NORMAL",
      justification: "Eyelets for the new topsider sample.",
      lines: [{ itemName: "Brass eyelets, 5 mm", unit: "pack", quantity: 2 }],
    });
    const off = r3 && later(t3, 1);
    if (r3 && off)
      await actOnRequest(
        r3.id,
        { action: "cancel", note: "Found a pack in the storage room." },
        sc,
        off,
      );

    // Yesterday: a leather roll, approved and waiting for the delivery.
    const t4 = at(beforeLast, 15);
    const r4 = await send(t4, {
      priority: "NORMAL",
      justification: "Black cowhide for next week's school shoe batches.",
      lines: [{ inventoryItemId: item("LR-001"), quantity: 3 }],
    });
    const yes = r4 && later(t4, 1);
    if (r4 && yes)
      await actOnRequest(
        r4.id,
        { action: "approve", note: "Ordered. Arriving early next week." },
        fm!,
        yes,
      );

    // Today: contact cement is low, so an urgent request waits for the Floor Manager.
    await send(plus(now, -2 * HOUR), {
      priority: "URGENT",
      neededBy: last >= manilaToday(plus(now, -2 * HOUR)) ? last : undefined,
      justification: "The last can is half empty and Upper Making uses it all day.",
      lines: [{ inventoryItemId: item("AD-001"), quantity: 4 }],
    });
    return made;
  }

  /** What people do after each scan: overrides, review decisions, repairs, salvage. */
  async function afterScan(
    scan: { scanId: string; batchId: string; verdict: string },
    ts: Date,
    keepPending = false,
  ) {
    let final: string | null = scan.verdict === "NEEDS_REVIEW" ? null : scan.verdict;
    let decidedAt = ts; // repairs and salvage can only follow the decision
    const people: Actor[] = [qi!, fm!];

    if (scan.verdict === "NEEDS_REVIEW") {
      const when = plus(ts, between(30, 120) * MINUTE);
      // Recent unknowns stay in the review queue, as on a real afternoon.
      if (!keepPending && when.getTime() < now.getTime() - 2 * HOUR) {
        const verdict = chance(0.7) ? "PASS" : "REWORK";
        await decideScan(scan.scanId, { verdict, expectedFinalVerdict: null }, qi!, when);
        final = verdict;
        decidedAt = when;
      }
    } else {
      const override =
        scan.verdict === "REJECT" && chance(0.15)
          ? {
              verdict: "REWORK" as const,
              reason: "Defect is near the edge; the section can be cut around it.",
            }
          : scan.verdict === "PASS" && chance(0.03)
            ? { verdict: "REWORK" as const, reason: "Small scuff the camera missed." }
            : scan.verdict === "REWORK" && chance(0.05)
              ? { verdict: "PASS" as const, reason: "Mark is within tolerance for this shoe type." }
              : null;
      const when = plus(ts, 5 * MINUTE);
      if (override && past(when)) {
        await decideScan(
          scan.scanId,
          {
            verdict: override.verdict,
            reason: override.reason,
            expectedFinalVerdict: scan.verdict as "PASS" | "REWORK" | "REJECT",
          },
          pick(people),
          when,
        );
        final = override.verdict;
        decidedAt = when;
      }
    }

    if (final === "REWORK" || final === "REJECT") {
      const live = await findLiveOutcomes(scan.scanId);
      if (live.rework) {
        const start = plus(decidedAt, between(15, 90) * MINUTE);
        if (past(start)) {
          await moveReworkTicket(
            live.rework.id,
            { move: "start", expectedStatus: "OPEN" },
            pick(people),
            start,
          );
          const done = plus(start, between(20, 120) * MINUTE);
          if (past(done) && chance(0.9))
            await moveReworkTicket(
              live.rework.id,
              { move: "done", expectedStatus: "IN_PROGRESS" },
              pick(people),
              done,
            );
        }
      }
      if (live.salvage)
        salvage.push({ id: live.salvage.id, originBatchId: scan.batchId, at: decidedAt });
    }
  }
}
