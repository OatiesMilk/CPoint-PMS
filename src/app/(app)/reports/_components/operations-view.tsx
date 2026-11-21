import { BarList } from "@/components/features/charts/bar-list";
import { ProductionChart } from "@/components/features/charts/production-chart";
import { ProductionDaysTable } from "@/components/features/production/production-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { formatDayLabel, formatManilaDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttentionList, KpiTile } from "./ops-parts";
import { Stat } from "@/components/features/kpi-tile";
import { CardLink } from "@/components/ui/card-link";
import { StockRiskCard, SupplierQualityCard } from "./ops-sections";
import { DefectOriginsCard, FinalDefectsCard, RepairsCard, WipReportCard } from "./repair-sections";
import { FilterForm, FilteredNote } from "@/components/features/reports/filters";
import { SortableHeader } from "@/components/features/reports/sortable-header";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { compareLabel, type ReportRange } from "@/lib/report-rules";
import {
  hasRepairFilters,
  REMEDY_LABEL,
  STAGE_LABEL,
  STAGES,
  type Remedy,
} from "@/lib/repair-rules";
import { sortFor, type SortKey, type SortState } from "@/lib/table-sort";
import type { OperationsReport, OpsFilters } from "@/server/services/ops-report.service";
import { defectFilterText } from "./filter-text";

const DEFECT_FILTERS = ["defect", "remedy", "stage"] as const;

type DailyRow = OperationsReport["days"][number];
const DAILY_KEYS: Record<string, SortKey<DailyRow>> = {
  day: (d) => d.day,
  "rolls-started": (d) => d.started,
  "rolls-scanned": (d) => d.rolls,
  "scanning-passed": (d) => d.passed,
  "returned-to-supplier": (d) => d.returned,
};

/**
 * The Floor Manager's report: what is happening on the production floor in this range, and what
 * is wrong. Order follows the questions: is anything on fire, did the line make its quota (and
 * how many were present), will we run out, is supply good, and the checkpoint before cutting in
 * brief. Stage monitoring was replaced by production in Phase 23, and production by batches in
 * Phase 27. Since D-117 the camera's side counts whole rolls, passed or returned to supplier.
 */
