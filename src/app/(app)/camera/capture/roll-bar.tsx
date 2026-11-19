"use client";

import { appNow } from "@/lib/clock";
import { useEffect, useState } from "react";
import { CircleCheck, LoaderCircle, Plus, Timer, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatManilaWeekdayDate, manilaToday } from "@/lib/format";
import type { BreakRule } from "@/lib/production-rules";
import { finishedLine, formatArea, openSinceLine, type FinishData } from "@/lib/roll-rules";
import { locationText } from "@/lib/location-rules";
import { formatScanningTime, inLunch, lunchFromMap, scanningMs } from "@/lib/roll-timer";
import type { RollScale } from "@/lib/scale-marker";

/** An open roll as GET /api/v1/rolls/open sends it. */
export type OpenRollView = {
  id: string;
  code: string;
  tagCode: string | null;
  supplier: string | null;
  /** The leather item's name, for a roll from Inventory (Phase 30A). */
  item: string | null;
  areaSqFt: number | null;
  shots: number;
  startedAt: string;
  mine: boolean;
  /** Added in Inventory: Put back returns it there. A roll from before Phase 30A is cancelled. */
  fromInventory: boolean;
  /** The scale its first shot's marker card set (D-121), or null before one. */
  scale: RollScale | null;
  /** Each day's lunch break since it started, so the timer leaves lunch out (D-121). */
  lunches: Record<string, BreakRule | null>;
  /** Where it was taken from when picked, to prefill Put back (Phase 32). */
  takenFromId?: string | null;
};

type LocationOption = { id: string; code: string; name: string | null; kind: string };

/** The active storage locations (Phase 32), read when a dialog needs them; [] when offline. */
async function fetchLocations(): Promise<LocationOption[]> {
  try {
    const res = await fetch("/api/v1/locations", { cache: "no-store" });
    if (!res.ok) return [];
    return ((await res.json()) as { data: LocationOption[] }).data;
  } catch {
    return [];
  }
}

/**
 * The scanning timer (D-121): working time since Start scanning, ticking every second; it stops
 * at Finish roll, and reads "Paused for lunch" during the lunch break, which doesn't count.
 */
export function ScanningTimer({ roll }: { roll: OpenRollView }) {
  // Set after the page loads, so the server's render and the browser's agree.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(appNow());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const lunchOn = lunchFromMap(roll.lunches);
  // "--:--" until the clock starts, never a misleading 00:00 (QA run 1, S5).
  const shown = now
    ? formatScanningTime(scanningMs(new Date(roll.startedAt), now, lunchOn))
    : "--:--";
  const paused = now ? inLunch(now, lunchOn) : false;
  return (
    <p className="flex items-center gap-2 text-base" data-testid="scanning-timer">
      <Timer aria-hidden className="size-4 text-muted-foreground" />
      <span>
        Scanning time <span className="font-semibold tabular-nums">{shown}</span>
        {paused && <span className="text-muted-foreground"> · Paused for lunch</span>}
      </span>
    </p>
  );
}

const shotsText = (n: number) => `${n} ${n === 1 ? "shot" : "shots"}`;

