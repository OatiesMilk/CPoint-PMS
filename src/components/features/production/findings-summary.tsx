import { REMEDY_LABEL, STAGE_LABEL, type Remedy, type Stage } from "@/lib/repair-rules";

type Line = {
  defect: string;
  pairs: number;
  remedy: string;
  returnStage: string | null;
  note: string | null;
};

/**
 * "What was wrong" (Phase 34, D-130): one line per defect with the QI's call. No person is named;
 * a batch from before Phase 34 has no lines (A-89) and says so.
 */
export function FindingsSummary({ lines, failedPairs }: { lines: Line[]; failedPairs: number }) {
  if (failedPairs === 0) return null;
  if (lines.length === 0)
    return <p className="text-sm text-muted-foreground">Reason not recorded.</p>;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-medium">What was wrong</p>
      <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground" data-testid="findings">
        {lines.map((l, i) => (
          <li key={i}>
            {l.defect}, {l.pairs} pair{l.pairs === 1 ? "" : "s"}:{" "}
            {REMEDY_LABEL[l.remedy as Remedy] ?? l.remedy}
            {l.returnStage && `, back to ${STAGE_LABEL[l.returnStage as Stage] ?? l.returnStage}`}
            {l.note && ` (${l.note})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
