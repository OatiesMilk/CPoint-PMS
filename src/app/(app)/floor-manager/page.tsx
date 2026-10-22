/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk, checking the line several times a shift.
 * What:  see what needs attention on the line today (exceptions first).
 * Worst: missing a backlog (open reworks, low leather stock, purchase requests waiting on a
 *        decision) until it stops production.
 * Every card is live: today's production against the quota, attendance, camera, repairs, stock, and today's numbers (D-025).
 */
import type { Metadata } from "next";
import { AttendanceCard } from "@/components/features/attendance/attendance-card";
import { TodaysProductionCard } from "@/components/features/production/production-cards";
import { DailySummaryCard, InspectionSplitCard } from "@/components/features/reports/home-cards";
import { LatestScansWidget } from "@/components/features/scans/latest-scans-widget";
import { LowStockCard } from "@/components/features/inventory/low-stock-card";
import { OpenReworksCard } from "@/components/features/rework/open-reworks-card";
import { PendingRequestsCard } from "@/components/features/procurement/pending-requests-card";
import { PageHeader } from "@/components/features/page-header";
import { connection } from "next/server";
import { requireRole } from "@/server/policies/guard";
import { todayWorkforce } from "@/server/services/attendance.service";
import { productionToday } from "@/server/services/production.service";
import { lowStockSummary } from "@/server/services/inventory.service";
import { pendingRequestsCard } from "@/server/services/procurement.service";
import { recentDays, todaySplit } from "@/server/services/report.service";
import { reworkSummary } from "@/server/services/rework.service";

export const metadata: Metadata = { title: "Overview" };

export default async function FloorManagerHome() {
  const user = await requireRole("FLOOR_MANAGER");
  await connection();
  const [production, repairs, lowStock, split, recent, requests, attendance] = await Promise.all([
    productionToday(user),
    reworkSummary(),
    lowStockSummary(),
    todaySplit(),
    recentDays(),
    pendingRequestsCard(),
    todayWorkforce(),
  ]);
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today on the production line."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TodaysProductionCard today={production} />
        <AttendanceCard workforce={attendance.workforce} summary={attendance.summary} />
        <LatestScansWidget />
        <InspectionSplitCard totals={split} />
        <OpenReworksCard {...repairs} />
        <LowStockCard {...lowStock} />
        <DailySummaryCard {...recent} />
        <PendingRequestsCard {...requests} now={new Date()} />
      </div>
    </>
  );
}
