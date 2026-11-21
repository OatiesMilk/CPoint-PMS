import Link from "next/link";
import { BellRing, ClipboardPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/features/overview/action-card";
import { describeReminderDays } from "@/lib/stock-rules";

/**
 * FM home, on a reminder day until an update is saved (Phase 29, C-32): Wednesday and Friday by
 * default. A "needs attention" row at the top, since a missed count lets the shelf and the system
 * drift apart. `primary` is false when Plan today is also due: one primary button per view (A-99).
 */
export function StockUpdateCard({
  reminderDays,
  primary = true,
}: {
  reminderDays: number[];
  primary?: boolean;
}) {
  return (
    <ActionCard
      testId="stock-update-card"
      icon={<BellRing />}
      title="Stock update today"
      description={
        <>
          Enter what was added and used since the last update. You’re reminded on{" "}
          {describeReminderDays(reminderDays)} until an update is saved.
        </>
      }
      action={
        <Button asChild variant={primary ? "primary" : "secondary"} className="max-sm:w-full">
          <Link href="/inventory/update">
            <ClipboardPen aria-hidden />
            Update stock
          </Link>
        </Button>
      }
    />
  );
}
