import { BarList } from "@/components/features/charts/bar-list";
import { Stat } from "@/components/features/kpi-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/features/reports/sortable-header";
import { formatPercent } from "@/lib/format";
import { STAGES } from "@/lib/repair-rules";
import { sortFor, type SortKey, type SortState } from "@/lib/table-sort";
import type { OperationsReport } from "@/server/services/ops-report.service";
import type { ReactNode } from "react";

const n = (v: number) => v.toLocaleString("en-PH");
const stageKey = (stage: string) => stage.toLowerCase().replace("_", "-");

/** What each card needs to show a filter: the "Filtered: …" line, and a no-match message. */
type Filtering = { sort: SortState | null; filtered: boolean; note: ReactNode };

type FinalRow = OperationsReport["finalDefects"]["rows"][number];
const FINAL_KEYS: Record<string, SortKey<FinalRow>> = {
  defect: (r) => r.label,
  "pairs-found": (r) => r.pairs,
  "share-of-failed": (r) => r.shareOfFailed,
  fixable: (r) => r.fixableShare,
  scrapped: (r) => r.scrapped,
};

type OriginRow = OperationsReport["origins"]["rows"][number];
const ORIGIN_KEYS: Record<string, SortKey<OriginRow>> = {
  defect: (r) => r.label,
  scrapped: (r) => r.scrapped,
  ...Object.fromEntries(
    STAGES.map((s) => [stageKey(s), (r: OriginRow) => r.byStage.find((b) => b.stage === s)?.pairs]),
  ),
};

type WipStageRow = OperationsReport["wip"]["stages"][number];
const WIP_STAGE_KEYS: Record<string, SortKey<WipStageRow>> = {
  stage: (r) => r.label,
  "days-counted": (r) => r.days,
  average: (r) => r.average,
  highest: (r) => r.highest,
  latest: (r) => r.latest,
};

type WipDayRow = OperationsReport["wip"]["perDay"][number];
const WIP_DAY_KEYS: Record<string, SortKey<WipDayRow>> = {
  day: (r) => r.day,
  ...Object.fromEntries(STAGES.map((s) => [stageKey(s), (r: WipDayRow) => r.counts[s]])),
};

/**
 * The four sections Phase 34 adds to Reports → Operations (D-130): final defects, where they come
 * from, repairs and work in progress. Counts and shares per defect, stage or day for the whole
 * line, never per person (D-008). Phase 35 adds periods, sort, filter and print to all of them.
 */
