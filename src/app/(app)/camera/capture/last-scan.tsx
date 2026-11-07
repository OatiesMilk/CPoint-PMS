"use client";

import { VerdictBadge, type Verdict } from "@/components/features/verdict-badge";
import { OUTCOME_LABELS, type DefectOutcome } from "@/lib/decision-engine";

/** What a capture returns: the verdict, the shot and what each found defect did (Phase 26). */
export type ScanSummary = {
  verdict: Verdict;
  sequence: number;
  rollCode: string;
  defects: {
    label: string;
    confidence: number;
    effect: DefectOutcome | null;
    /** Its box diagonal in inches; null when the shot had no scale (Phase 30C). */
    lengthIn?: number | null;
  }[];
};

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** What each detection did to the shot, in words beside the colour (D-093). */
function effectText(d: ScanSummary["defects"][number]): string {
  return d.effect ? OUTCOME_LABELS[d.effect] : "Not counted";
}

/** The verdict for the last shot, with each defect Usable or Not accepted (D-075, D-093). */
export function LastScanSummary({ summary, repeat }: { summary: ScanSummary; repeat: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <VerdictBadge verdict={summary.verdict} className="text-base" />
        <span className="font-medium">
          Shot #{summary.sequence} · <span className="font-mono">{summary.rollCode}</span>
        </span>
      </div>
      {repeat && (
        <p className="text-sm text-muted-foreground">
          This capture had already reached the app, so it wasn’t saved twice.
        </p>
      )}
      <p className="text-base">
        {summary.verdict === "REJECT"
          ? "Reject: this part of the roll is not for cutting."
          : "Pass: this part of the roll can go on to cutting."}
      </p>
      {summary.defects.length > 0 ? (
        <ul className="flex flex-col divide-y text-sm">
          {summary.defects.map((d, i) => (
            <li key={`${d.label}-${i}`} className="flex justify-between gap-3 py-1.5">
              <span>
                {d.label}
                {d.lengthIn != null && (
                  <span className="text-muted-foreground tabular-nums">
                    {" "}
                    · {d.lengthIn.toFixed(1)} in
                  </span>
                )}
                <span className="text-muted-foreground"> · {effectText(d)}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">{percent(d.confidence)}</span>
            </li>
          ))}
        </ul>
      ) : (
        !repeat && <p className="text-sm text-muted-foreground">No defects found on this shot.</p>
      )}
    </div>
  );
}
