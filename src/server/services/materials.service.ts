import { manilaToday } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/inventory-rules";
import {
  daysIn,
  monthWeekOf,
  resolveWeek,
  sumByWeek,
  weeksEndingWith,
  workingDaysIn,
} from "@/lib/month-weeks";
import { addDays, manilaDayStart, toCsv } from "@/lib/report-rules";
import {
  daysLeft,
  daysToNextReminder,
  mayRunOut,
  PACE_DAYS,
  TREND_WEEKS,
  weekChange,
} from "@/lib/stock-rules";
import type { InventoryCategory } from "@/lib/domain";
import {
  listMaterialItems,
  pairsByDay,
  rollsCheckedByDay,
  rollsRemovedByDay,
  rollsReturnedByDay,
  usedBetween,
  usedByDay,
} from "@/server/models/materials.model";
import { listDayPlans } from "@/server/models/production.model";
import { reminderDays } from "./stock-update.service";

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/*
 * Reports → Materials (Phase 29, D-102, C-16): what each material was used for, from the Used
 * entries of the Update stock sheet. Corrections and Added never count as use. Per item and week
 * only, never per person (D-008).
 *
 * D-109: the week shown is picked by Year, Month and Week, a month's weeks being days 1 to 7, 8 to
 * 14 and so on (`lib/month-weeks`); it defaults to the week today falls in. The selected week, the
 * week before it follow the pick; the Leather rolls table shows the eight weeks up to it. Days
 * left keeps its meaning: the last 28 days up to today (D-102), whatever week is picked. The
 * 8-week trend and Per 100 pairs were removed (Dylan, 4 Nov 2026, D-116).
 */

export type MaterialsOptions = { year?: unknown; month?: unknown; week?: unknown; q?: unknown };
export type MaterialsReport = Awaited<ReturnType<typeof materialsReport>>;

/** The search text: trimmed, lower case; empty when none. */
export function normaliseQuery(q: unknown): string {
  const s = Array.isArray(q) ? q[0] : q;
  return typeof s === "string" ? s.trim().toLowerCase().slice(0, 80) : "";
}

/** Whether an item matches the search (its name or code, any case). */
export const matchesQuery = (item: { name: string; sku: string }, q: string) =>
  q === "" || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);

