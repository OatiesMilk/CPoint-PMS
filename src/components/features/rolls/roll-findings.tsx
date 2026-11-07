import Link from "next/link";
import { cn } from "@/lib/utils";
import { OUTCOME_LABELS } from "@/lib/decision-engine";
import { formatCalendarDate } from "@/lib/format";
import {
  formatDefectArea,
  formatPct,
  type LargeDefect,
  type TypeFinding,
} from "@/lib/roll-findings";

export type FindingsRoll = {
  status: string;
  areaSqFt: number | null;
  finishedAt: Date | null;
  defectAreaSqIn: number | null;
  defectSharePct: number | null;
  returnLimitPct: number | null;
  markedForReturn: boolean;
  returnDecision: "RETURNED" | "KEPT" | null;
  returnedOn: string | null;
  returnNote: string | null;
};

const inches = (n: number) => `${n.toFixed(1)} in`;

/**
 * A roll's findings (Phase 30C, C-36): its area, defect area and share against the supplier limit,
 * the defects by type, and the largest boxes. Shown on the roll's page and its claim sheet. A
 * slanted cut's box is mostly clean leather (D-106), so the largest boxes link to their photos.
 */
export function RollFindings({
  roll,
  byType,
  largest,
  linkShots = true,
  framed = false,
}: {
  roll: FindingsRoll;
  byType: TypeFinding[];
  largest: LargeDefect[];
  linkShots?: boolean;
  /** On a card, as on the roll's page (Phase 30F-2); the claim sheet prints it plain. */
  framed?: boolean;
}) {
  const measured = roll.defectSharePct !== null && roll.defectAreaSqIn !== null;
  const limit = roll.returnLimitPct;
  // The roll's area is already on its page and the claim sheet, so it isn't repeated here (QA 30C F2).
  const facts: [string, string][] = [
    ["Area with defects", measured ? formatDefectArea(roll.defectAreaSqIn!) : "Not worked out"],
    [
      "Part of the roll with defects",
      measured
        ? `${formatPct(roll.defectSharePct!)}${limit !== null ? ` (limit ${formatPct(limit)})` : ""}`
        : "Not worked out",
    ],
  ];
  if (roll.returnDecision === "RETURNED")
    facts.push([
      "Sent back to the supplier",
      roll.returnedOn ? formatCalendarDate(roll.returnedOn) : "Yes",
    ]);
  if (roll.returnDecision === "KEPT") facts.push(["Decision", "Kept"]);

  return (
    <section
      aria-labelledby="findings-heading"
      className={cn(
        "flex flex-col gap-4",
        framed && "rounded-lg border bg-card p-5 text-card-foreground shadow-1",
      )}
    >
      <h2
        id="findings-heading"
        className={framed ? "text-lg font-semibold tracking-tight" : "text-xl font-semibold"}
      >
        How damaged is this roll?
      </h2>
      {!roll.finishedAt ? (
        <p className="text-muted-foreground">
          This is worked out when the roll is finished at Capture.
        </p>
      ) : (
        <>
          <p>
            {measured
              ? roll.markedForReturn
                ? `${formatPct(roll.defectSharePct!)} of this roll has defects. The limit is ${formatPct(limit ?? 10)}.`
                : `${formatPct(roll.defectSharePct!)} of this roll has defects. That’s within the ${formatPct(limit ?? 10)} limit.`
              : "We couldn’t work this out: some photos came from a phone that wasn’t set up, or the roll has no size in Inventory. You can still send it back."}
          </p>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-8 gap-y-4">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {roll.returnNote && (
            <p className="text-sm">
              <span className="text-muted-foreground">
                {roll.returnDecision === "KEPT" ? "Why it was kept: " : "Note: "}
              </span>
              {roll.returnNote}
            </p>
          )}
        </>
      )}

      {byType.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">Defects found</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {byType.map((t) => (
              <li key={t.label} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{t.label}</span>
                <span className="tabular-nums">× {t.count}</span>
                {t.notAccepted > 0 && (
                  <span className="text-muted-foreground">· {t.notAccepted} rejected</span>
                )}
                {t.longestIn !== null && (
                  <span className="text-muted-foreground">· longest {inches(t.longestIn)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {largest.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">Largest defects</h3>
          <p className="text-sm text-muted-foreground">
            Check these photos before you decide. A long, slanted cut can look bigger here than it
            really is.
          </p>
          <ol className="flex flex-col gap-1 text-sm">
            {largest.map((d, i) => (
              <li key={`${d.scanId}-${i}`} className="flex flex-wrap gap-x-2">
                {linkShots ? (
                  <Link href={`/scans/${d.scanId}`} className="underline-offset-4 hover:underline">
                    Shot #{d.sequence}
                  </Link>
                ) : (
                  <span>Shot #{d.sequence}</span>
                )}
                <span className="font-medium">{d.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {inches(d.lengthIn)} long · {d.areaSqIn.toFixed(1)} sq in
                  {d.outcome ? ` · ${OUTCOME_LABELS[d.outcome]}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
