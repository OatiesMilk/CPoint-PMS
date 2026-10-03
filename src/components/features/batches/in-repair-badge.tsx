import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Tags a batch whose sections are still at the repair station (D-022). Renders nothing at 0. */
export function InRepairBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge tone="warning" title={`${count} section${count === 1 ? "" : "s"} still being repaired`}>
      <Wrench aria-hidden />
      In repair · {count}
    </Badge>
  );
}
