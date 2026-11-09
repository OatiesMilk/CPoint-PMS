import Link from "next/link";
import { Stat } from "@/components/features/kpi-tile";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OUTCOME_LABELS } from "@/lib/decision-engine";
import { formatCalendarDate } from "@/lib/format";
import { formatPct, type LargeDefect, type TypeFinding } from "@/lib/roll-findings";

export type FindingsRoll = {
  status: string;
  areaSqFt: number | null;
  finishedAt: Date | null;
  defectAreaSqIn: number | null;
  defectSharePct: number | null;
  returnLimitPct: number | null;
  markedForReturn: boolean;
  returnDecision: "RETURNED" | "KEPT" | null;
  returnedOn: string | null;
  returnNote: string | null;
};

const inches = (n: number) => `${n.toFixed(1)} in`;
const sqFt = (sqIn: number) =>
  `${(sqIn / 144).toLocaleString("en-PH", { maximumFractionDigits: 2 })} sq ft`;
const sqIn = (n: number) => `${n.toLocaleString("en-PH", { maximumFractionDigits: 1 })} sq in`;

/**
 * A roll's findings (Phase 30C, C-36), on the roll's page and its claim sheet: the defect share as
 * the key figure against the supplier limit, the defect area, then the defects by type and the
 * largest boxes as two tables whose numbers line up. A slanted cut's box is mostly clean leather
 * (D-106), so on the roll's page the largest boxes link to their photos.
 */
export function RollFindings({
  roll,
  byType,
  largest,
  linkShots = true,
}: {
  roll: FindingsRoll;
  byType: TypeFinding[];
  largest: LargeDefect[];
  linkShots?: boolean;
}) {
  const measured = roll.defectSharePct !== null && roll.defectAreaSqIn !== null;
  const limit = formatPct(roll.returnLimitPct ?? 10);

  return (
    <section aria-labelledby="findings-heading" className="flex flex-col gap-4">
      <h2 id="findings-heading" className="text-xl font-semibold">
        How damaged is this roll?
      </h2>

      <Card aria-label="Defect share">
        <CardContent className="flex flex-col gap-4 pt-5">
          {!roll.finishedAt ? (
            <p className="text-muted-foreground">
              This is worked out when the roll is finished at Capture.
            </p>
          ) : (
            <>
              <dl className="flex flex-wrap gap-x-16 gap-y-5">
                <Stat
                  label="Part of the roll with defects"
                  value={measured ? formatPct(roll.defectSharePct!) : "Not worked out"}
                  valueTestId="defect-share"
                >
                  {measured
                    ? roll.markedForReturn
                      ? `Over the ${limit} limit`
                      : `Within the ${limit} limit`
                    : "Some photos came from a phone that wasn’t set up, or the roll has no size in Inventory. You can still send it back."}
                </Stat>
                {measured && (
                  <Stat label="Area with defects" value={sqFt(roll.defectAreaSqIn!)}>
                    {sqIn(roll.defectAreaSqIn!)}
                  </Stat>
                )}
              </dl>
              {(roll.returnDecision || roll.returnNote) && (
                <p className="text-sm">
                  {roll.returnDecision === "RETURNED" &&
                    `Sent back to the supplier${roll.returnedOn ? ` on ${formatCalendarDate(roll.returnedOn)}` : ""}. `}
                  {roll.returnDecision === "KEPT" && "Kept. "}
                  {roll.returnNote && (
                    <>
                      <span className="text-muted-foreground">
                        {roll.returnDecision === "KEPT" ? "Why it was kept: " : "Note: "}
                      </span>
                      {roll.returnNote}
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {(byType.length > 0 || largest.length > 0) && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {byType.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="font-medium">Defects found</h3>
              <Table label="Defects found">
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead numeric>Found</TableHead>
                    <TableHead numeric>Rejected</TableHead>
                    <TableHead numeric>Longest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byType.map((t) => (
                    <TableRow key={t.label}>
                      <TableCell className="font-medium">{t.label}</TableCell>
                      <TableCell numeric>{t.count}</TableCell>
                      <TableCell numeric>{t.notAccepted}</TableCell>
                      <TableCell numeric>
                        {t.longestIn !== null ? inches(t.longestIn) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {largest.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="font-medium">Largest defects</h3>
              <p className="text-sm text-muted-foreground">
                Check these photos before you decide. A long, slanted cut can look bigger here than
                it really is.
              </p>
              <Table label="Largest defects">
                <TableHeader>
                  <TableRow>
                    <TableHead>Shot</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead numeric>Length</TableHead>
                    <TableHead numeric>Area</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {largest.map((d, i) => (
                    <TableRow key={`${d.scanId}-${i}`}>
                      <TableCell className="tabular-nums">
                        {linkShots ? (
                          <Link
                            href={`/scans/${d.scanId}`}
                            className="underline underline-offset-4"
                          >
                            Shot #{d.sequence}
                          </Link>
                        ) : (
                          <>Shot #{d.sequence}</>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell numeric>{inches(d.lengthIn)}</TableCell>
                      <TableCell numeric>{sqIn(d.areaSqIn)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.outcome ? OUTCOME_LABELS[d.outcome] : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
