"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StageCountForm } from "@/components/features/production/stage-count-form";
import { RepairActions } from "@/app/(app)/batches/repair-actions";
import type { MyStage as MyStageData } from "@/server/services/stage.service";

/**
 * My stage (Phase 34, D-130, A-73): the constructor's stage today, "Sole-ing · pairs here now"
 * with one big number field for the whole stage, the repairs waiting there and a reminder when a
 * batch has ended since the last count. A phone card, shown on Capture. The number is the stage's,
 * not the person's: "Last counted 14:05 for all of Sole-ing".
 */
export function MyStage({ stage }: { stage: MyStageData | null }) {
  const router = useRouter();
  if (!stage)
    return (
      <Card data-testid="my-stage-none">
        <CardContent className="p-4">
          <p>You aren’t assigned to a stage today. Ask the Floor Manager.</p>
        </CardContent>
      </Card>
    );
  const pairs = (n: number) => `${n} pair${n === 1 ? "" : "s"}`;
  return (
    <Card aria-label="My stage" data-testid="my-stage">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{stage.label} · pairs here now</h2>
          <p className="text-sm text-muted-foreground" data-testid="my-stage-last">
            {stage.lastCounted}
          </p>
          {stage.captureAccess && (
            <p className="text-sm text-muted-foreground" data-testid="my-stage-capture">
              You have Capture access, so you work at Preparation.
            </p>
          )}
        </div>
        {stage.reminder && (
          <p className="rounded-md bg-caution-soft px-3 py-2 text-caution" role="status">
            {stage.reminder}
          </p>
        )}
        <StageCountForm
          key={stage.pairs ?? "none"}
          stage={stage.stage}
          label={stage.label}
          initial={stage.pairs}
          large
          onSaved={() => router.refresh()}
        />
        {stage.repairs.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Repairs at {stage.label}</h3>
            <ul className="flex flex-col gap-2" data-testid="my-stage-repairs">
              {stage.repairs.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 rounded-md border p-3">
                  <p>
                    {pairs(r.pairs)} back for repair · {r.defect} ·{" "}
                    <span className="font-mono">{r.code}</span>
                  </p>
                  <RepairActions
                    repair={{ id: r.id, code: r.code, stage: stage.stage }}
                    canManage={false}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
