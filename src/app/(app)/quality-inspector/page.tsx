/*
 * Intent brief (ui-craft §1)
 * Who:   the Quality Inspector, at a desk next to the line, through the whole shift.
 * What:  count the pairs finished at each production check-in (D-084) and follow today's
 *        sections, whose Pass or Reject is final (D-093). The constructors capture (Phase 26).
 * Worst: a check-in is missed. The next check-in comes first; today's sections are context.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CircleX, ScanLine } from "lucide-react";
import { DefectsTodayCard } from "@/components/features/reports/home-cards";
import { PageHeader } from "@/components/features/page-header";
import { NextCheckInCard } from "@/components/features/production/production-cards";
import { LatestScansWidget } from "@/components/features/scans/latest-scans-widget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/policies/guard";
import { productionToday } from "@/server/services/production.service";
import { defectsToday } from "@/server/services/report.service";
import { inspectorSummary } from "@/server/services/scan-query.service";

export const metadata: Metadata = { title: "Overview" };

export default async function QualityInspectorHome() {
  const user = await requireRole("QUALITY_INSPECTOR");
  await connection();
  const [summary, defects, production] = await Promise.all([
    inspectorSummary(),
    defectsToday(),
    productionToday(user),
  ]);

  const tiles = [
    {
      label: "Sections scanned today",
      value: summary.scannedToday,
      hint: "Every section gets Pass or Reject from the camera.",
      href: "/scans",
      Icon: ScanLine,
    },
    {
      label: "Rejected today",
      value: summary.rejectedToday,
      hint: "Reported for salvage. The camera’s verdict is final.",
      href: "/scans?verdict=REJECT",
      Icon: CircleX,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today’s inspection work."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <NextCheckInCard today={production} />
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <t.Icon aria-hidden className="size-4" />
                {t.label}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                <Link href={t.href} className="underline-offset-4 hover:underline">
                  {t.value}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t.hint}</p>
            </CardContent>
          </Card>
        ))}
        <LatestScansWidget className="xl:col-span-2" />
        <DefectsTodayCard defects={defects} />
      </div>
    </>
  );
}
