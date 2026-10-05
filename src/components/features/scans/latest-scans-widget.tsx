"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Radio, WifiOff } from "lucide-react";
import { VerdictBadge, type Verdict } from "@/components/features/verdict-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManilaTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  sequence: number;
  batchCode: string;
  aiVerdict: Verdict;
  finalVerdict: Verdict | null;
  createdAt: string;
  topDefect: { label: string; confidence: number; unknown: boolean } | null;
};

async function fetchLatest(): Promise<Item[]> {
  const res = await fetch("/api/v1/scans?limit=8", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { data: Item[] }).data;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Live feed from the Preparation camera. Polls every 5 s while the tab is visible (no animation on
 * refresh: this updates constantly). Keeps the last data on errors and says it's stale.
 */
export function LatestScansWidget({ className }: { className?: string }) {
  const { data, isPending, isError, dataUpdatedAt } = useQuery({
    queryKey: ["scans", "latest"],
    queryFn: fetchLatest,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const now = useNow(1_000);
  const ago = dataUpdatedAt ? Math.max(0, Math.round((now - dataUpdatedAt) / 1000)) : null;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Latest scans</CardTitle>
            <CardDescription>Preparation camera, newest first.</CardDescription>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm",
              isError ? "text-reject" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {isError ? (
              <WifiOff aria-hidden className="size-4" />
            ) : (
              <Radio aria-hidden className="size-4" />
            )}
            {isError
              ? "Live feed paused, retrying…"
              : ago === null
                ? "Connecting…"
                : `Updated ${ago}s ago`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {isPending ? (
          // A div, not a list: role="status" would strip a <ul>'s list role and orphan its items.
          <div
            role="status"
            aria-busy="true"
            aria-label="Loading scans"
            className="flex flex-col gap-2"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-muted-foreground">
            No scans yet. Start the simulator or connect a camera on the{" "}
            <Link href="/camera" className="underline underline-offset-4">
              Camera page
            </Link>
            .
          </p>
        ) : (
          <ul className={cn("flex flex-col divide-y", isError && "grayscale")}>
            {data.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/scans/${s.id}`}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2 hover:bg-accent/50"
                >
                  <time
                    dateTime={s.createdAt}
                    className="text-sm text-muted-foreground tabular-nums"
                  >
                    {formatManilaTime(s.createdAt)}
                  </time>
                  {/* The batch and section always show in full; the defect may truncate (audit). */}
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                    <span className="font-mono text-sm whitespace-nowrap">{s.batchCode}</span>{" "}
                    <span className="whitespace-nowrap text-muted-foreground">· #{s.sequence}</span>
                    {s.topDefect && (
                      <span className="min-w-0 truncate text-sm text-muted-foreground">
                        {s.topDefect.label} {Math.round(s.topDefect.confidence * 100)}%
                      </span>
                    )}
                  </span>
                  <VerdictBadge verdict={s.finalVerdict ?? s.aiVerdict} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
