/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk, checking the line several times a shift.
 * What:  see what needs attention on the line today (exceptions first).
 * Worst: missing a backlog (open reworks, low leather stock) until it stops production.
 * Phase 1 placeholder: panels describe what each later phase adds. Real data arrives in Phase 7.
 */
import type { Metadata } from "next";
import { ComingSoonCard } from "@/components/features/coming-soon-card";
import { PageHeader } from "@/components/features/page-header";
import { requireRole } from "@/server/policies/guard";

export const metadata: Metadata = { title: "Overview" };

export default async function FloorManagerHome() {
  const user = await requireRole("FLOOR_MANAGER");
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today on the production line."
      />
      <div className="grid grid-cols-3 gap-4">
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
          phase={2}
          title="Batches by stage"
          description="Where every leather roll is, so the Upper Making and Sole-ing backlog shows early."
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
