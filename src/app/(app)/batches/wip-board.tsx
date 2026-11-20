/*
 * The work in progress board (Phase 34, D-130): each stage in line order with the pairs there now
 * (counted by the constructors assigned to it or the Floor Manager), the repairs in it and what
 * waits for inspection. Figures are per stage for the whole line (D-008); the people assigned to a
 * stage are named in a quiet line below its figures, never beside a number. No colour ranks one
 * stage over another and nothing is ordered by performance.
 */
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StageCountButton } from "./stage-count-button";
import { RepairActions } from "./repair-actions";
import type { WipBoard as Board } from "@/server/services/stage.service";

const n = (v: number) => v.toLocaleString("en-PH");

export function WipBoard({ board }: { board: Board }) {
  return (
    <section aria-labelledby="wip-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="wip-heading" className="text-lg font-semibold">
          Work in progress
        </h2>
        <p className="text-muted-foreground">
          Pairs at each stage now, as counted by the people there, and the repairs waiting at each
          stage. A count is for the whole stage.
        </p>
      </div>
      <Link
        href="/batches?tab=queue"
        className="rounded-md border px-4 py-3 text-base hover:bg-muted/50"
        data-testid="wip-waiting"
      >
        {board.waiting.line}.{" "}
        <span className="text-muted-foreground underline">Open the queue</span>
      </Link>
      <ul
        className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4"
        data-testid="wip-board"
      >
        {board.cards.map((c) => (
          <li key={c.stage}>
            <Card aria-label={c.label} data-testid={`wip-${c.stage}`} className="h-full">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <h3 className="text-base font-semibold">{c.label}</h3>
                <p className="text-kpi font-semibold tracking-tight tabular-nums">
                  {c.pairs === null ? "–" : n(c.pairs)}
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    {c.pairs === null ? c.asOf : `pairs ${c.asOf}`}
                  </span>
                </p>
                {c.stage === "PREPARATION" && (
                  <p className="text-sm text-muted-foreground">
                    Rolls: {board.preparation.beingScanned} being scanned,{" "}
                    {board.preparation.scannedToday} scanned today.
                  </p>
                )}
                <div className="flex flex-col gap-1.5 text-sm">
                  <p>
                    {c.repairPairs === 0
                      ? "No repairs here."
                      : `In repair here: ${n(c.repairPairs)} pair${c.repairPairs === 1 ? "" : "s"}`}
                  </p>
                  {c.repairDefects.length > 0 && (
                    <p className="text-muted-foreground">{c.repairDefects.join(", ")}</p>
                  )}
                  {c.repairs.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {c.repairs.map((r) => (
                        <li key={r.id} className="flex flex-col gap-1.5 rounded-md border p-2">
                          <p>
                            <span className="font-mono font-medium">{r.code}</span>{" "}
                            <span className="text-muted-foreground">
                              {r.defect}, {n(r.pairs)} pair{r.pairs === 1 ? "" : "s"}
                            </span>
                          </p>
                          {board.canManageRepairs && (
                            <RepairActions
                              repair={{ id: r.id, code: r.code, stage: c.stage }}
                              canManage
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {board.canCount && (
                  <StageCountButton stage={c.stage} label={c.label} current={c.pairs} />
                )}
                {c.assigned && (
                  <p className="mt-auto text-xs text-muted-foreground">{c.assigned}</p>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
