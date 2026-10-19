"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { detectionOutcome, type DefectAction, type Thresholds } from "@/lib/decision-engine";
import { cn } from "@/lib/utils";

export type OverlayDetection = {
  id: string;
  label: string;
  confidence: number;
  unknown: boolean;
  /** The type's action when the scan was decided (D-053); null = by confidence. */
  action?: DefectAction | null;
  box: { x: number; y: number; width: number; height: number };
};

type Props = {
  src: string;
  alt: string;
  detections: OverlayDetection[];
  thresholds: Thresholds;
  /** Controlled highlight (e.g. when hovering a row in the detections table). */
  highlightId?: string | null;
  className?: string;
};

/** Box tone follows what this detection alone would mean; unknown classes are "needs review". */
function tone(d: OverlayDetection, t: Thresholds) {
  if (d.unknown) return "review";
  const outcome = detectionOutcome(d.confidence, d.action, t);
  return outcome === "REJECT" ? "reject" : outcome === "REWORK" ? "rework" : "muted";
}

const TONES = {
  reject: "border-reject [--chip:var(--reject)]",
  rework: "border-rework [--chip:var(--rework)]",
  review: "border-review border-dashed [--chip:var(--review)]",
  muted: "border-muted-foreground/70 border-dashed [--chip:var(--muted-foreground)]",
} as const;

/** The captured section with each detection drawn where the model saw it (fractions of the image). */
export function ScanImage({ src, alt, detections, thresholds, highlightId, className }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const active = highlightId ?? hover;

  if (failed) {
    return (
      <figure
        className={cn(
          "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 text-center text-muted-foreground",
          className,
        )}
      >
        <ImageOff aria-hidden className="size-8" />
        <figcaption>
          The image file for this scan is missing. The detections below are still recorded.
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={cn("relative overflow-hidden rounded-lg border bg-muted", className)}>
      {/* Authenticated, per-scan image: next/image optimisation would need it to be public. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={() => setFailed(true)} className="block h-auto w-full" />
      {detections.map((d) => (
        <div
          key={d.id}
          data-testid="detection-box"
          onMouseEnter={() => setHover(d.id)}
          onMouseLeave={() => setHover(null)}
          className={cn(
            "absolute rounded-sm border-2 transition-[box-shadow,opacity] duration-(--dur-fast)",
            TONES[tone(d, thresholds)],
            active && active !== d.id && "opacity-40",
            active === d.id && "shadow-[0_0_0_3px_var(--background)]",
          )}
          style={{
            left: `${d.box.x * 100}%`,
            top: `${d.box.y * 100}%`,
            width: `${d.box.width * 100}%`,
            height: `${d.box.height * 100}%`,
          }}
        >
          <span className="absolute -top-6 left-0 rounded-sm bg-(--chip) px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-background">
            {d.label} {Math.round(d.confidence * 100)}%
          </span>
        </div>
      ))}
    </figure>
  );
}
