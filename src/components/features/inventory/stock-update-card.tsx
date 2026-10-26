import Link from "next/link";
import { BellRing, ClipboardPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeReminderDays } from "@/lib/stock-rules";

/**
 * FM home, on a reminder day until an update is saved (Phase 29, C-32): Wednesday and Friday by
 * default. Shown first, since a missed count lets the shelf and the system drift apart.
 */
export function StockUpdateCard({ reminderDays }: { reminderDays: number[] }) {
  return (
    <Card data-testid="stock-update-card" className="border-info bg-info-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing aria-hidden className="size-5 text-info" />
          Stock update today
        </CardTitle>
        <CardDescription>
          Enter what was added and used since the last update. You’re reminded on{" "}
          {describeReminderDays(reminderDays)} until an update is saved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/inventory/update">
            <ClipboardPen aria-hidden />
            Update stock
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
