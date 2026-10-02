import { Check } from "lucide-react";
import { STAGE_LABELS, STAGE_ORDER, type BatchStatus, type Stage } from "@/lib/domain";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = { status: BatchStatus; currentStage: Stage; durations: Record<Stage, number> };

/** Four-step line: done steps ticked, the current one highlighted, time spent under each. */
export function StageProgress({ status, currentStage, durations }: Props) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <ol aria-label="Production stages" className="grid grid-cols-4 gap-2">
      {STAGE_ORDER.map((stage, index) => {
        const done = status === "COMPLETED" || (status !== "PLANNED" && index < currentIndex);
        const current = status === "IN_PROGRESS" && index === currentIndex;
        const stoppedHere =
          status === "CANCELLED" && index === currentIndex && durations[stage] > 0;
        const state = done
          ? "Done"
          : current
            ? "Current stage"
            : stoppedHere
              ? "Cancelled here"
              : "Not reached";

        return (
          <li
            key={stage}
            className="flex flex-col gap-2"
            aria-current={current ? "step" : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-brand-yellow text-brand-ink",
                  !done && !current && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check aria-hidden className="size-4" /> : index + 1}
              </span>
              {index < STAGE_ORDER.length - 1 && (
                <span
                  aria-hidden
                  className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")}
                />
              )}
            </div>
            <div>
              <p className={cn("font-medium", !done && !current && "text-muted-foreground")}>
                {STAGE_LABELS[stage]}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="sr-only">{state}. </span>
                {durations[stage] > 0
                  ? formatDuration(durations[stage])
                  : current
                    ? "Just started"
                    : "—"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
