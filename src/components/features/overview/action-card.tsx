import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * A slim "needs attention" row on the Floor Manager's Overview (Overview clean-up, D-131): an
 * icon, a title and one muted line at the left, the one button at the right. On a narrow window
 * the button goes under the text, full width (the caller adds `max-sm:w-full` to it).
 */
export function ActionCard({
  testId,
  icon,
  title,
  description,
  action,
}: {
  testId: string;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <Card
      data-testid={testId}
      className="flex flex-col gap-3 border-info bg-info-soft p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden className="mt-0.5 text-info [&_svg]:size-5">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="sm:ml-auto sm:shrink-0">{action}</div>
    </Card>
  );
}
