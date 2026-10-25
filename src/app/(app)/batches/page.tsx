/*
 * Intent brief (ui-craft §1)
 * Who:   the Quality Inspector on their phone by the line, finishing each batch with the pairs
 *        finished and failed (the Floor Manager covers on a day no QI is present, D-088); the
 *        Floor Manager reading the day against the quota at a desk (Batches is the QI's home, D-100).
 * What:  see today's batches (C-2, C-4) with where each stands, finish the one that is due, see the
 *        passed pairs against the quota (C-41) and, for the Floor Manager, why recent days fell
 *        short. Replaces Production (Phase 23).
 * Worst: a batch finished twice or missed, or a shortfall read as one person's fault. Every figure
 *        is for the whole line, per batch or day (D-008); the only name is who finished a batch.
 *        One finish per batch; a correction needs a reason.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarCog, Coffee, TriangleAlert } from "lucide-react";
import { ProductionChart } from "@/components/features/charts/production-chart";
import { PageHeader } from "@/components/features/page-header";
import {
  BatchStateBadge,
  ProductionDaysTable,
  QuotaProgress,
} from "@/components/features/production/production-parts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RECENT_DAYS } from "@/lib/production-rules";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { productionToday, recentProductionDays } from "@/server/services/production.service";
import { FinishBatchDialog } from "./finish-batch-dialog";

export const metadata: Metadata = { title: "Batches" };

const n = (v: number) => v.toLocaleString("en-PH");

export default async function BatchesPage({ searchParams }: PageProps<"/batches">) {
  const user = await requirePermission("production:read");
  await connection();
  const { finish } = (await searchParams) as { finish?: string };
  // The Quality Inspector sees today only (Dylan 2026-10-24); the Floor Manager also Recent days.
  const showRecent = user.role !== "QUALITY_INSPECTOR";
  const [today, recent] = await Promise.all([
    productionToday(user),
    showRecent ? recentProductionDays(RECENT_DAYS) : Promise.resolve(null),
  ]);
  const wf = today.workforce;
  const workforceLine = wf.taken ? `${wf.constructorsPresent} of ${wf.constructorsOnRoster}` : null;
  // The first batch that can be finished now is the page's one primary action (D-096).
  const primary = today.canEnter ? today.rows.find((r) => r.canFinishNow) : undefined;
  // A notice or the QI home links here with ?finish=next (or a batch's end) to open it at once.
  const openSlot = finish === "next" ? primary?.slotAt : finish;

  return (
    <div className={cn("flex flex-col gap-8", primary && "max-sm:pb-28")}>
      <PageHeader
        title="Batches"
        description="Each batch runs between two check-ins. Finish it with the pairs finished and how many failed inspection. Always for the whole line, never per person."
        actions={
          can(user.role, "production:plan") && (
            <Button asChild variant="secondary">
              <Link href="/batches/plan">
                <CalendarCog aria-hidden />
                Plan batches and quota
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section aria-labelledby="today-batches" className="flex flex-col gap-3 xl:col-span-2">
          <div className="flex flex-col gap-1">
            <h2 id="today-batches" className="text-lg font-semibold">
              Today, {today.dayLabel}
            </h2>
            <p className="text-muted-foreground">
              {today.schedule
                ? `${today.schedule}. Lunch: ${today.lunch}.`
                : "No batch schedule is set. The Floor Manager sets one under Plan batches and quota."}
            </p>
          </div>
          {!today.workingDay ? (
            <p className="rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground">
              Today isn’t a working day on the schedule, so there are no batches.
            </p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="today-batches">
              {today.rows.map((r) => {
                const c = r.checkIn;
                const isPrimary = primary?.slotAt === r.slotAt;
                return (
                  <li key={r.slotAt}>
                    <Card aria-label={`Batch ${r.number}`} data-testid={`batch-${r.number}`}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <p className="text-xl font-semibold">
                            Batch {r.number}
                            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                              {r.startTime}–{r.time}
                            </span>
                          </p>
                          {r.lunch && (
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Coffee aria-hidden className="size-4" />
                              Lunch {r.lunch.startTime}–{r.lunch.endTime}, not counted
                            </p>
                          )}
                          <BatchStateBadge
                            state={r.state}
                            late={c?.enteredLate}
                            corrected={!!c?.correction}
                            paused={r.pausedForLunch}
                          />
                          {r.lateBy && <p className="text-sm text-caution">{r.lateBy}</p>}
                          {c ? (
                            <div className="flex flex-col gap-0.5">
                              <p className="text-lg tabular-nums">
                                {n(c.pairs)} pairs, {n(c.failedPairs)} failed inspection
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Finished {c.enteredAtTime} by {c.enteredBy}
                                {c.constructorsPresent !== null &&
                                  ` · ${c.constructorsPresent} of ${c.constructorsOnRoster} constructors present`}
                              </p>
                              {c.attendanceChanged && (
                                <p className="text-xs text-caution">
                                  Attendance changed after this batch was finished
                                </p>
                              )}
                              {c.correction && (
                                <p className="text-sm text-muted-foreground">
                                  Corrected by {c.correction.by} at {c.correction.at}:{" "}
                                  {c.correction.reason}
                                </p>
                              )}
                              {c.notes && (
                                <p className="text-sm text-muted-foreground">Note: {c.notes}</p>
                              )}
                            </div>
                          ) : (
                            today.canEnter &&
                            !r.canFinishNow &&
                            r.state !== "MISSED" && (
                              <p className="text-sm text-muted-foreground">
                                Can be finished from {r.finishOpensAt}.
                              </p>
                            )
                          )}
                        </div>
                        <div className="shrink-0">
                          {today.canEnter && !c && r.canFinishNow && (
                            <div
                              className={cn(
                                isPrimary &&
                                  "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-20 max-sm:border-t max-sm:bg-background max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
                              )}
                            >
                              {isPrimary && (
                                <p className="mb-2 text-xl font-semibold sm:hidden">
                                  Batch {r.number} · {r.startTime}–{r.time}
                                </p>
                              )}
                              <FinishBatchDialog
                                mode="finish"
                                batch={r}
                                workforceLine={workforceLine}
                                autoOpen={openSlot === r.slotAt}
                                primary={isPrimary}
                              />
                            </div>
                          )}
                          {today.canEnter && c && (
                            <FinishBatchDialog
                              mode="correct"
                              batch={r}
                              workforceLine={workforceLine}
                              checkIn={c}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          {!wf.taken && today.workingDay && (
            <p className="flex items-center gap-2 text-sm">
              <TriangleAlert aria-hidden className="size-4 shrink-0 text-caution" />
              Attendance for today hasn’t been taken, so batches are saved without a worker count.
            </p>
          )}
          {today.covering && today.workingDay && (
            <p className="text-sm" data-testid="covering-note">
              No Quality Inspector is present today, so you can finish the batches. They are saved
              under your name and marked in the audit log as covering.
            </p>
          )}
          {today.enterNote && today.workingDay && (
            <p className="text-sm text-muted-foreground" data-testid="enter-note">
              {today.enterNote}
            </p>
          )}
        </section>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Today against the quota</CardTitle>
            <CardDescription>
              Only the pairs that passed inspection count.{" "}
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

      {recent && (
        <Card>
          <CardHeader>
            <CardTitle>Recent days</CardTitle>
            <CardDescription>
              The last {RECENT_DAYS} working days before today. Pairs per constructor is the line’s
              pairs finished divided by the Shoe Constructors present that day, an average for the
              whole line.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {recent.days.length > 0 && (
              <ProductionChart
                days={recent.days.map((d) => ({
                  day: d.day,
                  pairs: d.passed,
                  quota: d.quota,
                  constructorsPresent: d.constructorsPresent,
                }))}
              />
            )}
            <ProductionDaysTable days={recent.days} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
