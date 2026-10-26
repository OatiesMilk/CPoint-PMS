import { CircleCheck, CircleSlash, LoaderCircle, PackageCheck, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLL_STATUS_LABELS, type RollStatus } from "@/lib/domain";

const STYLE = {
  IN_STOCK: { tone: "neutral", Icon: Warehouse },
  OPEN: { tone: "info", Icon: LoaderCircle },
  FINISHED: { tone: "success", Icon: CircleCheck },
  USED: { tone: "neutral", Icon: PackageCheck },
  CANCELLED: { tone: "neutral", Icon: CircleSlash },
} as const;

/** Not scanned, Being scanned, Scanned, Fully used or Removed (Phase 30A, D-104). */
export function RollStatusBadge({ status }: { status: RollStatus }) {
  const { tone, Icon } = STYLE[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {ROLL_STATUS_LABELS[status]}
    </Badge>
  );
}
