/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, occasionally, to manage accounts and settings.
 * What:  confirm the system is healthy, then go to the admin task at hand. Administration only
 *        (Phase 28, D-100): health, users, the lunch break and the audit log; no camera
 *        status, which is production (D-119).
 * Worst: not noticing the database is down while the floor relies on the system.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS, type Role } from "@/lib/domain";
import { formatDayLabel } from "@/lib/format";
import { requireRole } from "@/server/policies/guard";
import { auditCountLastDay } from "@/server/services/audit-query.service";
import { lunchBreakSettings } from "@/server/services/production.service";
import { userSummary } from "@/server/services/user-admin.service";
import { getHealth } from "@/server/services/health.service";
import { CardLink } from "@/components/ui/card-link";

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
  const [health, users, lunch, auditDay] = await Promise.all([
    getHealth(),
    userSummary(),
    lunchBreakSettings(),
    auditCountLastDay(),
  ]);
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
              <div key={row.label}>
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd
                  className={
                    row.ok
                      ? "flex items-center gap-2 font-medium"
                      : "flex items-center gap-2 font-medium text-reject"
                  }
                >
                  {row.ok ? (
                    <CheckCircle2 aria-hidden className="size-5 text-pass" />
                  ) : (
                    <CircleAlert aria-hidden className="size-5 text-reject" />
                  )}
                  {row.text}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] items-start gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Active accounts by role.</CardDescription>
              </div>
              <CardLink href={users.locked > 0 ? "/admin/users?status=locked" : "/admin/users"}>
                Manage users
              </CardLink>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="flex flex-col gap-1 text-sm">
              {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                <div key={role} className="flex justify-between">
                  <dt className="text-muted-foreground">{ROLE_LABELS[role]}</dt>
                  <dd className="font-medium tabular-nums">
                    {users.byRole.find((r) => r.role === role)?.count ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
            {users.locked > 0 && (
              <p className="text-sm font-medium text-caution">
                {users.locked} locked out right now
              </p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="lunch-break-card">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Lunch break</CardTitle>
                <CardDescription>Pauses the batch it falls in, every working day.</CardDescription>
              </div>
              <CardLink href="/admin/settings?tab=lunch">Lunch break</CardLink>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              Today: <span className="font-medium">{lunch.current.text}</span>
            </p>
            {lunch.upcoming && (
              <p className="text-sm text-muted-foreground">
                From {formatDayLabel(lunch.upcoming.from)}: {lunch.upcoming.text}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Audit log</CardTitle>
                <CardDescription>Changes and sign-ins in the last 24 hours.</CardDescription>
              </div>
              <CardLink href="/admin/audit">Open the audit log</CardLink>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-kpi font-semibold tracking-tight tabular-nums">
              {auditDay.toLocaleString("en-PH")}
            </p>
            <div className="border-t pt-4">
              <CardLink href="/admin/tokens">Camera API tokens</CardLink>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
