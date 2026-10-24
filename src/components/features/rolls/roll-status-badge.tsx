import { CircleCheck, CircleSlash, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLL_STATUS_LABELS, type RollStatus } from "@/lib/domain";

const STYLE = {
  OPEN: { tone: "info", Icon: LoaderCircle },
  FINISHED: { tone: "success", Icon: CircleCheck },
  CANCELLED: { tone: "neutral", Icon: CircleSlash },
} as const;

/** Open (being captured), Finished or Cancelled (Phase 26, D-095). */
export function RollStatusBadge({ status }: { status: RollStatus }) {
  const { tone, Icon } = STYLE[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {ROLL_STATUS_LABELS[status]}
    </Badge>
  );
}
