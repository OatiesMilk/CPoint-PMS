/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, occasionally, to manage accounts and settings.
 * What:  confirm the system is healthy, then go to the admin task at hand.
 * Worst: not noticing the database is down while the floor relies on the system.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeThresholds } from "@/lib/admin-rules";
import { ROLE_LABELS, type Role } from "@/lib/domain";
import { requireRole } from "@/server/policies/guard";
import { auditCountLastDay } from "@/server/services/audit-query.service";
import { getThresholds, unknownClasses } from "@/server/services/settings.service";
import { userSummary } from "@/server/services/user-admin.service";
import { getHealth } from "@/server/services/health.service";

export const metadata: Metadata = { title: "Overview" };

function formatManila(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

export default async function AdminHome() {
  await requireRole("SYSTEM_ADMIN");
  await connection();
  const [health, users, thresholds, unknown, auditDay] = await Promise.all([
    getHealth(),
    userSummary(),
    getThresholds(),
    unknownClasses(),
    auditCountLastDay(),
  ]);
  const bands = describeThresholds(thresholds);
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
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Active accounts by role.</CardDescription>
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
              <p className="text-sm font-medium text-rework">{users.locked} locked out right now</p>
            )}
            <CardLink href={users.locked > 0 ? "/admin/users?status=locked" : "/admin/users"}>
              Manage users
            </CardLink>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Decision thresholds</CardTitle>
            <CardDescription>What the camera decides.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reject</dt>
                <dd className="font-medium">{bands.reject}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rework</dt>
                <dd className="font-medium">{bands.rework}</dd>
              </div>
            </dl>
            <CardLink href="/admin/settings?tab=thresholds">Change thresholds</CardLink>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unknown defect classes</CardTitle>
            <CardDescription>Sent by the camera, not yet a defect type.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-semibold tabular-nums" data-testid="unknown-count">
              {unknown.length}
            </p>
            <p className="text-sm text-muted-foreground">
              {unknown.length === 0
                ? "Every class the camera sends is known."
                : `Their scans go to review: ${unknown
                    .slice(0, 3)
                    .map((u) => u.rawClassKey)
                    .join(", ")}${unknown.length > 3 ? "…" : ""}`}
            </p>
            <CardLink href="/admin/settings?tab=defects">Defect types</CardLink>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Changes and sign-ins in the last 24 hours.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-semibold tabular-nums">
              {auditDay.toLocaleString("en-PH")}
            </p>
            <CardLink href="/admin/audit">Open the audit log</CardLink>
            <CardLink href="/admin/tokens">Camera API tokens</CardLink>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