export async function materialsReport(options: MaterialsOptions = {}, now = new Date()) {
  const today = manilaToday(now);
  const selected = resolveWeek(options, today);
  const weeks = weeksEndingWith(selected, TREND_WEEKS);
  const from = weeks[0].from;
  const q = normaliseQuery(options.q);
  const paceFrom = addDays(today, -(PACE_DAYS - 1));
  const [items, usedDays, pairDays, rollDays, returnedDays, removedDays, plans, used28, days] =
    await Promise.all([
      listMaterialItems(),
      usedByDay(from, selected.to),
      pairsByDay(from, selected.to),
      rollsCheckedByDay(from, selected.to),
      rollsReturnedByDay(from, selected.to),
      rollsRemovedByDay(from, selected.to),
      listDayPlans(from, selected.to),
      usedBetween(manilaDayStart(paceFrom), now),
      reminderDays(),
    ]);
  // An item whose stock history starts less than 4 weeks ago is paced from that day, so a new
  // item's days left aren't diluted by days it wasn't on the shelf.
  const paceStart = (since: Date) => {
    const added = manilaToday(since);
    return added > paceFrom ? added : paceFrom;
  };
  const toNext = daysToNextReminder(today, days);
  const usedOf = (itemId: string) =>
    sumByWeek(
      weeks,
      usedDays.filter((r) => r.itemId === itemId).map((r) => ({ day: r.day, value: r.used })),
    );

  const all = items.map((item) => {
    const trend = usedOf(item.id);
    const thisWeek = trend[trend.length - 1];
    const lastWeek = trend[trend.length - 2] ?? 0;
    const pace = used28.get(item.id) ?? 0;
    const start = paceStart(item.since);
    const paceDays = Math.min(PACE_DAYS, daysBetween(start, today) + 1);
    const left = daysLeft(item.onHand, pace, paceDays);
    const { since: _since, ...rest } = item;
    return {
      ...rest,
      categoryLabel: CATEGORY_LABELS[item.category as InventoryCategory] ?? item.category,
      trend,
      thisWeek,
      lastWeek,
      ...weekChange(thisWeek, lastWeek),
      usedPace: pace,
      daysLeft: left,
      mayRunOut: mayRunOut(left, toNext),
    };
  });

  // D-118: a roll is used when the camera passed it, so Rolls used = checked − returned. Removed
  // rolls (water damage, …) are neither; they show apart as Removed (other). The leather items'
  // rows above still count every roll that left stock, which is what Days left needs.
  const rollsChecked = sumByWeek(weeks, rollDays);
  const rollsReturned = sumByWeek(weeks, returnedDays);
  const rollsRemoved = sumByWeek(weeks, removedDays);
  const pairs = sumByWeek(weeks, pairDays);
  const nonWorking = new Set(plans.filter((p) => p.kind === "NON_WORKING").map((p) => p.day));
  const leather = weeks.map((week, i) => ({
    week,
    workingDays: workingDaysIn(week, nonWorking),
    rollsUsed: Math.max(0, rollsChecked[i] - rollsReturned[i]),
    rollsChecked: rollsChecked[i],
    rollsReturned: rollsReturned[i],
    rollsRemoved: rollsRemoved[i],
    pairs: pairs[i],
  }));

  const firstYear = Math.min(
    Number(today.slice(0, 4)),
    ...items.map((i) => Number(manilaToday(i.since).slice(0, 4))),
  );

  return {
    today,
    selected,
    previous: weeks[weeks.length - 2],
    /** The week today falls in: the selected week is still going on when it's this one. */
    current: monthWeekOf(today),
    /** Days of the selected week, and of the one before (a month's last week can be shorter). */
    days: { selected: daysIn(selected), previous: daysIn(weeks[weeks.length - 2]) },
    weeks,
    q,
    /** Every item, for the totals and the run-out warning; `rows` is what the search kept. */
    itemCount: all.length,
    rows: all.filter((r) => matchesQuery(r, q)),
    atRisk: all.filter((r) => r.mayRunOut),
    nothingUsedInWeek: all.every((r) => r.thisWeek === 0),
    leather,
    years: Array.from(
      { length: Number(today.slice(0, 4)) - firstYear + 1 },
      (_, i) => firstYear + i,
    ),
    pace: { fromDay: paceFrom, toDay: today, days: PACE_DAYS },
    reminderDays: days,
    daysToNextReminder: toNext,
  };
}

/**
 * materials-used.csv: one row per item (those the search kept) and week, for the eight weeks
 * ending with the selected one, oldest first (D-109).
 */
export async function materialsCsv(options: MaterialsOptions = {}, now = new Date()) {
  const report = await materialsReport(options, now);
  const rows = report.weeks.flatMap((week, i) =>
    report.rows.map((item) => ({
      week,
      item,
      used: item.trend[i],
      pairs: report.leather[i].pairs,
    })),
  );
  return {
    from: report.weeks[0].from,
    to: report.selected.to < report.today ? report.selected.to : report.today,
    body: toCsv(rows, [
      { header: "Week", value: (r) => r.week.label },
      { header: "From", value: (r) => r.week.from },
      { header: "To", value: (r) => r.week.to },
      { header: "Item code", value: (r) => r.item.sku },
      { header: "Item", value: (r) => r.item.name },
      { header: "Category", value: (r) => r.item.categoryLabel },
      { header: "Supplier", value: (r) => r.item.supplier ?? "" },
      { header: "Unit", value: (r) => r.item.unit },
      { header: "Used", value: (r) => r.used },
      { header: "Pairs finished", value: (r) => r.pairs },
    ]),
  };
}
