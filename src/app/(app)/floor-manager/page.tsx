/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk, glancing at the Overview several times a shift.
 * What:  see in two seconds whether anything needs doing now, then how the line is doing.
 * Worst: a real exception (no plan, a missed stock update, low stock) sits among equal-looking
 *        cards, or the same prompt shows twice and gets ignored.
 * Three zones (Overview clean-up, D-131): Needs attention (only when something is due), On the
 * line now (today's batches beside work in progress), Today so far (attendance, rolls, low
 * stock, the daily summary). Every card is live (D-025). The plan banner is hidden here, since
 * the Plan today row says the same thing (A-97); the bell and every other page keep it.
 */
import type { Metadata } from "next";
import { AttendanceCard } from "@/components/features/attendance/attendance-card";
import {
  PlanTodayCard,
  TodaysBatchesCard,
} from "@/components/features/production/production-cards";
import { DailySummaryCard, RollsTodayCard } from "@/components/features/reports/home-cards";
import { WipCard } from "./wip-card";
import { wipBoard } from "@/server/services/stage.service";
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
  const [production, lowStock, split, recent, attendance, openRolls, stock, board] =
    await Promise.all([
      productionToday(user),
      lowStockSummary(),
      todaySplit(),
      recentDays(),
      todayWorkforce(),
      openRollCount(),
      stockUpdateReminder(),
      wipBoard(user),
    ]);
  const needsAttention = production.planNeeded || stock.due;
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today on the production line."
      />
      {needsAttention && (
        <section
          aria-labelledby="needs-attention"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-4"
        >
          <h2 id="needs-attention" className="sr-only">
            Needs attention
          </h2>
          {production.planNeeded && <PlanTodayCard day={production.day} />}
          {stock.due && (
            <StockUpdateCard reminderDays={stock.reminderDays} primary={!production.planNeeded} />
          )}
        </section>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TodaysBatchesCard today={production} />
        <WipCard board={board} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <AttendanceCard workforce={attendance.workforce} summary={attendance.summary} />
        <RollsTodayCard totals={split} openRolls={openRolls} />
        <LowStockCard {...lowStock} />
        <DailySummaryCard {...recent} />
      </div>
    </>
  );
}
