import { Ban, Check, CircleX, Hourglass, PackageCheck, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PurchasePriority, PurchaseRequestStatus } from "@/lib/domain";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/procurement-rules";

const STATUS = {
  PENDING: { tone: "warning", Icon: Hourglass },
  APPROVED: { tone: "info", Icon: Check },
  RECEIVED: { tone: "success", Icon: PackageCheck },
  REJECTED: { tone: "danger", Icon: CircleX },
  CANCELLED: { tone: "neutral", Icon: Ban },
} as const;

/** A request's status: icon + label + tone, never colour alone. */
export function RequestStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const { tone, Icon } = STATUS[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** Urgent stands out; normal is plain text, so the column isn't a wall of badges. */
export function PriorityLabel({ priority }: { priority: PurchasePriority }) {
  if (priority === "URGENT")
    return (
      <Badge tone="danger">
        <Siren aria-hidden />
        {PRIORITY_LABELS.URGENT}
      </Badge>
    );
  return <span className="text-sm text-muted-foreground">{PRIORITY_LABELS.NORMAL}</span>;
}
