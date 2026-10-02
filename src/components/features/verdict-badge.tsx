import { CircleCheck, CircleHelp, CircleX, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export type Verdict = "PASS" | "REWORK" | "REJECT" | "NEEDS_REVIEW";

// Color never carries meaning alone: every verdict has an icon and a label.
const styles: Record<Verdict, { label: string; className: string; Icon: typeof CircleCheck }> = {
  PASS: { label: "Pass", className: "bg-pass-soft text-pass", Icon: CircleCheck },
  REWORK: { label: "Rework", className: "bg-rework-soft text-rework", Icon: Wrench },
  REJECT: { label: "Reject", className: "bg-reject-soft text-reject", Icon: CircleX },
  NEEDS_REVIEW: {
    label: "Needs review",
    className: "bg-review-soft text-review",
    Icon: CircleHelp,
  },
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { label, className: tone, Icon } = styles[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-sm font-medium",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
