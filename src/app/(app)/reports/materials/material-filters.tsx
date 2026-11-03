"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { isAvailable, keepWeek, MONTH_NAMES, weeksOfMonth } from "@/lib/month-weeks";

type Props = {
  year: number;
  month: number;
  week: number;
  years: number[];
  today: string;
};

/**
 * Year, Month, Week and Find for Reports → Materials (D-109). The choice lives in the URL so it
 * survives a reload and can be shared; any change goes back to page 1. A month or week that hasn't
 * started yet can't be picked. When the month or year changes, the same week number stays if that
 * month has it, otherwise its last week that has started.
 */
export function MaterialFilters({ year, month, week, years, today }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(debounce.current), []);

  function go(changes: Record<string, string | number | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    next.delete("page");
    const query = next.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    );
  }

  /** The last month of a year that has started. */
  const latestMonth = (y: number) =>
    y < Number(today.slice(0, 4)) ? 12 : Number(today.slice(5, 7));

  /** A new year or month: keep the week number when it exists there, else that month's last. */
  function pick(nextYear: number, nextMonth: number) {
    const w =
      keepWeek(nextYear, nextMonth, week, today) ??
      // A month that hasn't started: fall back to the latest month of that year that has.
      keepWeek(nextYear, latestMonth(nextYear), week, today);
    if (!w) return;
    go({ year: w.year, month: w.month, week: w.week });
  }

  const weeks = weeksOfMonth(year, month);

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending}>
      <div className="flex w-full flex-col gap-1.5 sm:w-32">
        <Label htmlFor="materials-year">Year</Label>
        <Select
          id="materials-year"
          value={String(year)}
          onChange={(e) => pick(Number(e.target.value), month)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-40">
        <Label htmlFor="materials-month">Month</Label>
        <Select
          id="materials-month"
          value={String(month)}
          onChange={(e) => pick(year, Number(e.target.value))}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1} disabled={i + 1 > latestMonth(year)}>
              {name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-48">
        <Label htmlFor="materials-week">Week</Label>
        <Select
          id="materials-week"
          value={String(week)}
          onChange={(e) => go({ year, month, week: Number(e.target.value) })}
        >
          {weeks.map((w) => (
            <option key={w.week} value={w.week} disabled={!isAvailable(w, today)}>
              {w.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-64">
        <Label htmlFor="materials-q">Find material</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="materials-q"
            type="search"
            className="pr-10 pl-9"
            placeholder="Name or item code"
            value={q}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              clearTimeout(debounce.current);
              debounce.current = setTimeout(() => go({ q: value.trim() }), 300);
            }}
          />
          {q !== "" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
              aria-label="Clear the search"
              onClick={() => {
                clearTimeout(debounce.current);
                setQ("");
                go({ q: null });
              }}
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
