/*
 * Intent brief (ui-craft §1)
 * Who:   the Quality Inspector entering the pairs finished at each check-in (the Floor Manager
 *        covers on a day no QI is present, D-088); the Floor Manager reading the day against the
 *        quota; the Admin viewing. Desktop, through the shift.
 * What:  enter the count that is due, see today against the quota, and see why recent days fell
 *        short (D-083 to D-086). Replaces stage monitoring.
 * Worst: a shortfall read as one person's fault, or a count entered twice. Every figure is for the
 *        whole line, per check-in, day or shoe type (D-008); the only name is who entered a
 *        check-in. A slot takes one entry; a correction needs a reason.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarCog, TriangleAlert } from "lucide-react";
import { ProductionChart } from "@/components/features/charts/production-chart";
import { PageHeader } from "@/components/features/page-header";
import {
  ProductionDaysTable,
  QuotaProgress,
  SlotStateBadge,
} from "@/components/features/production/production-parts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RECENT_DAYS } from "@/lib/production-rules";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { productionToday, recentProductionDays } from "@/server/services/production.service";
import { CheckInDialog } from "./check-in-dialog";

export const metadata: Metadata = { title: "Production" };

export default async function ProductionPage({ searchParams }: PageProps<"/production">) {
  const user = await requirePermission("production:read");
  await connection();
  const { enter } = (await searchParams) as { enter?: string };
  const [today, recent] = await Promise.all([
    productionToday(user),
    recentProductionDays(RECENT_DAYS),
  ]);
  const wf = today.workforce;
  const workforceLine = wf.taken ? `${wf.constructorsPresent} of ${wf.constructorsOnRoster}` : null;
  // The QI home links here with ?enter=next to open the due check-in straight away.
  const openSlot = enter === "next" ? today.next?.slotAt : enter;

  return (
    <>
      <PageHeader
        title="Production"
        description="Pairs finished at each check-in, against the daily quota. Always for the whole line, never per person."
        actions={
          can(user.role, "production:plan") && (
            <Button asChild variant="secondary">
              <Link href="/production/plan">
                <CalendarCog aria-hidden />
                Schedule and quota
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" data-testid="today-check-ins">
          <CardHeader>
            <CardTitle>Today, {today.dayLabel}</CardTitle>
            <CardDescription>
              {today.schedule
                ? `${today.schedule}. Each check-in counts only the pairs finished since the one before.`
                : "No check-in schedule is set. The Floor Manager sets one under Schedule and quota."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!today.workingDay ? (
              <p className="text-muted-foreground">
                Today isn’t a working day on the schedule, so there are no check-ins.
              </p>
            ) : (
              <Table label="Today's check-ins">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Check-in</TableHead>
                    <TableHead>State</TableHead>
                    {today.shoeTypes.map((t) => (
                      <TableHead key={t.id} numeric>
                        {t.name}
                      </TableHead>
                    ))}
                    <TableHead numeric>Constructors present</TableHead>
                    <TableHead>Entered by</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {today.rows.map((r) => (
                    <TableRow key={r.slotAt} aria-label={`${r.time} check-in`}>
                      <TableCell className="font-medium tabular-nums">{r.time}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <SlotStateBadge state={r.state} late={r.checkIn?.enteredLate} />
                          {r.lateBy && <span className="text-sm text-rework">{r.lateBy}</span>}
                        </div>
                      </TableCell>
                      {today.shoeTypes.map((t) => (
                        <TableCell key={t.id} numeric>
                          {r.checkIn ? (
                            (r.checkIn.counts.find((c) => c.shoeTypeId === t.id)?.pairs ?? 0)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell numeric>
                        {r.checkIn ? (
                          <div className="flex flex-col items-end">
                            <span>
                              {r.checkIn.constructorsPresent === null
                                ? "Not taken"
                                : `${r.checkIn.constructorsPresent} of ${r.checkIn.constructorsOnRoster}`}
                            </span>
                            {r.checkIn.attendanceChanged && (
                              <span className="text-xs text-rework">
                                Attendance changed after this check-in
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal">
                        {r.checkIn ? (
                          <div className="flex flex-col gap-0.5 text-sm">
                            <span>
                              {r.checkIn.enteredBy} at {r.checkIn.enteredAtTime}
                            </span>
                            {r.checkIn.correction && (
                              <span className="text-muted-foreground">
                                Corrected by {r.checkIn.correction.by} at {r.checkIn.correction.at}:{" "}
                                {r.checkIn.correction.reason}
                              </span>
                            )}
                            {r.checkIn.notes && (
                              <span className="text-muted-foreground">Note: {r.checkIn.notes}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {today.canEnter &&
                          !r.checkIn &&
                          (r.state === "DUE" || r.state === "LATE") && (
                            <CheckInDialog
                              mode="enter"
                              slot={r}
                              shoeTypes={today.shoeTypes}
                              workforceLine={workforceLine}
                              autoOpen={openSlot === r.slotAt}
                            />
                          )}
                        {today.canEnter && r.checkIn && (
                          <CheckInDialog
                            mode="correct"
                            slot={r}
                            shoeTypes={today.shoeTypes}
                            workforceLine={workforceLine}
                            checkIn={r.checkIn}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!wf.taken && today.workingDay && (
              <p className="flex items-center gap-2 text-sm">
                <TriangleAlert aria-hidden className="size-4 text-rework" />
                Attendance for today hasn’t been taken, so check-ins are saved without a worker
                count.
              </p>
            )}
            {today.covering && today.workingDay && (
              <p className="text-sm" data-testid="covering-note">
                No Quality Inspector is present today, so you can enter the check-ins. They are
                saved under your name and marked in the audit log as covering.
              </p>
            )}
            {today.enterNote && today.workingDay && (
              <p className="text-sm text-muted-foreground" data-testid="enter-note">
                {today.enterNote}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today against the quota</CardTitle>
            <CardDescription>
              {wf.taken
                ? `${wf.constructorsPresent} of ${wf.constructorsOnRoster} Shoe Constructors present.`
                : "Attendance not taken yet today."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <QuotaProgress progress={today.progress} />
            {today.shortfall && (
              <Alert tone="info" data-testid="today-shortfall">
                {today.shortfall}
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent days</CardTitle>
          <CardDescription>
            The last {RECENT_DAYS} working days before today. Pairs per constructor is the line’s
            total pairs divided by the Shoe Constructors present that day, an average for the whole
            line.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {recent.days.length > 0 && (
            <ProductionChart
              days={recent.days.map((d) => ({
                day: d.day,
                pairs: d.pairs,
                quota: d.quota,
                constructorsPresent: d.constructorsPresent,
              }))}
            />
          )}
          <ProductionDaysTable shoeTypes={recent.shoeTypes} days={recent.days} />
        </CardContent>
      </Card>
    </>
  );
}
