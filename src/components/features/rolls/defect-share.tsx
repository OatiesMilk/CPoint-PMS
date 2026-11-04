import { Badge } from "@/components/ui/badge";
import { defectShareText, returnMark } from "@/lib/roll-rules";
import type { RollStatus } from "@/lib/domain";

/**
 * A roll's Defect % (Phase 30C, D-110): "12.4%", or "Kept" after a Phase 30C Keep. A roll over the
 * limit reads Returned to supplier in its Status (D-116).
 */
export function DefectShare({
  roll,
}: {
  roll: {
    status: RollStatus;
    defectSharePct: number | null;
    finishedAt?: Date | string | null;
    markedForReturn: boolean;
    returnDecision: "RETURNED" | "KEPT" | null;
  };
}) {
  const text = defectShareText(roll);
  const mark = returnMark(roll);
  return (
    <span className="flex flex-col items-end gap-1">
      <span className={text === "Not measured" ? "text-muted-foreground" : "tabular-nums"}>
        {text}
      </span>
      {mark === "kept" && <Badge tone="neutral">Kept</Badge>}
    </span>
  );
}
