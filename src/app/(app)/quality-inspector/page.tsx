/*
 * Intent brief (ui-craft §1)
 * Who:   the Quality Inspector, at a desk next to the line, through the whole shift.
 * What:  verify the camera's decisions and settle the ones it can't make.
 * Worst: a wrong automatic Reject or Pass goes unchecked. Pending reviews are the primary action.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Aperture, ArrowRight, CircleHelp, ListChecks, UserCheck } from "lucide-react";
import { AgreementCard, DefectsTodayCard } from "@/components/features/reports/home-cards";
import { PageHeader } from "@/components/features/page-header";
import { LatestScansWidget } from "@/components/features/scans/latest-scans-widget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/policies/guard";
import { agreementSummary, defectsToday } from "@/server/services/report.service";
import { inspectorSummary } from "@/server/services/scan-query.service";

export const metadata: Metadata = { title: "Overview" };

export default async function QualityInspectorHome() {
  const user = await requireRole("QUALITY_INSPECTOR");
  await connection();
  const [summary, defects, agreement] = await Promise.all([
    inspectorSummary(),
    defectsToday(),
    agreementSummary(),
  ]);

  const tiles = [
    {
      label: "Waiting for your decision",
      value: summary.pending,
      hint: "Unknown defect classes the camera couldn’t decide.",
      href: "/review",
      Icon: CircleHelp,
    },
    {
      label: "Rework and Reject today",
      value: summary.todayAuto,
      hint: "Automatic calls you can spot-check.",
      href: "/review",
      Icon: ListChecks,
    },
    {
      label: "Overridden today",
      value: summary.todayOverrides,
      hint: "Decisions a person changed.",
      href: "/scans?override=1",
      Icon: UserCheck,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Today’s inspection work."
        actions={
          <>
            {/* Capturing is the steady work; reviews waiting come first when there are any. */}
            <Button asChild variant={summary.pending > 0 ? "secondary" : "primary"}>
              <Link href="/camera/capture">
                <Aperture aria-hidden />
                Capture sections
              </Link>
            </Button>
            {summary.pending > 0 && (
              <Button asChild>
                <Link href="/review">
                  Review {summary.pending} scan{summary.pending === 1 ? "" : "s"}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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
        <div className="flex flex-col gap-4">
          <DefectsTodayCard defects={defects} />
          <AgreementCard {...agreement} />
        </div>
      </div>
    </>
  );
}
