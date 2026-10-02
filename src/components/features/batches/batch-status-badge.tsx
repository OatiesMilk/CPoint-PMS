import { CircleCheck, CircleDashed, CircleSlash, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BATCH_STATUS_LABELS, type BatchStatus } from "@/lib/domain";

const STYLE = {
  PLANNED: { tone: "neutral", Icon: CircleDashed },
  IN_PROGRESS: { tone: "info", Icon: LoaderCircle },
  COMPLETED: { tone: "success", Icon: CircleCheck },
  CANCELLED: { tone: "neutral", Icon: CircleSlash },
} as const;

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const { tone, Icon } = STYLE[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {BATCH_STATUS_LABELS[status]}
    </Badge>
  );
}
