"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small scan image that degrades to a labelled placeholder if the file is missing or unreadable. */
export function ScanThumb({ scanId, className }: { scanId: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-sm bg-muted text-muted-foreground",
          className,
        )}
        title="Image unavailable"
      >
        <ImageOff aria-hidden className="size-4" />
        <span className="sr-only">Image unavailable</span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated per-scan image
    <img
      src={`/api/v1/scans/${scanId}/image`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("rounded-sm object-cover", className)}
    />
  );
}
