/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk, checking the line several times a shift.
 * What:  see what needs attention on the line today (exceptions first).
 * Worst: missing a backlog (a short day, low leather stock) until it stops production.
 * Every card is live (D-025): today's batches against the quota, attendance, rolls today, stock,
 * and today's numbers (Phase 28, D-100). On a weekday with no plan, Plan today comes first (A-37);
 * on a reminder day, Stock update today until an update is saved (Phase 29, C-32).
 */
import type { Metadata } from "next";
import { AttendanceCard } from "@/components/features/attendance/attendance-card";
import {
  PlanTodayCard,
  TodaysBatchesCard,
} from "@/components/features/production/production-cards";
import { DailySummaryCard, RollsTodayCard } from "@/components/features/reports/home-cards";
import { LowStockCard } from "@/components/features/inventory/low-stock-card";
import { StockUpdateCard } from "@/components/features/inventory/stock-update-card";
import { PageHeader } from "@/components/features/page-header";
import { connection } from "next/server";
import { requireRole } from "@/server/policies/guard";
import { todayWorkforce } from "@/server/services/attendance.service";
import { productionToday } from "@/server/services/production.service";
import { lowStockSummary } from "@/server/services/inventory.service";
import { recentDays, todaySplit } from "@/server/services/report.service";
import { openRollCount } from "@/server/services/roll.service";
import { stockUpdateReminder } from "@/server/services/stock-update.service";

export const metadata: Metadata = { title: "Overview" };

export default async function FloorManagerHome() {
  const user = await requireRole("FLOOR_MANAGER");
  await connection();
  const [production, lowStock, split, recent, attendance, openRolls, stock] = await Promise.all([
    productionToday(user),
    lowStockSummary(),
    todaySplit(),
    recentDays(),
    todayWorkforce(),
    openRollCount(),
    stockUpdateReminder(),
  ]);
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today on the production line."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {production.planNeeded && <PlanTodayCard day={production.day} />}
        {stock.due && <StockUpdateCard reminderDays={stock.reminderDays} />}
        <TodaysBatchesCard today={production} />
        <AttendanceCard workforce={attendance.workforce} summary={attendance.summary} />
        <RollsTodayCard totals={split} openRolls={openRolls} />
        <LowStockCard {...lowStock} />
        <DailySummaryCard {...recent} />
      </div>
    </>
  );
}