/** "Roll LR-MLT-001 · Black cowhide · 24.5 sq ft · 6 shots" */
export function rollLine(roll: OpenRollView): string {
  return [
    `Roll ${roll.code}`,
    roll.item ?? roll.supplier,
    roll.areaSqFt !== null ? formatArea(roll.areaSqFt) : null,
    shotsText(roll.shots),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Open since Tue, 22 Oct. Finish it or keep capturing." for a roll from an earlier day. */
export function openSince(roll: OpenRollView, now = appNow()): string | null {
  return openSinceLine(
    manilaToday(new Date(roll.startedAt)),
    manilaToday(now),
    formatManilaWeekdayDate(roll.startedAt),
  );
}

type ApiError = { error?: { code?: string; message?: string } };

/**
 * Which roll the next shot goes to (Phase 26): the Roll dropdown (every open roll), the chosen roll
 * in large text, Start another roll, Finish roll (it then leaves stock, Phase 30E) and, for an
 * empty roll, Put roll back (Phase 30A; a roll from before then is cancelled instead).
 */
export function RollBar({
  rolls,
  chosen,
  onChoose,
  onStartAnother,
  onClosed,
  disabled,
}: {
  rolls: OpenRollView[];
  chosen: OpenRollView | null;
  onChoose: (id: string) => void;
  onStartAnother: () => void;
  /** The roll was finished or cancelled: take it out of the list. */
  onClosed: (id: string, message: string) => void;
  disabled: boolean;
}) {
  const [dialog, setDialog] = useState<"finish" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Phase 32: where an empty roll goes back to, and where a returned roll is set aside.
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [putBackTo, setPutBackTo] = useState("");
  const [aside, setAside] = useState<{ id: string; code: string; message: string } | null>(null);
  const [asideTo, setAsideTo] = useState("");
  const [asideError, setAsideError] = useState<string | null>(null);

  async function openPutBack() {
    setDialog("cancel");
    if (!chosen?.fromInventory) return;
    const list = await fetchLocations();
    setLocations(list);
    setPutBackTo(list.some((l) => l.id === chosen.takenFromId) ? (chosen.takenFromId ?? "") : "");
  }

  async function setAsideNow() {
    if (!aside) return;
    if (!asideTo) {
      setAsideError("Choose where you put it, or press Skip.");
      return;
    }
    setBusy(true);
    setAsideError(null);
    try {
      const res = await fetch(`/api/v1/rolls/${aside.id}/set-aside`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: asideTo }),
      });
      const body = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        setAsideError(body.error?.message ?? "That didn’t work. Try again, or press Skip.");
        return;
      }
      const place = locations.find((l) => l.id === asideTo);
      onClosed(aside.id, `${aside.message} It is set aside in ${place?.code ?? "its place"}.`);
      setAside(null);
    } catch {
      setAsideError("The server didn’t answer. Check the Wi-Fi, then try again, or press Skip.");
    } finally {
      setBusy(false);
    }
  }

  async function close(kind: "finish" | "cancel") {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/rolls/${chosen.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "cancel" && chosen.fromInventory && putBackTo ? { locationId: putBackTo } : {},
        ),
      });
      const body = (await res.json().catch(() => ({}))) as ApiError & { data?: FinishData };
      setDialog(null);
      if (res.ok && kind === "finish" && body.data?.marked && chosen.fromInventory) {
        // Returned to supplier (D-116): ask where it was set aside for the supplier (A-77).
        const list = await fetchLocations();
        setLocations(list);
        if (list.length > 0) {
          setAsideTo(list.find((l) => l.kind === "AREA")?.id ?? "");
          setAsideError(null);
          setAside({ id: chosen.id, code: chosen.code, message: finishedLine(chosen, body.data) });
          return;
        }
      }
      if (res.ok) {
        const place = locations.find((l) => l.id === putBackTo);
        onClosed(
          chosen.id,
          kind === "finish"
            ? finishedLine(chosen, body.data)
            : chosen.fromInventory
              ? `${chosen.code} is back with the rolls waiting to be scanned${place ? `, in ${place.code}` : ""}.`
              : `${chosen.code} is cancelled.`,
        );
      } else {
        setError(body.error?.message ?? "That didn’t work. Refresh the page and try again.");
      }
    } catch {
      setDialog(null);
      setError("The server didn’t answer. Check the Wi-Fi, then try again.");
    } finally {
      setBusy(false);
    }
  }

  const since = chosen ? openSince(chosen) : null;
  const spinner = busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null;

  return (
    <section
      aria-label="Roll"
      className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 shadow-1 sm:gap-3 sm:p-4"
    >
      {/* Start another roll sits on the label's line, so the live picture below the card stays on
          a phone's first screen (30F-3 run 1). */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="capture-roll">Roll</Label>
          <Button
            size="lg"
            variant="ghost"
            className="-my-2 -mr-2"
            onClick={onStartAnother}
            disabled={disabled}
          >
            <Plus aria-hidden />
            Start another roll
          </Button>
        </div>
        <Select
          id="capture-roll"
          value={chosen?.id ?? ""}
          disabled={disabled}
          onChange={(e) => onChoose(e.target.value)}
          className="h-11"
          aria-describedby={chosen ? "capture-roll-line" : undefined}
        >
          {/* The hint itself shows once, under the Capture button (30F-3). */}
          {!chosen && <option value="">Choose a roll</option>}
          {rolls.map((r) => (
            <option key={r.id} value={r.id}>
              {[r.code, r.supplier, shotsText(r.shots)].filter(Boolean).join(" · ")}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        {chosen && (
          <p
            id="capture-roll-line"
            className="text-xl font-semibold"
            data-testid="capture-roll-line"
          >
            {rollLine(chosen)}
          </p>
        )}
        {chosen && <ScanningTimer roll={chosen} />}
        <p className="text-sm text-muted-foreground">
          Move the roll edge to edge after each shot. Finish when all of it is in.
        </p>
      </div>
      {since && (
        <p role="status" className="rounded-md bg-caution-soft p-3 text-sm">
          {since}
        </p>
      )}
      {chosen && (
        <div className="flex flex-wrap gap-2 border-t pt-2.5 sm:pt-3">
          <Button
            size="lg"
            variant="secondary"
            disabled={disabled || chosen.shots === 0}
            aria-describedby={chosen.shots === 0 ? "finish-off" : undefined}
            onClick={() => setDialog("finish")}
          >
            <CircleCheck aria-hidden />
            Finish roll
          </Button>
          {chosen.shots === 0 && (
            <Button
              size="lg"
              variant="destructive"
              disabled={disabled}
              onClick={() => void openPutBack()}
            >
              <X aria-hidden />
              {chosen.fromInventory ? "Put roll back" : "Cancel roll"}
            </Button>
          )}
          {chosen.shots === 0 && (
            <p id="finish-off" className="basis-full text-sm text-muted-foreground">
              {chosen.fromInventory
                ? "Take the first shot to finish this roll, or put it back if it was picked by mistake."
                : "Take the first shot to finish this roll, or cancel it if it was started by mistake."}
            </p>
          )}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <Dialog open={dialog === "finish"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogTitle>Is all of {chosen?.code} scanned?</DialogTitle>
          <DialogDescription>
            {chosen ? shotsText(chosen.shots) : ""}. A finished roll can’t take more shots, and it
            comes off stock.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="lg">
                Keep capturing
              </Button>
            </DialogClose>
            <Button size="lg" disabled={busy} onClick={() => void close("finish")}>
              {spinner}
              Finish roll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cancel"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogTitle>
            {chosen?.fromInventory ? `Put ${chosen.code} back?` : `Cancel ${chosen?.code}?`}
          </DialogTitle>
          <DialogDescription>
            {chosen?.fromInventory
              ? "It has no shots yet. It goes back to the rolls waiting to be scanned."
              : "It has no shots yet. Cancel it if it was started by mistake."}
          </DialogDescription>
          {chosen?.fromInventory && locations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="put-back-location" className="text-base">
                Where did you put it?
              </Label>
              <Select
                id="put-back-location"
                className="h-11"
                value={putBackTo}
                onChange={(e) => setPutBackTo(e.target.value)}
              >
                <option value="">Not placed</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locationText(l)}
                    {l.id === chosen.takenFromId ? " (where it was)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="lg">
                Keep roll
              </Button>
            </DialogClose>
            <Button
              size="lg"
              variant="destructive"
              disabled={busy}
              onClick={() => void close("cancel")}
            >
              {spinner}
              {chosen?.fromInventory ? "Put roll back" : "Cancel roll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={aside !== null}
        onOpenChange={(open) => {
          if (!open && aside) {
            onClosed(aside.id, aside.message);
            setAside(null);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Set {aside?.code} aside for the supplier</DialogTitle>
          <DialogDescription>
            It is marked Returned to supplier. Choose where you put it, so the Floor Manager can
            find it when the supplier comes.
          </DialogDescription>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aside-location" className="text-base">
              Where did you put it?
            </Label>
            <Select
              id="aside-location"
              className="h-11"
              value={asideTo}
              aria-invalid={!!asideError}
              aria-describedby={asideError ? "aside-location-error" : undefined}
              onChange={(e) => setAsideTo(e.target.value)}
            >
              <option value="">Choose a place</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {locationText(l)}
                </option>
              ))}
            </Select>
            <FieldError id="aside-location-error" message={asideError ?? undefined} />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                if (aside) onClosed(aside.id, aside.message);
                setAside(null);
              }}
            >
              Skip
            </Button>
            <Button size="lg" disabled={busy} onClick={() => void setAsideNow()}>
              {spinner}
              Set aside
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