export function FinalDefectsCard({
  report,
  sort,
  filtered,
  note,
}: { report: OperationsReport } & Filtering) {
  const d = report.finalDefects;
  return (
    <Card data-testid="final-defects">
      <CardHeader>
        <CardTitle>Final defects</CardTitle>
        <CardDescription>
          What the Quality Inspector found on the pairs that failed inspection, by defect type. A
          failed pair from before reasons were recorded shows as “Reason not recorded”, so the
          totals still add up.
        </CardDescription>
        {note}
      </CardHeader>
      <CardContent>
        {d.rows.length === 0 && d.notRecorded === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filtered
              ? "No final defects match these filters."
              : "No pair failed inspection in this range."}
          </p>
        ) : (
          <Table data-testid="final-defects-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader table="final-defects" column="defect">
                  Defect
                </SortableHeader>
                <SortableHeader table="final-defects" column="pairs-found" numeric>
                  Pairs found
                </SortableHeader>
                <SortableHeader table="final-defects" column="share-of-failed" numeric>
                  Share of failed
                </SortableHeader>
                <SortableHeader table="final-defects" column="fixable" numeric>
                  Fixable
                </SortableHeader>
                <SortableHeader table="final-defects" column="scrapped" numeric>
                  Scrapped (not fixable)
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortFor(sort, "final-defects", d.rows, FINAL_KEYS).map((r) => (
                <TableRow key={r.id} aria-label={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell numeric>{n(r.pairs)}</TableCell>
                  <TableCell numeric>{formatPercent(r.shareOfFailed)}</TableCell>
                  <TableCell numeric>{formatPercent(r.fixableShare)}</TableCell>
                  <TableCell numeric>{n(r.scrapped)}</TableCell>
                </TableRow>
              ))}
              {d.notRecorded > 0 && (
                <TableRow className="text-muted-foreground" aria-label="Reason not recorded">
                  <TableCell>Reason not recorded</TableCell>
                  <TableCell numeric>{n(d.notRecorded)}</TableCell>
                  <TableCell numeric>{formatPercent(d.notRecorded / d.totalFailed)}</TableCell>
                  <TableCell numeric>–</TableCell>
                  <TableCell numeric>–</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function DefectOriginsCard({
  report,
  sort,
  filtered,
  note,
}: { report: OperationsReport } & Filtering) {
  const o = report.origins;
  return (
    <Card data-testid="defect-origins">
      <CardHeader>
        <CardTitle>Where defects come from</CardTitle>
        <CardDescription>
          For each defect, the stage the fixable pairs went back to (the stage where it was made),
          and the pairs that could not be fixed. Counts, with each stage’s share of that defect.
        </CardDescription>
        {note}
      </CardHeader>
      <CardContent>
        {o.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filtered ? "No defects match these filters." : "No defect was recorded in this range."}
          </p>
        ) : (
          <Table data-testid="defect-origins-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader table="defect-origins" column="defect">
                  Defect
                </SortableHeader>
                {o.stages.map((s) => (
                  <SortableHeader
                    key={s.stage}
                    table="defect-origins"
                    column={stageKey(s.stage)}
                    numeric
                  >
                    {s.label}
                  </SortableHeader>
                ))}
                <SortableHeader table="defect-origins" column="scrapped" numeric>
                  Scrapped (not fixable)
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortFor(sort, "defect-origins", o.rows, ORIGIN_KEYS).map((r) => (
                <TableRow key={r.id} aria-label={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  {r.byStage.map((s) => (
                    <TableCell key={s.stage} numeric>
                      {n(s.pairs)}
                      {s.share !== null && s.pairs > 0 && (
                        <span className="text-muted-foreground"> · {formatPercent(s.share)}</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell numeric>
                    {n(r.scrapped)}
                    {r.scrappedShare !== null && r.scrapped > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatPercent(r.scrappedShare)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function RepairsCard({
  report,
  filtered,
  note,
}: { report: OperationsReport } & Omit<Filtering, "sort">) {
  const r = report.repairs;
  return (
    <Card data-testid="repairs-section">
      <CardHeader>
        <CardTitle>Repairs</CardTitle>
        <CardDescription>
          The fixable pairs sent back to a stage in this range, in pairs, and how they ended.
        </CardDescription>
        {note}
      </CardHeader>
      <CardContent>
        {filtered && r.sent === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">No repairs match these filters.</p>
        )}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4 gap-y-5">
          <Stat label="Sent" value={n(r.sent)} />
          <Stat label="Back for inspection" value={n(r.back)} />
          <Stat label="Passed" value={n(r.passed)} />
          <Stat label="Scrapped" value={n(r.scrapped)} />
          <Stat label="Sent again" value={n(r.sentAgain)} />
          <Stat label="Still at a stage" value={n(r.stillOpen)} />
          <Stat
            label="Average time to inspection"
            value={r.averageHours === null ? "–" : `${r.averageHours} h`}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

export function WipReportCard({
  report,
  sort,
}: {
  report: OperationsReport;
  sort: SortState | null;
}) {
  const w = report.wip;
  return (
    <Card data-testid="wip-section">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Work in progress</CardTitle>
            <CardDescription>
              Pairs at each stage, from the counts the people there enter. Each day’s last count
              stands for that day. The stage with the highest average is where pairs wait most.
            </CardDescription>
          </div>
          <CardLink href="/batches?tab=wip">Today’s board</CardLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {w.counted === 0 ? (
          <p className="text-sm text-muted-foreground">No stage was counted in this range.</p>
        ) : (
          <>
            <Table data-testid="wip-stage-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHeader table="wip-stages" column="stage">
                    Stage
                  </SortableHeader>
                  <SortableHeader table="wip-stages" column="days-counted" numeric>
                    Days counted
                  </SortableHeader>
                  <SortableHeader table="wip-stages" column="average" numeric>
                    Average
                  </SortableHeader>
                  <SortableHeader table="wip-stages" column="highest" numeric>
                    Highest
                  </SortableHeader>
                  <SortableHeader table="wip-stages" column="latest" numeric>
                    Latest
                  </SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortFor(sort, "wip-stages", w.stages, WIP_STAGE_KEYS).map((s) => (
                  <TableRow key={s.stage} aria-label={s.label}>
                    <TableCell className="font-medium">{s.label}</TableCell>
                    <TableCell numeric>{s.days}</TableCell>
                    <TableCell numeric>{s.average ?? "–"}</TableCell>
                    <TableCell numeric>{s.highest ?? "–"}</TableCell>
                    <TableCell numeric>{s.latest ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              <h3 className="mb-2 text-sm font-medium">Average pairs at each stage</h3>
              <BarList
                label="Average pairs at each stage"
                items={w.stages.map((s) => ({
                  id: s.stage,
                  label: s.label,
                  value: s.average ?? 0,
                  valueLabel: s.average === null ? "Not counted" : `${s.average} pairs`,
                }))}
              />
            </div>
            <Table data-testid="wip-day-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHeader table="wip-days" column="day">
                    Day
                  </SortableHeader>
                  {w.stages.map((s) => (
                    <SortableHeader
                      key={s.stage}
                      table="wip-days"
                      column={stageKey(s.stage)}
                      numeric
                    >
                      {s.label}
                    </SortableHeader>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortFor(sort, "wip-days", [...w.perDay].reverse(), WIP_DAY_KEYS).map((d) => (
                  <TableRow key={d.day} aria-label={d.day}>
                    <TableCell>{d.label}</TableCell>
                    {STAGES.map((s) => (
                      <TableCell key={s} numeric>
                        {d.counts[s] ?? "–"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
