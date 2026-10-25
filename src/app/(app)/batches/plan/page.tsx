/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager (Ms Ivy), at the office desk, every few weeks or after a slow stretch.
 * What:  set how often a batch ends (every 1 to 4 hours, or once at the end of the day) and the
 *        pairs per day the line aims for, helped by a suggestion from recent days (D-083, D-099).
 *        The lunch break is the System Admin's (Settings → Lunch break, C-3).
 * Worst: a change that rewrites today's numbers, or a quota read as a target for one person.
 *        Changes apply from tomorrow (a first quota from today); the quota is for the whole line.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { TablePager } from "@/components/features/table-pager";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { productionPlan } from "@/server/services/production.service";
import { QuotaForm, ScheduleForm } from "./plan-forms";

export const metadata: Metadata = { title: "Plan batches and quota" };

const HISTORY_ROWS = 15;

const pageOf = (raw: unknown, count: number) => {
  const n = Number(raw);
  const pages = Math.max(1, Math.ceil(count / HISTORY_ROWS));
  return Number.isInteger(n) && n >= 1 ? Math.min(n, pages) : 1;
};

export default async function ProductionPlanPage({ searchParams }: PageProps<"/batches/plan">) {
  await requirePermission("production:plan");
  await connection();
  const params = (await searchParams) as { sp?: string; qp?: string };
  const plan = await productionPlan();
  const sp = pageOf(params.sp, plan.scheduleHistory.length);
  const qp = pageOf(params.qp, plan.quotaHistory.length);
  const href = (key: "sp" | "qp", page: number) => {
    const next = new URLSearchParams();
    const other = key === "sp" ? qp : sp;
    if (other > 1) next.set(key === "sp" ? "qp" : "sp", String(other));
    if (page > 1) next.set(key, String(page));
    const qs = next.toString();
    return qs ? `/batches/plan?${qs}` : "/batches/plan";
  };
  const pages = (count: number) => Math.max(1, Math.ceil(count / HISTORY_ROWS));

  return (
    <>
      <div>
        <Link
          href="/batches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Batches
        </Link>
      </div>
      <PageHeader
        title="Plan batches and quota"
        description="When each batch ends and the Quality Inspector counts the pairs finished, and how many pairs a day the whole line aims for."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Batches</CardTitle>
            <CardDescription>
              {plan.schedule ? `Today: ${plan.schedule.description}.` : "No schedule yet."}
              {plan.upcomingSchedule &&
                ` From ${formatAttendanceDay(plan.upcomingSchedule.from)}: ${plan.upcomingSchedule.description}.`}{" "}
              Lunch from tomorrow: {plan.tomorrowLunchText}, set by the System Admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {plan.lunchWarning && <Alert tone="info">{plan.lunchWarning}</Alert>}
            <ScheduleForm
              current={plan.schedule}
              tomorrow={plan.tomorrow}
              lunch={
                plan.tomorrowLunch
                  ? {
                      startTime: plan.tomorrowLunch.startTime!,
                      endTime: plan.tomorrowLunch.endTime!,
                    }
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily quota</CardTitle>
            <CardDescription>
              Pairs per day for the whole line that pass inspection. Not a quota for any one person.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuotaForm quota={plan.quota} today={plan.today} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule history</CardTitle>
            <CardDescription>Newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table label="Schedule history" data-testid="schedule-history">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>From</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Set by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.scheduleHistory.slice((sp - 1) * HISTORY_ROWS, sp * HISTORY_ROWS).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatAttendanceDay(s.effectiveFrom)}
                    </TableCell>
                    <TableCell className="whitespace-normal">{s.description}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.setBy}, {formatManilaDateTime(s.setAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePager
              page={sp}
              pageCount={pages(plan.scheduleHistory.length)}
              total={plan.scheduleHistory.length}
              noun={["schedule", "schedules"]}
              href={(p) => href("sp", p)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quota history</CardTitle>
            <CardDescription>Newest first, with what was suggested at the time.</CardDescription>
          </CardHeader>
          <CardContent>
            {plan.quotaHistory.length === 0 ? (
              <p className="text-muted-foreground">No quota has been set yet.</p>
            ) : (
              <Table label="Quota history" data-testid="quota-history">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>From</TableHead>
                    <TableHead numeric>Pairs</TableHead>
                    <TableHead numeric>Suggested</TableHead>
                    <TableHead>Set by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.quotaHistory.slice((qp - 1) * HISTORY_ROWS, qp * HISTORY_ROWS).map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatAttendanceDay(q.effectiveFrom)}
                      </TableCell>
                      <TableCell numeric>{q.pairs}</TableCell>
                      <TableCell numeric>{q.suggestedPairs ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {q.setBy}, {formatManilaDateTime(q.setAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {plan.quotaHistory.length > 0 && (
              <TablePager
                page={qp}
                pageCount={pages(plan.quotaHistory.length)}
                total={plan.quotaHistory.length}
                noun={["quota", "quotas"]}
                href={(p) => href("qp", p)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
