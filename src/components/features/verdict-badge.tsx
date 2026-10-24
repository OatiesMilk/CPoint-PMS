import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

/** A section is Pass or Reject, and the camera's verdict is final (D-093). */
export type Verdict = "PASS" | "REJECT";

// Color never carries meaning alone: every verdict has an icon and a label.
const styles: Record<Verdict, { label: string; className: string; Icon: typeof CircleCheck }> = {
  PASS: { label: "Pass", className: "bg-pass-soft text-pass", Icon: CircleCheck },
  REJECT: { label: "Reject", className: "bg-reject-soft text-reject", Icon: CircleX },
};

/** The word a user sees for a verdict. */
export function verdictLabel(verdict: Verdict) {
  return styles[verdict].label;
}

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
