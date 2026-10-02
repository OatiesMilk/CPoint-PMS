/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk, checking the line several times a shift.
 * What:  see what needs attention on the line today (exceptions first).
 * Worst: missing a backlog (open reworks, low leather stock) until it stops production.
 * Batches by stage is live (Phase 2); the other panels describe what later phases add.
 */
import type { Metadata } from "next";
import { BatchesByStageCard } from "@/components/features/batches/batches-by-stage-card";
import { ComingSoonCard } from "@/components/features/coming-soon-card";
import { PageHeader } from "@/components/features/page-header";
import { connection } from "next/server";
import { requireRole } from "@/server/policies/guard";
import { batchesByStageSummary } from "@/server/services/batch.service";

export const metadata: Metadata = { title: "Overview" };

export default async function FloorManagerHome() {
  const user = await requireRole("FLOOR_MANAGER");
  await connection();
  const summary = await batchesByStageSummary();
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today on the production line."
      />
      <div className="grid grid-cols-3 gap-4">
        <BatchesByStageCard planned={summary.planned} stages={summary.stages} />
        <ComingSoonCard
          phase={3}
          title="Latest scans"
          description="Live feed from the Preparation camera with each Pass, Rework or Reject."
        />
        <ComingSoonCard
          phase={7}
          title="Today's inspection split"
          description="How many leather sections passed, went to rework or were rejected."
        />
        <ComingSoonCard
          phase={4}
          title="Open reworks"
          description="Sections waiting at the repair station, oldest first."
        />
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
