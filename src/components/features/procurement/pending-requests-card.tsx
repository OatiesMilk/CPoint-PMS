import Link from "next/link";
import { ArrowRight, CircleCheck, Siren } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";

type Props = {
  count: number;
  urgent: number;
  oldest: { id: string; code: string; createdAt: Date } | null;
  now: Date;
};

/** Purchase requests waiting on the Floor Manager (FM home, D-029). A late roll stops the line. */
export function PendingRequestsCard({ count, urgent, oldest, now }: Props) {
  return (
    <Card data-testid="pending-requests-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Purchase requests</CardTitle>
            <CardDescription>
              {count === 0
                ? "Nothing waiting for your decision."
                : `${count} request${count === 1 ? "" : "s"} waiting for your decision.`}
            </CardDescription>
          </div>
          <Link
            href="/procurement?status=PENDING"
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Procurement
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {count === 0 || !oldest ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck aria-hidden className="size-4 text-pass" />
            Constructors’ requests appear here when they send one.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <dt className="text-sm text-muted-foreground">Waiting</dt>
                <dd className="text-2xl font-semibold tabular-nums">{count}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Oldest</dt>
                <dd className="flex flex-col">
                  <span className="text-2xl font-semibold tabular-nums">
                    {formatDuration(now.getTime() - new Date(oldest.createdAt).getTime())}
                  </span>
                  <Link
                    href={`/procurement/${oldest.id}`}
                    className="font-mono text-sm underline-offset-4 hover:underline"
                  >
                    {oldest.code}
                  </Link>
                </dd>
              </div>
            </dl>
            {/* Outside the <dl>: a definition list may only hold term/value pairs (axe). */}
            {urgent > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-reject">
                <Siren aria-hidden className="size-4" />
                {urgent} marked urgent
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
