import {
  Ban,
  CalendarClock,
  Check,
  CircleX,
  Clock,
  Hourglass,
  PackageCheck,
  Siren,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PurchaseRequestStatus } from "@/lib/domain";
import { STATUS_LABELS, URGENCY_LABELS, type Urgency } from "@/lib/procurement-rules";

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

const URGENCY = {
  HIGH: { tone: "danger", Icon: Siren },
  MEDIUM: { tone: "warning", Icon: Clock },
  LOW: { tone: "neutral", Icon: CalendarClock },
} as const;

/**
 * Urgency from the needed-by date (D-037): its own icon and label per level, then the time left
 * in plain words ("High · in 2 working days"). Closed requests have no urgency and show a dash.
 */
export function UrgencyBadge({
  urgency,
  daysLeft,
}: {
  urgency: Urgency | null;
  daysLeft?: string | null;
}) {
  if (!urgency)
    return (
      <span className="text-sm text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">No urgency, the request is closed</span>
      </span>
    );
  const { tone, Icon } = URGENCY[urgency];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Badge tone={tone}>
        <Icon aria-hidden />
        {URGENCY_LABELS[urgency]}
      </Badge>
      {daysLeft && (
        <span className="text-sm whitespace-nowrap text-muted-foreground">
          {daysLeft === "today" || daysLeft === "this weekend" ? `needed ${daysLeft}` : daysLeft}
        </span>
      )}
    </span>
  );
}
