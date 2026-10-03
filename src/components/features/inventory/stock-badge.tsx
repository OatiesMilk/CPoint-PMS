import { CircleAlert, CircleCheck, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StockLevel } from "@/lib/inventory-rules";

const STYLE = {
  OUT: { tone: "danger", Icon: PackageX, label: "Out of stock" },
  LOW: { tone: "warning", Icon: CircleAlert, label: "Low" },
  OK: { tone: "success", Icon: CircleCheck, label: "In stock" },
} as const;

/** Stock level next to a quantity (D-023): always icon + label, never color alone. */
export function StockBadge({ level, inactive }: { level: StockLevel; inactive?: boolean }) {
  if (inactive) return <Badge tone="neutral">Deactivated</Badge>;
  const { tone, Icon, label } = STYLE[level];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
