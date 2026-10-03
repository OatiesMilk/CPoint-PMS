import { ArrowRight, UserCheck } from "lucide-react";
import { VerdictBadge, type Verdict } from "@/components/features/verdict-badge";

/** The camera's verdict, and the final one when a person changed or settled it. */
export function VerdictFlow({
  aiVerdict,
  finalVerdict,
  isOverride,
}: {
  aiVerdict: Verdict;
  finalVerdict: Verdict | null;
  isOverride: boolean;
}) {
  if (!finalVerdict) return <VerdictBadge verdict={aiVerdict} />;
  if (finalVerdict === aiVerdict) return <VerdictBadge verdict={finalVerdict} />;
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* Superseded, so struck through rather than faded: fading failed contrast (Phase 8 audit). */}
      <span className="sr-only">Camera said</span>
      <VerdictBadge verdict={aiVerdict} className="line-through decoration-1" />
      <ArrowRight aria-label="changed to" className="size-3.5 text-muted-foreground" />
      <VerdictBadge verdict={finalVerdict} />
      {isOverride && (
        <span title="Changed by a person" className="text-muted-foreground">
          <UserCheck aria-label="Overridden by a person" className="size-4" />
        </span>
      )}
    </span>
  );
}
