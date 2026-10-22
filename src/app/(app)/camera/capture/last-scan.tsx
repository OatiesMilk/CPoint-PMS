"use client";

import Link from "next/link";
import { ScanImage } from "@/components/features/scans/scan-image";
import { VerdictBadge, type Verdict } from "@/components/features/verdict-badge";
import { readSnapshot } from "@/lib/decision-engine";

/** The scan as GET /api/v1/scans/{id} returns it: only the fields this card reads. */
export type ScanDetail = {
  id: string;
  sequence: number;
  aiVerdict: Verdict;
  finalVerdict: Verdict | null;
  status: "PENDING_REVIEW" | "DECIDED";
  imagePath: string | null;
  modelVersion: string | null;
  thresholdsSnapshot: unknown;
  batch: { code: string };
  detections: {
    id: string;
    rawClassKey: string;
    isUnknownClass: boolean;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    defectType: { label: string } | null;
  }[];
};

/** What a capture returns: enough for someone who can't open Scans (an allowed constructor). */
export type ScanSummary = { verdict: Verdict; sequence: number; batchCode: string };

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** The verdict and section only, for a constructor allowed to capture (D-075). */
export function LastScanSummary({ summary, repeat }: { summary: ScanSummary; repeat: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <VerdictBadge verdict={summary.verdict} className="text-base" />
        <span className="font-medium">
          Section #{summary.sequence} · <span className="font-mono">{summary.batchCode}</span>
        </span>
      </div>
      {repeat && (
        <p className="text-sm text-muted-foreground">
          This capture had already reached the app, so it wasn’t saved twice.
        </p>
      )}
      {summary.verdict === "NEEDS_REVIEW" && (
        <p className="text-sm">
          The model found something the app doesn’t know. Set the piece aside for the Quality
          Inspector.
        </p>
      )}
    </div>
  );
}

/** The app's verdict for the last capture, with the section and every defect it found. */
export function LastScan({ scan, repeat }: { scan: ScanDetail; repeat: boolean }) {
  const snapshot = readSnapshot(scan.thresholdsSnapshot);
  const verdict = scan.finalVerdict ?? scan.aiVerdict;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <VerdictBadge verdict={verdict} className="text-base" />
        <span className="font-medium">
          Section #{scan.sequence} · <span className="font-mono">{scan.batch.code}</span>
        </span>
      </div>
      {repeat && (
        <p className="text-sm text-muted-foreground">
          This capture had already reached the app, so it wasn’t saved twice.
        </p>
      )}
      {scan.status === "PENDING_REVIEW" && (
        <p className="text-sm">
          The model found something the app doesn’t know, so the Quality Inspector decides this
          section in the Review queue.
        </p>
      )}
      {scan.detections.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {scan.detections.map((d) => (
            <li key={d.id} className="flex justify-between gap-3">
              <span>
                {d.defectType?.label ?? d.rawClassKey}
                {d.isUnknownClass && (
                  <span className="text-muted-foreground"> (not a defect type yet)</span>
                )}
              </span>
              <span className="text-muted-foreground tabular-nums">{percent(d.confidence)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No defects found on this section.</p>
      )}
      {scan.imagePath && (
        <ScanImage
          src={`/api/v1/scans/${scan.id}/image`}
          alt={`Section #${scan.sequence} of ${scan.batch.code}, as captured`}
          thresholds={snapshot}
          detections={scan.detections.map((d) => ({
            id: d.id,
            label: d.defectType?.label ?? d.rawClassKey,
            confidence: d.confidence,
            unknown: d.isUnknownClass,
            action: snapshot.actions?.[d.rawClassKey] ?? null,
            box: { x: d.x, y: d.y, width: d.width, height: d.height },
          }))}
        />
      )}
      <Link href={`/scans/${scan.id}`} className="text-sm underline underline-offset-4">
        Open scan
      </Link>
    </div>
  );
}
