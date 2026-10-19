"use client";

import { useState } from "react";
import { ScanImage, type OverlayDetection } from "@/components/features/scans/scan-image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Thresholds } from "@/lib/decision-engine";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  detections: (OverlayDetection & { inactive: boolean })[];
  thresholds: Thresholds;
};

/** Image + detections table; hovering a row highlights its box and vice versa. */
export function ScanViewer({ src, alt, detections, thresholds }: Props) {
  const [highlight, setHighlight] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <ScanImage
        src={src}
        alt={alt}
        detections={detections}
        thresholds={thresholds}
        highlightId={highlight}
      />
      {detections.length === 0 ? (
        <p className="text-muted-foreground">The camera found no defects on this section.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Defect</TableHead>
              <TableHead numeric>Confidence</TableHead>
              <TableHead>Position (x, y)</TableHead>
              <TableHead>Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detections.map((d) => (
              <TableRow
                key={d.id}
                onMouseEnter={() => setHighlight(d.id)}
                onMouseLeave={() => setHighlight(null)}
                className={cn(highlight === d.id && "bg-accent")}
              >
                <TableCell>
                  {d.label}
                  {d.unknown && <span className="ml-2 text-sm text-review">unknown class</span>}
                  {d.inactive && (
                    <span className="ml-2 text-sm text-muted-foreground">deactivated, ignored</span>
                  )}
                </TableCell>
                <TableCell numeric>{Math.round(d.confidence * 100)}%</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {Math.round(d.box.x * 100)}%, {Math.round(d.box.y * 100)}%
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {Math.round(d.box.width * 100)}% × {Math.round(d.box.height * 100)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
