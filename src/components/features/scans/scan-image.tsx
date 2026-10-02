"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type OverlayDetection = {
  id: string;
  label: string;
  confidence: number;
  unknown: boolean;
  box: { x: number; y: number; width: number; height: number };
};

type Props = {
  src: string;
  alt: string;
  detections: OverlayDetection[];
  thresholds: { rejectAtOrAbove: number; reworkAtOrAbove: number };
  /** Controlled highlight (e.g. when hovering a row in the detections table). */
  highlightId?: string | null;
  className?: string;
};

/** Box tone follows what the confidence alone would mean; unknown classes are "needs review". */
function tone(d: OverlayDetection, t: Props["thresholds"]) {
  if (d.unknown) return "review";
  if (d.confidence >= t.rejectAtOrAbove) return "reject";
  if (d.confidence >= t.reworkAtOrAbove) return "rework";
  return "muted";
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
  const active = highlightId ?? hover;

  return (
    <figure className={cn("relative overflow-hidden rounded-lg border bg-muted", className)}>
      {/* Authenticated, per-scan image: next/image optimisation would need it to be public. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block h-auto w-full" />
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
