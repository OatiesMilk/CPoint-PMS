"use client";

import { appNow, appNowMs } from "@/lib/clock";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing, CalendarCog, ClipboardPen, Hourglass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { noticesFor, type Notice } from "@/lib/production-rules";
import { cn } from "@/lib/utils";

/*
 * On-screen batch notices (A-9, C-6, C-31, D-098) for the Quality Inspector, and the Floor Manager
 * on a day no QI is present: at 10 minutes before a batch's end and at its end, on whatever page is
 * open. Worked out in the browser from today's batches (refetched every 60 s and when the tab comes
 * back) and the clock. No browser notification, push or sound; nothing reaches a closed app.
 */

type TodayRow = {
  number: number;
  slotAt: string;
  time: string;
  checkIn: unknown | null;
  /** Phase 33: a voided batch gets no notice. */
  queue?: { status: string } | null;
};
type Today = { rows: TodayRow[]; canEnter: boolean };

const REFETCH_MS = 60_000;

function useToday() {
  return useQuery({
    queryKey: ["production-today"],
    queryFn: async (): Promise<Today> => {
      const res = await fetch("/api/v1/production/today", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()).data as Today;
    },
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

/** The notices now, re-worked out at the next notice time (and every 30 s as a backstop). */
function useNotices(): Notice[] {
  const { data } = useToday();
  const [now, setNow] = useState(() => appNow());
  const result = useMemo(() => {
    if (!data?.canEnter) return { current: [] as Notice[], nextAt: null as Date | null };
    const batches = data.rows.map((r) => ({
      number: r.number,
      at: new Date(r.slotAt),
      time: r.time,
    }));
    const finished = new Set(
      data.rows.filter((r) => r.checkIn || r.queue?.status === "VOID").map((r) => r.slotAt),
    );
    return noticesFor(batches, finished, now);
  }, [data, now]);

  useEffect(() => {
    const wait = result.nextAt
      ? Math.max(500, Math.min(30_000, result.nextAt.getTime() - appNowMs() + 250))
      : 30_000;
    const timer = setTimeout(() => setNow(appNow()), wait);
    const onVisible = () => document.visibilityState === "visible" && setNow(appNow());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [result.nextAt, now]);

  return result.current;
}

const finishHref = (n: Notice) => `/batches?finish=${encodeURIComponent(n.slotAt)}`;

/** The tab title starts with "(1)" while a batch is due or late. */
function useTabCount(count: number) {
  const pathname = usePathname();
  useEffect(() => {
    // Any "(n) " prefixes, however many, with or without the space (the title getter trims it).
    const strip = (t: string) => t.replace(/^(\(\d+\)\s*)+/, "");
    // Next.js sets the title on navigation, sometimes with a new <title> element (Queue → Today
    // keeps the pathname), so each <title> in the head gets the count, never twice, and an
    // empty one stays empty (Phase 33 runs 3 and 4).
    const titles = () => Array.from(document.head.querySelectorAll("title"));
    const apply = () => {
      for (const el of titles()) {
        const text = el.textContent ?? "";
        const base = strip(text);
        const next = count > 0 && base ? `(${count}) ${base}` : base;
        if (text !== next) el.textContent = next;
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      for (const el of titles()) el.textContent = strip(el.textContent ?? "");
    };
  }, [count, pathname]);
}

/**
 * The banner on every page: the most urgent notice, with Finish batch when it is due. "Not now"
 * hides that one notice until the next one comes (it stays in the bell).
 */
export function BatchNoticeBanner() {
  const notices = useNotices();
  const [hidden, setHidden] = useState<string[]>([]);
  useTabCount(notices.filter((n) => n.kind === "DUE").length);
  const shown = [...notices]
    .sort((a, b) => (a.kind === b.kind ? a.number - b.number : a.kind === "DUE" ? -1 : 1))
    .find((n) => !hidden.includes(`${n.kind}:${n.slotAt}`));
  if (!shown) return null;
  const due = shown.kind === "DUE";
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="batch-notice"
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 shadow-1 sm:flex-row sm:items-center sm:gap-3 sm:p-4",
        due ? "border-info bg-info-soft" : "bg-muted/60",
      )}
    >
      <p className="flex flex-1 items-start gap-2 text-base font-medium sm:text-lg">
        {due ? (
          <BellRing aria-hidden className="mt-0.5 size-5 shrink-0 text-info sm:mt-1" />
        ) : (
          <Hourglass aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground sm:mt-1" />
        )}
        {shown.message}
      </p>
      <div className="flex items-center gap-2">
        {due && (
          <Button asChild size="lg" className="h-11 flex-1 sm:flex-none">
            <Link href={finishHref(shown)}>Finish {shown.code}</Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="lg"
          className="h-11"
          onClick={() => setHidden((h) => [...h, `${shown.kind}:${shown.slotAt}`])}
        >
          <X aria-hidden />
          Not now
        </Button>
      </div>
    </div>
  );
}

/**
 * The bell beside the logo: lists the batches due or late, each with Finish batch, and for the
 * Floor Manager on a reminder day the stock update (Phase 29, C-32) until one is saved.
 */
export function BatchBell({
  compact = false,
  stockDue = false,
  planDue = false,
}: {
  compact?: boolean;
  stockDue?: boolean;
  planDue?: boolean;
}) {
  const { data } = useToday();
  const due = useNotices().filter((n) => n.kind === "DUE");
  // Only for whoever finishes today's batches: the QI, or the FM covering (D-088); and the FM
  // when a stock update is due or today has no plan (A-37).
  const batches = Boolean(data?.canEnter);
  if (!batches && !stockDue && !planDue) return null;
  const count = due.length + (stockDue ? 1 : 0) + (planDue ? 1 : 0);
  const batchText = `${due.length} batch${due.length === 1 ? "" : "es"} due`;
  const others = [
    due.length > 0 ? batchText : null,
    planDue ? "today has no plan" : null,
    stockDue ? "stock update due" : null,
  ].filter(Boolean);
  const label =
    stockDue || planDue
      ? `Notices: ${others.join(", ")}`
      : due.length === 0
        ? "Batch notices: none due"
        : `Batch notices: ${batchText}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        data-testid="batch-bell"
        className={cn(
          "relative flex items-center justify-center rounded-md hover:bg-accent",
          compact ? "size-11" : "size-8",
        )}
      >
        {count > 0 ? (
          <BellRing aria-hidden className="size-5 text-info" />
        ) : (
          <Bell aria-hidden className="size-5" />
        )}
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs leading-none font-semibold text-primary-foreground"
          >
            {count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[calc(100vw-1rem)]">
        {planDue && (
          <>
            <DropdownMenuLabel>Plan</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/batches/plan?day=today" data-testid="plan-today-notice">
                <CalendarCog aria-hidden />
                Today has no plan yet. Plan today.
              </Link>
            </DropdownMenuItem>
            {(stockDue || batches) && <DropdownMenuSeparator />}
          </>
        )}
        {stockDue && (
          <>
            <DropdownMenuLabel>Stock</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/inventory/update" data-testid="stock-update-notice">
                <ClipboardPen aria-hidden />
                Stock update today. Update stock.
              </Link>
            </DropdownMenuItem>
          </>
        )}
        {batches && (
          <>
            {stockDue && <DropdownMenuSeparator />}
            <DropdownMenuLabel>Batches to finish</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {due.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No batch is due. You’ll see a notice 10 minutes before each batch ends.
              </p>
            ) : (
              due.map((n) => (
                <DropdownMenuItem key={n.slotAt} asChild>
                  <Link href={finishHref(n)}>
                    <Hourglass aria-hidden />
                    {n.code} is due. Finish it now.
                  </Link>
                </DropdownMenuItem>
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The Floor Manager's start-of-day notice (A-37, D-114) on every page but the Overview: on a
 * weekday with no plan, from 00:00 until today is planned or marked Non-working / Holiday. Worked
 * out by the server on each page load; saving the plan clears it. The Overview's own Plan today
 * row says the same thing, so the banner stays off it (D-131, A-97).
 */
export function PlanNoticeBanner({ day }: { day: string }) {
  const pathname = usePathname();
  if (pathname === "/floor-manager") return null;
  return (
    <div
      role="status"
      data-testid="plan-notice"
      className="flex flex-col gap-2 rounded-lg border border-info bg-info-soft p-3 shadow-1 sm:flex-row sm:items-center sm:gap-3 sm:p-4"
    >
      <p className="flex flex-1 items-start gap-2 text-base font-medium sm:text-lg">
        <BellRing aria-hidden className="mt-0.5 size-5 shrink-0 text-info sm:mt-1" />
        Today has no plan yet, so there are no batches. Plan today.
      </p>
      <Button asChild size="lg" className="h-11">
        <Link href={`/batches/plan?day=${day}`}>
          <CalendarCog aria-hidden />
          Plan today
        </Link>
      </Button>
    </div>
  );
}
