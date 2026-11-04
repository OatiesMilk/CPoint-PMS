/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager (Ms Ivy), at the office desk, every morning and ahead of time.
 * What:  plan each working day on a month calendar (D-114): rolls to be used (an estimate), the
 *        quota of passed pairs for the whole line, the check-in interval (every 4 hours or once at
 *        the end of the day, D-115) and the shift; or mark a weekday Non-working / Holiday. Past
 *        days show what was planned against the rolls scanned.
 * Worst: a working day left unplanned (no batches, so nothing is counted), a plan changed after
 *        its first batch was finished, or a quota read as a target for one person. Weekends and
 *        past days can't be planned; today locks once a batch is finished (A-36).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import { manilaToday } from "@/lib/format";
import { isMonth, monthOf } from "@/lib/production-rules";
import { requirePermission } from "@/server/policies/guard";
import { planMonth } from "@/server/services/production.service";
import { planDaySchema } from "@/server/validators/production.validator";
import { PlanCalendar } from "./plan-calendar";

export const metadata: Metadata = { title: "Plan days" };

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const monthLabel = (month: string) => MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));
const monthHref = (month: string) => `/batches/plan?month=${month}`;

export default async function PlanDaysPage({ searchParams }: PageProps<"/batches/plan">) {
  await requirePermission("production:plan");
  await connection();
  const params = (await searchParams) as { month?: string; day?: string };
  const today = manilaToday();
  // ?day= (the start-of-day notice links to today) opens that day's dialog in its month.
  const asked = params.day === "today" ? today : params.day;
  const day = asked && planDaySchema.safeParse(asked).success ? asked : null;
  const month = day
    ? monthOf(day)
    : params.month && isMonth(params.month)
      ? params.month
      : monthOf(today);
  const data = await planMonth(month);

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
        title="Plan days"
        description="Click a weekday to plan it: rolls to be used, the quota and when the Quality Inspector counts the pairs. A day without a plan has no batches."
      />

      <section aria-labelledby="plan-month" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plan-month" className="text-xl font-semibold">
            {monthLabel(month)}
          </h2>
          <nav aria-label="Months" className="flex flex-wrap items-center gap-2">
            {month !== monthOf(today) && (
              <Button asChild variant="ghost" size="sm">
                <Link href={monthHref(monthOf(today))}>This month</Link>
              </Button>
            )}
            <Button asChild variant="secondary" size="sm">
              <Link href={monthHref(data.prevMonth)}>
                <ChevronLeft aria-hidden />
                {monthLabel(data.prevMonth)}
              </Link>
            </Button>
            {data.nextMonth ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={monthHref(data.nextMonth)}>
                  {monthLabel(data.nextMonth)}
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled
                title="Days can be planned up to three months ahead."
              >
                Next month
                <ChevronRight aria-hidden />
              </Button>
            )}
          </nav>
        </div>
        <PlanCalendar data={data} openDay={day} />
        <p className="text-sm text-muted-foreground">
          Saturdays, Sundays and past days can’t be planned. Today’s plan can change until its first
          batch is finished. Rolls to be used is an estimate: Shoe Constructors may start more, and
          past days show the rolls scanned. The lunch break is set by the System Admin.
        </p>
      </section>
    </>
  );
}
