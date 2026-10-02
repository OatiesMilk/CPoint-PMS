/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, occasionally, to manage accounts and settings.
 * What:  confirm the system is healthy, then go to the admin task at hand.
 * Worst: not noticing the database is down while the floor relies on the system.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { ComingSoonCard } from "@/components/features/coming-soon-card";
import { PageHeader } from "@/components/features/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/policies/guard";
import { getHealth } from "@/server/services/health.service";

export const metadata: Metadata = { title: "Overview" };

function formatManila(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function AdminHome() {
  await requireRole("SYSTEM_ADMIN");
  await connection();
  const health = await getHealth();
  const dbUp = health.checks.database === "up";

  return (
    <>
      <PageHeader title="System overview" description="Health, accounts and settings." />
      <Card>
        <CardHeader>
          <CardTitle>System health</CardTitle>
          <CardDescription>
            Checked {formatManila(health.time)} · version {health.version}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid max-w-xl grid-cols-2 gap-4">
            {[
              { label: "Application", ok: true, text: "Up" },
              { label: "Database", ok: dbUp, text: dbUp ? "Connected" : "Not reachable" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2.5">
                {row.ok ? (
                  <CheckCircle2 aria-hidden className="size-5 text-pass" />
                ) : (
                  <CircleAlert aria-hidden className="size-5 text-reject" />
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className={row.ok ? "font-medium" : "font-medium text-reject"}>{row.text}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        <ComingSoonCard
          phase={6}
          title="Users"
          description="Create accounts, change roles, deactivate, reset passwords."
        />
        <ComingSoonCard
          phase={6}
          title="Defect types & thresholds"
          description="Edit defect classes and the 90% / 60% decision thresholds."
        />
        <ComingSoonCard
          phase={3}
          title="Camera API tokens"
          description="Issue and revoke tokens for phone, webcam or dedicated cameras."
        />
      </div>
    </>
  );
}
