"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { detectionOutcome, type DefectOutcome, type RuleSettings } from "@/lib/decision-engine";
import { cn } from "@/lib/utils";

export type OverlayDetection = {
  id: string;
  label: string;
  confidence: number;
  unknown: boolean;
  /** The type's outcome when the scan was decided (D-093); null for an unknown class or a scan
   * decided before Phase 25. */
  outcome?: DefectOutcome | null;
  box: { x: number; y: number; width: number; height: number };
};

type Props = {
  src: string;
  alt: string;
  detections: OverlayDetection[];
  rule: RuleSettings;
  /** Controlled highlight (e.g. when hovering a row in the detections table). */
  highlightId?: string | null;
  className?: string;
};

/**
 * Box tone follows what this detection does to the section: red for Not accepted (an unknown class
 * too, dashed), green for a found Usable defect, a grey dashed box below "counts as found at".
 */
function tone(d: OverlayDetection, rule: RuleSettings) {
  if (d.unknown) return "unknown";
  // A scan decided before Phase 25 has no outcomes in its snapshot: no tone to claim.
  if (!d.outcome) return "muted";
  const outcome = detectionOutcome(d.confidence, d.outcome, rule);
  return outcome === "NOT_ACCEPTED" ? "reject" : outcome === "USABLE" ? "pass" : "muted";
}

const TONES = {
  reject: "border-reject [--chip:var(--reject)]",
  unknown: "border-reject border-dashed [--chip:var(--reject)]",
  pass: "border-pass [--chip:var(--pass)]",
  muted: "border-muted-foreground/70 border-dashed [--chip:var(--muted-foreground)]",
} as const;

/** The captured section with each detection drawn where the model saw it (fractions of the image). */
export function ScanImage({ src, alt, detections, rule, highlightId, className }: Props) {
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
            TONES[tone(d, rule)],
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
