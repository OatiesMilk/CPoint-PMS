"use client";

import { useState } from "react";
import { Ruler, RotateCcw } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  pxPerInFromCorners,
  SHEET_SIZES,
  WIDTH_IN_MAX,
  WIDTH_IN_MIN,
  widthInFrom,
  type Point,
  type SheetKey,
} from "@/lib/measure";

/**
 * Calibrating a phone at Capture (Phase 30C, A-18): one photo of an A4 or letter sheet flat on the
 * table, its four corners tapped, gives the inches the phone sees across the photo. It is kept in
 * this browser per camera and frame size, so a camera that comes up at another size asks again.
 */

const KEY = "cpoint.capture.calibration";

export type Calibration = {
  widthIn: number;
  frameWidth: number;
  frameHeight: number;
  savedAt: string;
};

function readAll(): Record<string, Calibration> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Calibration>) : {};
  } catch {
    return {};
  }
}

/** This camera's calibration, only when it was made at this frame size. */
export function savedCalibration(
  deviceId: string,
  frameWidth: number,
  frameHeight: number,
): Calibration | null {
  const c = readAll()[deviceId || "default"];
  if (!c || typeof c.widthIn !== "number") return null;
  return c.frameWidth === frameWidth && c.frameHeight === frameHeight ? c : null;
}

export function saveCalibration(deviceId: string, c: Calibration) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [deviceId || "default"]: c }));
  } catch {
    // Private mode: it isn't remembered, so the page asks again next time.
  }
}

export type Frame = { url: string; width: number; height: number };

const WIDTH_MESSAGE = `Enter the inches the phone sees across the table, from ${WIDTH_IN_MIN} to ${WIDTH_IN_MAX}, like 22.4.`;

/** The dialog: tap the sheet's corners on the frozen frame, or type the toolkit's number. */
export function CalibrateDialog({
  open,
  frame,
  onClose,
  onSave,
}: {
  open: boolean;
  frame: Frame | null;
  onClose: () => void;
  onSave: (widthIn: number) => void;
}) {
  const [sheet, setSheet] = useState<SheetKey>("a4");
  const [taps, setTaps] = useState<Point[]>([]);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);

  const size = SHEET_SIZES[sheet];
  const pxPerIn = frame && taps.length === 4 ? pxPerInFromCorners(taps, size) : null;
  const widthIn = frame && pxPerIn ? widthInFrom(pxPerIn, frame.width) : null;
  const tapsWrong = taps.length === 4 && pxPerIn === null;
  const outOfRange = widthIn !== null && (widthIn < WIDTH_IN_MIN || widthIn > WIDTH_IN_MAX);

  const reset = () => {
    setTaps([]);
    setTyped("");
    setTypedError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>Set up this phone</DialogTitle>
        <DialogDescription asChild>
          <ol className="list-decimal pl-5">
            <li>Put an A4 or letter paper flat on the table.</li>
            <li>Keep the phone where it will stay.</li>
            <li>Tap the 4 corners of the paper on the photo below.</li>
          </ol>
        </DialogDescription>

        {!typing ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calibrate-sheet">Paper size</Label>
                <Select
                  id="calibrate-sheet"
                  value={sheet}
                  onChange={(e) => setSheet(e.target.value as SheetKey)}
                  className="h-11"
                >
                  {(Object.keys(SHEET_SIZES) as SheetKey[]).map((k) => (
                    <option key={k} value={k}>
                      {SHEET_SIZES[k].label} ({SHEET_SIZES[k].short} × {SHEET_SIZES[k].long} in)
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="ghost" size="lg" onClick={() => setTaps([])} disabled={!taps.length}>
                <RotateCcw aria-hidden />
                Tap again
              </Button>
            </div>

            {frame ? (
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                <img
                  src={frame.url}
                  alt="The photo to tap the paper's corners on"
                  className="block h-auto max-h-[50dvh] w-auto max-w-full cursor-crosshair select-none"
                  draggable={false}
                  onClick={(e) => {
                    if (taps.length >= 4) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - r.left) / r.width) * frame.width;
                    const y = ((e.clientY - r.top) / r.height) * frame.height;
                    setTaps((t) => [...t, { x, y }]);
                  }}
                />
                {taps.map((p, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-primary text-xs font-semibold text-primary-foreground"
                    style={{
                      left: `${(p.x / frame.width) * 100}%`,
                      top: `${(p.y / frame.height) * 100}%`,
                    }}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
            ) : (
              <Alert tone="danger">
                The camera has no picture yet. Close this, wait for the picture, then try again.
              </Alert>
            )}

            <p role="status" className="text-sm" aria-live="polite">
              {taps.length < 4
                ? `Corners tapped: ${taps.length} of 4.`
                : tapsWrong || outOfRange
                  ? `That doesn’t look like the corners of ${size.label === "A4" ? "an A4" : "a letter"} paper. Press Tap again and try once more.`
                  : "Done. Press Save."}
            </p>
            <button
              type="button"
              className="self-start text-sm text-primary underline underline-offset-4"
              onClick={() => {
                setTyping(true);
                setTaps([]);
              }}
            >
              More options: type the number from the setup tool
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="calibrate-width">Inches the phone sees across the table</Label>
              <Input
                id="calibrate-width"
                inputMode="decimal"
                autoComplete="off"
                className="w-40"
                value={typed}
                aria-invalid={!!typedError}
                aria-describedby={typedError ? "calibrate-width-error" : "calibrate-width-hint"}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setTypedError(null);
                }}
              />
              {typedError ? (
                <p id="calibrate-width-error" className="text-sm text-reject">
                  {typedError}
                </p>
              ) : (
                <p id="calibrate-width-hint" className="text-sm text-muted-foreground">
                  The “width seen” that{" "}
                  <span className="font-mono">python -m cpoint_cv calibrate</span> printed for a
                  photo from this phone on the stand.
                </p>
              )}
            </div>
            <button
              type="button"
              className="self-start text-sm text-primary underline underline-offset-4"
              onClick={() => {
                setTyping(false);
                setTypedError(null);
              }}
            >
              Tap the paper’s corners instead
            </button>
          </>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="lg">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="lg"
            disabled={!typing && (widthIn === null || outOfRange)}
            onClick={() => {
              if (typing) {
                const n = Number(typed);
                if (!typed.trim() || !Number.isFinite(n) || n < WIDTH_IN_MIN || n > WIDTH_IN_MAX) {
                  setTypedError(WIDTH_MESSAGE);
                  document.getElementById("calibrate-width")?.focus();
                  return;
                }
                onSave(n);
              } else if (widthIn !== null) onSave(widthIn);
              reset();
            }}
          >
            <Ruler aria-hidden />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
