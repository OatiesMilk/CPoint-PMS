"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { isAvailable, keepWeek, MONTH_NAMES, monthWeekOf, weeksOfMonth } from "@/lib/month-weeks";
import { PERIOD_PARAMS, PRESETS, type RangeMode } from "@/lib/report-rules";
import { cn } from "@/lib/utils";

type Props = {
  /** The period on screen: its mode and first and last day. */
  range: { mode: RangeMode; from: string; to: string; preset: string | null };
  /** Manila's today, the last day that can be picked. */
  today: string;
  /** Params that go first in every link (the report's own view). */
  fixed?: Record<string, string>;
  /** Show the four quick links (Today, 7 days, 14 days, 30 days). */
  presets?: boolean;
  /** Rolls: no period means any time, shown as its own choice. */
  anyTime?: boolean;
  /** With `anyTime`: whether a period is applied at all. */
  applied?: boolean;
};

const TABS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "custom", label: "Custom" },
] as const;

/**
 * Day, Week of the month, Month or Custom, for Operations, Quality and Rolls (Phase 35, A-67). The
 * choice lives in the URL, so a link, a CSV and a print show the same period; any change goes back
 * to page 1 and keeps the report's filters and sort. A future date is not offered.
 */
export function PeriodPicker({
  range,
  today,
  fixed = {},
  presets = true,
  anyTime,
  applied = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const mode = anyTime && !applied ? "any" : range.mode === "preset" ? "custom" : range.mode;
  const week = monthWeekOf(range.to);
  const [year, month] = [Number(range.to.slice(0, 4)), Number(range.to.slice(5, 7))];
  const thisYear = Number(today.slice(0, 4));

  function href(changes: Record<string, string>) {
    const next = new URLSearchParams(fixed);
    for (const [k, v] of params)
      if (!(k in fixed) && !(PERIOD_PARAMS as readonly string[]).includes(k) && k !== "page")
        next.set(k, v);
    for (const [k, v] of Object.entries(changes)) next.set(k, v);
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }
  const go = (changes: Record<string, string>) =>
    startTransition(() => router.replace(href(changes), { scroll: false }));

  const tabHref: Record<string, string> = {
    day: href({ period: "day", day: range.to }),
    week: href({
      period: "week",
      year: String(week.year),
      month: String(week.month),
      week: String(week.week),
    }),
    month: href({ period: "month", year: String(year), month: String(month) }),
    custom: href({ period: "custom", from: range.from, to: range.to }),
  };
  const latestMonth = (y: number) => (y < thisYear ? 12 : Number(today.slice(5, 7)));
  const pick = (y: number, m: number, w: number) => {
    const kept = keepWeek(y, m, w, today) ?? keepWeek(y, latestMonth(y), w, today);
    if (kept)
      go({
        period: "week",
        year: String(kept.year),
        month: String(kept.month),
        week: String(kept.week),
      });
  };
  const years = Array.from({ length: 4 }, (_, i) => thisYear - 3 + i);

  const tab = (active: boolean) =>
    cn(
      "rounded-sm px-3 py-1.5 text-sm font-medium",
      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div
      className="flex flex-col gap-3 print:hidden"
      aria-busy={pending}
      data-testid="period-picker"
    >
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Period" className="flex gap-1 rounded-md border p-1">
          {anyTime && (
            <Link
              href={href({})}
              aria-current={mode === "any" ? "page" : undefined}
              className={tab(mode === "any")}
            >
              Any time
            </Link>
          )}
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={tabHref[t.id]}
              aria-current={mode === t.id ? "page" : undefined}
              className={tab(mode === t.id)}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {presets && (
          <nav aria-label="Report range" className="flex gap-1 rounded-md border p-1">
            {PRESETS.map((p) => (
              <Link
                key={p.id}
                href={href({ preset: p.id })}
                aria-current={range.preset === p.id && mode !== "any" ? "page" : undefined}
                className={tab(range.preset === p.id && mode !== "any")}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {mode === "day" && (
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <Label htmlFor="period-day">Day</Label>
          <input
            id="period-day"
            type="date"
            value={range.to}
            max={today}
            onChange={(e) => e.target.value && go({ period: "day", day: e.target.value })}
            className="h-9 rounded-md border border-input bg-card px-3"
          />
        </div>
      )}

      {(mode === "week" || mode === "month") && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-full flex-col gap-1.5 sm:w-32">
            <Label htmlFor="period-year">Year</Label>
            <Select
              id="period-year"
              value={String(year)}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (mode === "week") pick(y, month, week.week);
                else
                  go({
                    period: "month",
                    year: String(y),
                    month: String(Math.min(month, latestMonth(y))),
                  });
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-40">
            <Label htmlFor="period-month">Month</Label>
            <Select
              id="period-month"
              value={String(month)}
              onChange={(e) => {
                const m = Number(e.target.value);
                if (mode === "week") pick(year, m, week.week);
                else go({ period: "month", year: String(year), month: String(m) });
              }}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1} disabled={i + 1 > latestMonth(year)}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          {mode === "week" && (
            <div className="flex w-full flex-col gap-1.5 sm:w-48">
              <Label htmlFor="period-week">Week</Label>
              <Select
                id="period-week"
                value={String(week.week)}
                onChange={(e) =>
                  go({
                    period: "week",
                    year: String(year),
                    month: String(month),
                    week: e.target.value,
                  })
                }
              >
                {weeksOfMonth(year, month).map((w) => (
                  <option key={w.week} value={w.week} disabled={!isAvailable(w, today)}>
                    {w.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}

      {mode === "custom" && (
        <form
          aria-label="Custom range"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            go({ period: "custom", from: String(data.get("from")), to: String(data.get("to")) });
          }}
        >
          {(["from", "to"] as const).map((name) => (
            <label key={name} className="flex flex-col gap-1.5 text-sm">
              {name === "from" ? "From" : "To"}
              <input
                type="date"
                name={name}
                required
                defaultValue={range[name]}
                max={today}
                key={`${name}-${range[name]}`}
                className="h-9 rounded-md border border-input bg-card px-3"
              />
            </label>
          ))}
          <Button type="submit" variant="secondary">
            Show
          </Button>
          <p className="basis-full text-sm text-muted-foreground">Up to 366 days.</p>
        </form>
      )}
    </div>
  );
}
