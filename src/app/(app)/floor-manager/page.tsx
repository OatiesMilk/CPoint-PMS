/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk, checking the line several times a shift.
 * What:  see what needs attention on the line today (exceptions first).
 * Worst: missing a backlog (open reworks, low leather stock) until it stops production.
 * Batches by stage, Latest scans and Open reworks are live; the rest describe later phases.
 */
import type { Metadata } from "next";
import { BatchesByStageCard } from "@/components/features/batches/batches-by-stage-card";
import { ComingSoonCard } from "@/components/features/coming-soon-card";
import { LatestScansWidget } from "@/components/features/scans/latest-scans-widget";
import { OpenReworksCard } from "@/components/features/rework/open-reworks-card";
import { PageHeader } from "@/components/features/page-header";
import { connection } from "next/server";
import { requireRole } from "@/server/policies/guard";
import { batchesByStageSummary } from "@/server/services/batch.service";
import { reworkSummary } from "@/server/services/rework.service";

export const metadata: Metadata = { title: "Overview" };

export default async function FloorManagerHome() {
  const user = await requireRole("FLOOR_MANAGER");
  await connection();
  const [summary, repairs] = await Promise.all([batchesByStageSummary(), reworkSummary()]);
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today on the production line."
      />
      <div className="grid grid-cols-3 gap-4">
        <BatchesByStageCard planned={summary.planned} stages={summary.stages} />
        <LatestScansWidget />
        <ComingSoonCard
          phase={7}
          title="Today's inspection split"
          description="How many leather sections passed, went to rework or were rejected."
        />
        <OpenReworksCard {...repairs} />
        <ComingSoonCard
          phase={5}
          title="Low-stock alerts"
          description="Leather rolls and supplies at or below their reorder level."
        />
        <ComingSoonCard
          phase={7}
          title="Daily summary"
          description="One-page summary per day, exportable to CSV."
        />
      </div>
    </>
  );
}
