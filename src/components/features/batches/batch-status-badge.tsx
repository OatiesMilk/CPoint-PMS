import { CircleCheck, CircleDashed, CircleSlash, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BatchStatus, Stage } from "@/lib/domain";
import { rollStatusLabel } from "@/lib/stage-machine";

const STYLE = {
  PLANNED: { tone: "neutral", Icon: CircleDashed },
  IN_PROGRESS: { tone: "info", Icon: LoaderCircle },
  COMPLETED: { tone: "success", Icon: CircleCheck },
  CANCELLED: { tone: "neutral", Icon: CircleSlash },
} as const;

/**
 * Planned, At Preparation, Finished or Cancelled (D-082). A batch started before rolls were tracked
 * and still past Preparation says so.
 */
export function BatchStatusBadge({
  status,
  currentStage = "PREPARATION",
}: {
  status: BatchStatus;
  currentStage?: Stage;
}) {
  const { tone, Icon } = STYLE[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {rollStatusLabel({ status, currentStage })}
    </Badge>
  );
}
