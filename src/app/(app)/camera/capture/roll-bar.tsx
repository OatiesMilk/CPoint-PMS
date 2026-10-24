"use client";

import { useState } from "react";
import { CircleCheck, LoaderCircle, Plus, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatManilaWeekdayDate, manilaToday } from "@/lib/format";
import { openSinceLine } from "@/lib/roll-rules";

/** An open roll as GET /api/v1/rolls/open sends it. */
export type OpenRollView = {
  id: string;
  code: string;
  tagCode: string | null;
  supplier: string | null;
  shots: number;
  startedAt: string;
  mine: boolean;
};

const shotsText = (n: number) => `${n} ${n === 1 ? "shot" : "shots"}`;

/** "Roll R-2026-0012 · Marikina Leather Trading · 6 shots" */
export function rollLine(roll: OpenRollView): string {
  return [`Roll ${roll.code}`, roll.supplier, shotsText(roll.shots)].filter(Boolean).join(" · ");
}

/** "Open since Tue, 22 Oct. Finish it or keep capturing." for a roll from an earlier day. */
export function openSince(roll: OpenRollView, now = new Date()): string | null {
  return openSinceLine(
    manilaToday(new Date(roll.startedAt)),
    manilaToday(now),
    formatManilaWeekdayDate(roll.startedAt),
  );
}

type ApiError = { error?: { code?: string; message?: string } };

/**
 * Which roll the next shot goes to (Phase 26): the Roll dropdown (every open roll), the chosen roll
 * in large text, Start another roll, Finish roll and, for an empty roll, Cancel roll.
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

  async function close(kind: "finish" | "cancel") {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/rolls/${chosen.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as ApiError;
      setDialog(null);
      if (res.ok) {
        onClosed(
          chosen.id,
          kind === "finish"
            ? `${chosen.code} is finished with ${shotsText(chosen.shots)}.`
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
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-1"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
          <Label htmlFor="capture-roll">Roll</Label>
          <Select
            id="capture-roll"
            value={chosen?.id ?? ""}
            disabled={disabled}
            onChange={(e) => onChoose(e.target.value)}
            className="h-11"
            aria-describedby="capture-roll-line"
          >
            {!chosen && <option value="">Choose the roll this shot belongs to</option>}
            {rolls.map((r) => (
              <option key={r.id} value={r.id}>
                {[r.code, r.supplier, shotsText(r.shots)].filter(Boolean).join(" · ")}
              </option>
            ))}
          </Select>
        </div>
        <Button size="lg" variant="secondary" onClick={onStartAnother} disabled={disabled}>
          <Plus aria-hidden />
          Start another roll
        </Button>
      </div>

      {chosen ? (
        <p id="capture-roll-line" className="text-xl font-semibold" data-testid="capture-roll-line">
          {rollLine(chosen)}
        </p>
      ) : (
        <p id="capture-roll-line" className="text-lg">
          Choose the roll this shot belongs to.
        </p>
      )}
      {since && (
        <p role="status" className="rounded-md bg-caution-soft p-3 text-sm">
          {since}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Move the roll edge to edge after each shot. Finish when all of it is in.
      </p>
      {chosen && (
        <div className="flex flex-wrap gap-2">
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
              onClick={() => setDialog("cancel")}
            >
              <X aria-hidden />
              Cancel roll
            </Button>
          )}
          {chosen.shots === 0 && (
            <p id="finish-off" className="basis-full text-sm text-muted-foreground">
              Take the first shot to finish this roll, or cancel it if it was started by mistake.
            </p>
          )}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <Dialog open={dialog === "finish"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogTitle>Is all of {chosen?.code} scanned?</DialogTitle>
          <DialogDescription>
            {chosen ? shotsText(chosen.shots) : ""}. A finished roll can’t take more shots.
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
          <DialogTitle>Cancel {chosen?.code}?</DialogTitle>
          <DialogDescription>
            It has no shots yet. Cancel it if it was started by mistake.
          </DialogDescription>
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
              Cancel roll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
