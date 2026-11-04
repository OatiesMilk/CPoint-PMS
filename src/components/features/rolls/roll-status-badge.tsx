import { CircleCheck, CircleSlash, LoaderCircle, Undo2, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLL_STATUS_LABELS, type RollStatus } from "@/lib/domain";
import { ROLL_REPORT_STATUS_LABELS, rollReportStatus } from "@/lib/roll-rules";

const STYLE = {
  NOT_SCANNED: { tone: "neutral", Icon: Warehouse },
  PASSED: { tone: "success", Icon: CircleCheck },
  RETURNED: { tone: "warning", Icon: Undo2 },
} as const;

/**
 * Not yet scanned, Being scanned, Scanning passed, Returned to supplier or Removed (D-116). A roll
 * over the defect limit reads Returned to supplier.
 */
export function RollStatusBadge({
  roll,
}: {
  roll: {
    status: RollStatus;
    markedForReturn: boolean;
    returnDecision: "RETURNED" | "KEPT" | null;
  };
}) {
  const report = rollReportStatus(roll);
  if (report) {
    const { tone, Icon } = STYLE[report];
    return (
      <Badge tone={tone}>
        <Icon aria-hidden />
        {ROLL_REPORT_STATUS_LABELS[report]}
      </Badge>
    );
  }
  const Icon = roll.status === "OPEN" ? LoaderCircle : CircleSlash;
  return (
    <Badge tone={roll.status === "OPEN" ? "info" : "neutral"}>
      <Icon aria-hidden />
      {ROLL_STATUS_LABELS[roll.status]}
    </Badge>
  );
}
