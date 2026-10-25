import { manilaToday } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/inventory-rules";
import { addDays, manilaDayStart, toCsv } from "@/lib/report-rules";
import {
  daysLeft,
  daysToNextReminder,
  lastWeeks,
  mayRunOut,
  PACE_DAYS,
  perHundredPairs,
  TREND_WEEKS,
  weekChange,
} from "@/lib/stock-rules";
import type { InventoryCategory } from "@/lib/domain";
import {
  listMaterialItems,
  pairsBetween,
  pairsByWeek,
  rollsCheckedByWeek,
  usedBetween,
  usedByWeek,
} from "@/server/models/materials.model";
import { reminderDays } from "./stock-update.service";

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/*
 * Reports → Materials (Phase 29, D-102, C-16): what each material was used for per week, from the
 * Used entries of the Update stock sheet. Corrections and Added never count as use. Per item and
 * week only, never per person (D-008).
 */

export type MaterialsReport = Awaited<ReturnType<typeof materialsReport>>;

export async function materialsReport(now = new Date()) {
  const today = manilaToday(now);
  const weeks = lastWeeks(today, TREND_WEEKS);
  const start = manilaDayStart(weeks[0]);
  const paceFrom = addDays(today, -(PACE_DAYS - 1));
  const [items, byWeek, pairsWeek, rollsWeek, used28, days] = await Promise.all([
    listMaterialItems(),
    usedByWeek(start),
    pairsByWeek(weeks[0]),
    rollsCheckedByWeek(start),
    usedBetween(manilaDayStart(paceFrom), now),
    reminderDays(),
  ]);
  // An item whose stock history starts less than 4 weeks ago is paced from that day, so a new
  // item's days left and use per 100 pairs aren't diluted by days it wasn't on the shelf.
  const paceStart = (since: Date) => {
    const added = manilaToday(since);
    return added > paceFrom ? added : paceFrom;
  };
  const starts = [...new Set([paceFrom, ...items.map((i) => paceStart(i.since))])];
  const pairsSince = new Map(
    await Promise.all(starts.map(async (d) => [d, await pairsBetween(d, today)] as const)),
  );
  const pairs28 = pairsSince.get(paceFrom) ?? 0;
  const toNext = daysToNextReminder(today, days);
  const usedOf = (itemId: string, week: string) =>
    byWeek.find((r) => r.itemId === itemId && r.week === week)?.used ?? 0;

  const rows = items.map((item) => {
    const trend = weeks.map((w) => usedOf(item.id, w));
    const thisWeek = trend[trend.length - 1];
    const lastWeek = trend[trend.length - 2] ?? 0;
    const pace = used28.get(item.id) ?? 0;
    const from = paceStart(item.since);
    const paceDays = Math.min(PACE_DAYS, daysBetween(from, today) + 1);
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
      perHundredPairs: perHundredPairs(pace, pairsSince.get(from) ?? 0),
      daysLeft: left,
      mayRunOut: mayRunOut(left, toNext),
    };
  });

  const leatherIds = new Set(items.filter((i) => i.category === "LEATHER_ROLL").map((i) => i.id));
  const leather = weeks.map((week) => ({
    week,
    rollsUsed: byWeek
      .filter((r) => r.week === week && leatherIds.has(r.itemId))
      .reduce((t, r) => t + r.used, 0),
    rollsChecked: rollsWeek.get(week) ?? 0,
    pairs: pairsWeek.get(week) ?? 0,
  }));

  return {
    today,
    weeks,
    rows,
    leather,
    pace: { fromDay: paceFrom, toDay: today, days: PACE_DAYS, pairs: pairs28 },
    reminderDays: days,
    daysToNextReminder: toNext,
  };
}

/** materials-used.csv: one row per item and week, oldest week first. */
export async function materialsCsv(now = new Date()) {
  const report = await materialsReport(now);
  const pairs = new Map(report.leather.map((w) => [w.week, w.pairs]));
  const rows = report.weeks.flatMap((week, i) =>
    report.rows.map((item) => ({ week, item, used: item.trend[i], pairs: pairs.get(week) ?? 0 })),
  );
  return {
    from: report.weeks[0],
    to: report.today,
    body: toCsv(rows, [
      { header: "Week (Monday)", value: (r) => r.week },
      { header: "Item code", value: (r) => r.item.sku },
      { header: "Item", value: (r) => r.item.name },
      { header: "Category", value: (r) => r.item.categoryLabel },
      { header: "Supplier", value: (r) => r.item.supplier ?? "" },
      { header: "Unit", value: (r) => r.item.unit },
      { header: "Used", value: (r) => r.used },
      { header: "Pairs finished", value: (r) => r.pairs },
      {
        header: "Used per 100 pairs",
        value: (r) => {
          const v = perHundredPairs(r.used, r.pairs);
          return v === null ? "" : v;
        },
      },
    ]),
  };
}
