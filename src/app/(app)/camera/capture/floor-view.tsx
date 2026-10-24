"use client";

/*
 * Intent brief (ui-craft §1)
 * Who:   the constructor capturing a roll at a station PC, glancing up from the leather at a
 *        monitor about 2 m away. Space on the station's keyboard captures.
 * What:  see the live camera, then where the piece goes: Pass or Reject, in colour, word and
 *        icon (D-074, D-093).
 * Worst: a piece sorted into the wrong bin because the verdict was unclear or stale, or a capture
 *        that silently failed. The verdict stays until the next capture, "Checking…" shows while
 *        the model runs, and every problem fills the band with what to do.
 */
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { CameraOff, CircleCheck, CircleX, LoaderCircle, Minimize2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Verdict } from "@/components/features/verdict-badge";
import { FLOOR_VERDICT } from "@/lib/capture-rules";
import { cn } from "@/lib/utils";

const TONE: Record<Verdict, { frame: string; band: string; Icon: typeof CircleCheck }> = {
  PASS: { frame: "border-pass", band: "bg-pass-soft text-pass", Icon: CircleCheck },
  REJECT: { frame: "border-reject", band: "bg-reject-soft text-reject", Icon: CircleX },
};

export type FloorResult = {
  verdict: Verdict;
  sequence: number;
  rollCode: string;
  repeat: boolean;
};

/** What the band at the bottom says right now; the client works it out from its own state. */
export type FloorBand =
  | { kind: "result"; result: FloorResult }
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "problem"; title: string; fix: string; retry?: () => void }
  | { kind: "failed"; message: string; resend?: () => void; discard?: () => void };

export function FloorView({
  videoRef,
  live,
  frozenUrl,
  rollLine,
  rollNotice,
  band,
  onLeave,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  live: boolean;
  frozenUrl: string | null;
  rollLine: string;
  rollNotice: string | null;
  band: FloorBand;
  onLeave: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Focus the view itself, not a button: Space must capture, never press a button.
  useEffect(() => rootRef.current?.focus(), []);

  const tone = band.kind === "result" ? TONE[band.result.verdict] : null;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label="Floor view"
      className="fixed inset-0 z-50 flex flex-col bg-background outline-none"
    >
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0">
          <p className="text-3xl font-semibold">{rollLine}</p>
          {rollNotice && (
            <p role="status" className="mt-1 text-xl text-muted-foreground">
              {rollNotice}
            </p>
          )}
        </div>
        <Button variant="ghost" tabIndex={-1} onClick={onLeave}>
          <Minimize2 aria-hidden />
          Leave Floor view (Esc)
        </Button>
      </header>

      <div
        className={cn(
          "relative min-h-0 flex-1 border-8 bg-muted",
          tone ? tone.frame : "border-transparent",
        )}
      >
        {/* The live picture, as on the Capture page; no live boxes (D-066). */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Live camera picture"
          className={live ? "block size-full object-contain" : "hidden"}
        />
        {frozenUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an asset
          <img
            src={frozenUrl}
            alt="The section being checked"
            className="absolute inset-0 size-full object-contain"
          />
        )}
      </div>

      <FloorBandView band={band} />
    </div>
  );
}

function FloorBandView({ band }: { band: FloorBand }) {
  if (band.kind === "result") {
    const { verdict, sequence, rollCode, repeat } = band.result;
    const { band: tone, Icon } = TONE[verdict];
    const copy = FLOOR_VERDICT[verdict];
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn("flex flex-wrap items-center gap-x-8 gap-y-2 px-8 py-6", tone)}
      >
        <span className="flex items-center gap-4 text-7xl font-bold">
          <Icon aria-hidden className="size-16" />
          {copy.word}
        </span>
        <span className="flex flex-col text-3xl font-semibold">
          <span>{copy.next}</span>
          <span className="text-2xl font-medium">
            Shot #{sequence} · <span className="font-mono">{rollCode}</span>
            {repeat && " · already saved"}
          </span>
        </span>
      </div>
    );
  }
  if (band.kind === "checking")
    return (
      <div
        role="status"
        className="flex items-center gap-4 bg-card px-8 py-6 text-5xl font-semibold"
      >
        <LoaderCircle aria-hidden className="size-12 animate-spin" />
        Checking…
      </div>
    );
  if (band.kind === "ready")
    return (
      <div role="status" className="bg-card px-8 py-6 text-4xl font-medium text-muted-foreground">
        Move the roll on to the next part, then press Space.
      </div>
    );
  if (band.kind === "problem")
    return (
      <div role="alert" className="flex flex-wrap items-center gap-6 bg-card px-8 py-6">
        <CameraOff aria-hidden className="size-12 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-4xl font-semibold">{band.title}</span>
          <span className="text-2xl text-muted-foreground">{band.fix}</span>
        </span>
        {band.retry && (
          <Button size="lg" variant="secondary" onClick={band.retry}>
            Try again
          </Button>
        )}
      </div>
    );
  return (
    <div role="alert" className="flex flex-wrap items-center gap-6 bg-reject-soft px-8 py-6">
      <span className="min-w-0 flex-1 text-3xl font-semibold text-reject">{band.message}</span>
      {band.resend && (
        <Button size="lg" onClick={band.resend}>
          <Send aria-hidden />
          Send again
        </Button>
      )}
      {band.discard && (
        <Button size="lg" variant="ghost" onClick={band.discard}>
          Discard this capture
        </Button>
      )}
    </div>
  );
}