export function OperationsView({
  report,
  range,
  sort,
  filters,
  finalTypes,
  suppliers,
}: {
  report: OperationsReport;
  range: ReportRange;
  sort: SortState | null;
  filters: OpsFilters;
  finalTypes: { key: string; label: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const { kpis, production, checkpoint } = report;
  const compare = compareLabel(range);
  const filtered = hasRepairFilters(filters);
  const note = filtered ? (
    <FilteredNote owns={DEFECT_FILTERS} text={defectFilterText(filters, finalTypes)} />
  ) : null;
  const shownSuppliers = filters.supplierId
    ? report.suppliers.filter((x) => x.id === filters.supplierId)
    : report.suppliers;
  const t = checkpoint.totals;
  const ofRolls = (n: number) => `${n} of ${t.rolls} ${t.rolls === 1 ? "roll" : "rolls"} scanned`;
  const quotaNote =
    production.totals.daysWithQuota === 0
      ? "no finished day with a quota yet"
      : `${production.totals.daysBelow} of ${production.totals.daysWithQuota} days below quota`;

  return (
    <>
      <section
        aria-label="Key figures"
        className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4"
      >
        <KpiTile
          label="Pairs finished"
          value={(kpis.pairs.value ?? 0).toLocaleString("en-PH")}
          sub="all pairs the QI counted at Finish batch, failed ones included"
          change={kpis.pairs.change}
          compareLabel={compare}
          testid="kpi-pairs"
        />
        <KpiTile
          label="Failed inspection"
          value={(kpis.failedPairs.value ?? 0).toLocaleString("en-PH")}
          sub={
            production.totals.failedShare === null
              ? "of the pairs finished"
              : `${formatPercent(production.totals.failedShare)} of the pairs finished`
          }
          change={kpis.failedPairs.change}
          compareLabel={compare}
          testid="kpi-failed"
        />
        <KpiTile
          label="Of quota"
          value={formatPercent(kpis.ofQuota.value)}
          sub={`passed pairs; ${quotaNote}`}
          change={kpis.ofQuota.change}
          compareLabel={compare}
          testid="kpi-quota"
        />
        <KpiTile
          label="Rolls passed"
          value={formatPercent(kpis.rollsPassed.value)}
          sub={ofRolls(t.passed)}
          change={kpis.rollsPassed.change}
          compareLabel={compare}
          testid="kpi-rolls-passed"
        />
        <KpiTile
          label="Returned to supplier"
          value={formatPercent(kpis.rollsReturned.value)}
          sub={ofRolls(t.returned)}
          change={kpis.rollsReturned.change}
          compareLabel={compare}
          testid="kpi-returned"
        />
      </section>

      <AttentionList items={report.attention} asOf={formatManilaDateTime(report.asOf)} />

      <Card data-testid="production-section">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Production</CardTitle>
              <CardDescription>
                Per working day the pairs finished, how many failed inspection, and the pairs that
                passed against the daily quota, with the Shoe Constructors present. Each shortfall
                gets one sentence from the day’s numbers, never a name.
              </CardDescription>
            </div>
            <CardLink href="/batches">Today’s batches</CardLink>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {production.days.length > 0 && (
            <ProductionChart
              days={production.days.map((d) => ({
                day: d.day,
                pairs: d.passed,
                quota: d.quota,
                constructorsPresent: d.constructorsPresent,
              }))}
            />
          )}
          <ProductionDaysTable days={production.days} testid="ops-production-table" sort={sort} />
        </CardContent>
      </Card>

      <section aria-label="Defect filters" className="flex flex-col gap-2">
        <FilterForm owns={DEFECT_FILTERS} label="Defect filters" active={filtered}>
          <div className="flex w-full flex-col gap-1.5 sm:w-56">
            <Label htmlFor="filter-defect">Defect type</Label>
            <Select id="filter-defect" name="defect" defaultValue={filters.defect ?? ""}>
              <option value="">All defect types</option>
              {finalTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-44">
            <Label htmlFor="filter-remedy">Fixable</Label>
            <Select id="filter-remedy" name="remedy" defaultValue={filters.remedy ?? ""}>
              <option value="">Fixable or not</option>
              {(Object.keys(REMEDY_LABEL) as Remedy[]).map((r) => (
                <option key={r} value={r}>
                  {REMEDY_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-44">
            <Label htmlFor="filter-stage">Stage</Label>
            <Select id="filter-stage" name="stage" defaultValue={filters.stage ?? ""}>
              <option value="">All stages</option>
              {STAGES.map((st) => (
                <option key={st} value={st}>
                  {STAGE_LABEL[st]}
                </option>
              ))}
            </Select>
          </div>
        </FilterForm>
        <p className="text-sm text-muted-foreground print:hidden">
          Filters the three defect cards below: Final defects, Where defects come from and Repairs.
          The key figures above stay for the whole line.
        </p>
      </section>

      <FinalDefectsCard report={report} sort={sort} filtered={filtered} note={note} />
      <DefectOriginsCard report={report} sort={sort} filtered={filtered} note={note} />
      <RepairsCard report={report} filtered={filtered} note={note} />
      <WipReportCard report={report} sort={sort} />

      <StockRiskCard stock={report.stock} days={range.days} sort={sort} />

      <SupplierQualityCard
        sort={sort}
        supplierId={filters.supplierId}
        supplierChoices={suppliers}
        suppliers={shownSuppliers}
        rolls={report.mostDefects}
        lineReturnedShare={report.lineReturnedShare}
        rangeQuery={`from=${range.from}&to=${range.to}${filters.supplierId ? `&supplierId=${filters.supplierId}` : ""}`}
      />

      <Card data-testid="checkpoint">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Checkpoint before cutting</CardTitle>
              <CardDescription>
                The leather rolls the camera checked before cutting, finished at Capture in this
                range: passed, or returned to supplier when defects covered more than the limit of
                the roll. The full report is in the Quality tab.
              </CardDescription>
            </div>
            <CardLink href="/reports?view=quality">Quality report</CardLink>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
          <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-5">
            <Stat label="Rolls scanned" value={t.rolls} />
            <Stat label="Scanning passed" value={t.passed} />
            <Stat label="Returned to supplier" value={t.returned} />
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-medium">Top defects, by rolls found on</h3>
            {checkpoint.defects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No defects found in this range.</p>
            ) : (
              <BarList
                label="Top defects"
                items={checkpoint.defects.map((d) => ({
                  id: d.key,
                  label: d.label,
                  value: d.rolls,
                  valueLabel: `${d.rolls} ${d.rolls === 1 ? "roll" : "rolls"} · ${formatPercent(d.share)}`,
                }))}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily summary</CardTitle>
          <CardDescription>
            One row per Manila day, newest first. Same numbers as the Operations CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="ops-daily-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader table="daily" column="day">
                  Day
                </SortableHeader>
                <SortableHeader table="daily" column="rolls-started" numeric>
                  Rolls started
                </SortableHeader>
                <SortableHeader table="daily" column="rolls-scanned" numeric>
                  Rolls scanned
                </SortableHeader>
                <SortableHeader table="daily" column="scanning-passed" numeric>
                  Scanning passed
                </SortableHeader>
                <SortableHeader table="daily" column="returned-to-supplier" numeric>
                  Returned to supplier
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortFor(sort, "daily", [...report.days].reverse(), DAILY_KEYS).map((d) => (
                <TableRow
                  key={d.day}
                  aria-label={d.day}
                  className={cn(d.started + d.rolls === 0 && "text-muted-foreground")}
                >
                  <TableCell>{formatDayLabel(d.day)}</TableCell>
                  <TableCell numeric>{d.started}</TableCell>
                  <TableCell numeric>{d.rolls}</TableCell>
                  <TableCell numeric>{d.passed}</TableCell>
                  <TableCell numeric>{d.returned}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
