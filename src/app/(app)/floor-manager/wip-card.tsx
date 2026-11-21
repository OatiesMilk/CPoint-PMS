import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { wipFooterLine } from "@/lib/repair-rules";
import type { WipBoard } from "@/server/services/stage.service";

const n = (v: number) => v.toLocaleString("en-PH");

/**
 * The Floor Manager's home card for work in progress (Phase 34, D-130): pairs at each stage now,
 * the repairs open and what waits for inspection. Per stage for the whole line (D-008); the full
 * board is Batches → Work in progress. Same height as Today's batches beside it (D-131).
 */
export function WipCard({ board }: { board: WipBoard }) {
  const repairs = board.cards.reduce((s, c) => s + c.repairPairs, 0);
  const noneCounted = board.cards.every((c) => c.pairs === null);
  const footer = wipFooterLine(repairs, board.waiting.line);
  return (
    <Card data-testid="wip-card" className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Work in progress</CardTitle>
            <CardDescription>Pairs at each stage, as last counted today.</CardDescription>
          </div>
          <CardLink href="/batches?tab=wip">Open</CardLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-x-4 gap-y-2">
          {board.cards.map((c) => (
            <div key={c.stage}>
              <dt className="text-sm text-muted-foreground">{c.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {c.pairs === null ? (
                  <>
                    <span aria-hidden>–</span>
                    <span className="sr-only">not counted today</span>
                  </>
                ) : (
                  n(c.pairs)
                )}
              </dd>
            </div>
          ))}
        </dl>
        {noneCounted && (
          <p className="text-sm text-muted-foreground">No stage has been counted today.</p>
        )}
        <p className="mt-auto text-sm text-muted-foreground">{footer}</p>
      </CardContent>
    </Card>
  );
}
