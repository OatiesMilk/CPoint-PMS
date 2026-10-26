"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Play, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatArea } from "@/lib/roll-rules";
import type { OpenRollView } from "./roll-bar";

/** A roll in stock, not scanned yet, as GET /api/v1/rolls/ready sends it (Phase 30A). */
export type ReadyRollView = {
  id: string;
  code: string;
  tagCode: string | null;
  supplier: string | null;
  item: string | null;
  areaSqFt: number | null;
};

type ApiError = { error?: { message?: string } };

/** The rolls waiting to be scanned, or null when offline (the list on screen stays). */
async function fetchReady(): Promise<ReadyRollView[] | null> {
  try {
    const res = await fetch("/api/v1/rolls/ready", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { data: ReadyRollView[] }).data;
  } catch {
    return null;
  }
}

/** "Black cowhide · Marikina Leather Trading · 24.5 sq ft · tag 88-14" */
export function readyLine(r: ReadyRollView): string {
  return [r.item, r.supplier, formatArea(r.areaSqFt), r.tagCode ? `tag ${r.tagCode}` : null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Scan a roll (Phase 30A, D-104): the Floor Manager adds each leather roll in Inventory with its
 * area; here the constructor picks the one on the table. Nothing to type; a Find box narrows a long
 * list by code, tag, item or supplier. The list is read again when it opens, so a roll someone else
 * just picked doesn't show.
 */
export function PickRollForm({
  initialReady,
  onStarted,
  onCancel,
}: {
  initialReady: ReadyRollView[];
  onStarted: (roll: OpenRollView) => void;
  /** Shown when another roll is already being scanned, to go back without picking one. */
  onCancel?: () => void;
}) {
  const [ready, setReady] = useState<ReadyRollView[]>(initialReady);
  const [find, setFind] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await fetchReady();
    if (list) setReady(list);
  }, []);

  // Read the list again when the form opens: someone may have just picked a roll.
  useEffect(() => {
    let live = true;
    void fetchReady().then((list) => {
      if (live && list) setReady(list);
    });
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return ready;
    return ready.filter((r) => `${r.code} ${readyLine(r)}`.toLowerCase().includes(q));
  }, [ready, find]);

  async function pick(roll: ReadyRollView) {
    setBusyId(roll.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/rolls/${roll.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as ApiError & { data?: OpenRollView };
      if (res.ok && body.data) return onStarted(body.data);
      setError(body.error?.message ?? `${roll.code} couldn’t be picked. Try again.`);
      void reload();
    } catch {
      setError("The server didn’t answer. Check the Wi-Fi, then try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {ready.length === 0 ? (
        <Alert tone="info" data-testid="no-ready-rolls">
          No rolls are waiting to be scanned. Ask the Floor Manager to add them in Inventory.
        </Alert>
      ) : (
        <>
          {ready.length > 5 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pick-find">Find a roll</Label>
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="pick-find"
                  type="search"
                  value={find}
                  autoComplete="off"
                  placeholder="Code, tag, item or supplier"
                  className="h-11 pl-9"
                  onChange={(e) => setFind(e.target.value)}
                />
              </div>
            </div>
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roll matches “{find.trim()}”. Check the code on the roll’s label.
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-md border" aria-label="Rolls to scan">
              {shown.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex min-w-0 flex-1 basis-48 flex-col">
                    <span className="text-lg font-semibold tabular-nums">{r.code}</span>
                    <span className="text-sm text-muted-foreground">{readyLine(r)}</span>
                  </div>
                  <Button
                    size="lg"
                    className="max-sm:w-full"
                    disabled={busyId !== null}
                    aria-label={`Scan ${r.code}`}
                    onClick={() => void pick(r)}
                  >
                    {busyId === r.id ? (
                      <LoaderCircle aria-hidden className="animate-spin" />
                    ) : (
                      <Play aria-hidden />
                    )}
                    Scan this roll
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {onCancel && (
        <Button type="button" size="lg" variant="ghost" className="self-start" onClick={onCancel}>
          Back to capturing
        </Button>
      )}
    </div>
  );
}
