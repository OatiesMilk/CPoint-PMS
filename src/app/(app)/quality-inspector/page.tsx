/*
 * Intent brief (ui-craft §1)
 * Who:   the Quality Inspector, at a desk next to the line, through the whole shift.
 * What:  verify the camera's decisions and settle the ones it can't make.
 * Worst: a wrong automatic Reject or Pass goes unchecked.
 * Phase 1 placeholder: panels describe what each later phase adds.
 */
import type { Metadata } from "next";
import { ComingSoonCard } from "@/components/features/coming-soon-card";
import { PageHeader } from "@/components/features/page-header";
import { requireRole } from "@/server/policies/guard";

export const metadata: Metadata = { title: "Overview" };

export default async function QualityInspectorHome() {
  const user = await requireRole("QUALITY_INSPECTOR");
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today's inspection work."
      />
      <div className="grid grid-cols-3 gap-4">
        <ComingSoonCard
          phase={3}
          title="Decisions to verify"
          description="Today's automatic Rework and Reject calls, with one-click override."
        />
        <ComingSoonCard
          phase={3}
          title="Flagged scans"
          description="Scans with a defect class the system doesn't know yet."
        />
        <ComingSoonCard
          phase={3}
          title="Latest scans"
          description="Live feed from the Preparation camera."
        />
        <ComingSoonCard
          phase={7}
          title="Defects by type"
          description="Today's cut, hole, abrasion and dirt counts."
        />
        <ComingSoonCard
          phase={7}
          title="AI agreement rate"
          description="How often people agree with the camera's decision."
        />
      </div>
    </>
  );
}
