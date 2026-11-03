import { Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { defectShareText, returnMark } from "@/lib/roll-rules";
import type { RollStatus } from "@/lib/domain";

/**
 * A roll's Defect % with its mark (Phase 30C, D-110): "12.4%" and "Too many defects" while the
 * Floor Manager hasn't decided, or "Kept" after Keep.
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
      {mark === "to-return" && (
        <Badge tone="warning">
          <Undo2 aria-hidden />
          Too many defects
        </Badge>
      )}
      {mark === "kept" && <Badge tone="neutral">Kept</Badge>}
    </span>
  );
}
