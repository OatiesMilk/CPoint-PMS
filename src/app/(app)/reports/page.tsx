/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, who runs the production floor. Reports are theirs alone (Phase 28,
 *        D-100). Desktop, end of shift or all day.
 * What:  Operations: what is happening on the floor in these days and right now, and what is
 *        wrong. Quality: how the checkpoint before cutting did: Pass, Reject and the defects.
 * Worst: a problem hidden under averages (a short day, an empty shelf), a number read as
 *        something else, or anyone singled out. Every figure says what it counts; everything is
 *        per day, batch, roll, item, supplier or defect type, never per person (D-008, D-033).
 *        Rolls (Phase 26) has its own page, /reports/rolls.
 */
import { appNow } from "@/lib/clock";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Download } from "lucide-react";
import { OperationsView } from "./_components/operations-view";
import { defectFilterText } from "./_components/filter-text";
import { QualityView } from "./_components/quality-view";
import { ReportTabs } from "./_components/report-tabs";
import { PageHeader } from "@/components/features/page-header";
import { PeriodPicker } from "@/components/features/reports/period-picker";
import { PrintButton } from "@/components/features/reports/print-button";
import { PrintHeader, PrintPage } from "@/components/features/reports/print-header";
import { ReportFooter } from "@/components/features/reports/report-footer";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/domain";
import { formatManilaDateTime, manilaToday } from "@/lib/format";
import { PERIOD_PARAMS, parseRange } from "@/lib/report-rules";
import { hasRepairFilters } from "@/lib/repair-rules";
import { parseSort, sortText } from "@/lib/table-sort";
import { requirePermission } from "@/server/policies/guard";
import { operationsReport } from "@/server/services/ops-report.service";
import { finalDefectTypeOptions } from "@/server/services/repair.service";
import { supplierOptions } from "@/server/services/roll.service";
import { defectOptions, qualityReport } from "@/server/services/report.service";
import { reportQuerySchema } from "@/server/validators/report.validator";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requirePermission("report:production");
  await connection();
  const query = reportQuerySchema.parse(await searchParams);
  const range = parseRange(query);
  // The Floor Manager lands on Operations; Quality is the other tab.
  const view = query.view === "quality" ? "quality" : "operations";
  const now = appNow();
  const sort = parseSort(query.sort, query.dir);
  const filters = {
    defect: query.defect,
    remedy: query.remedy,
    stage: query.stage,
    supplierId: query.supplierId,
  };

  const [operations, quality, finalTypes, suppliers, leatherDefects] = await Promise.all([
    view === "operations" ? operationsReport(range, now, filters) : null,
    view === "quality" ? qualityReport(range) : null,
    view === "operations" ? finalDefectTypeOptions() : [],
    view === "operations" ? supplierOptions() : [],
    view === "quality" ? defectOptions() : [],
  ]);

  // The period's own params, so another tab or a CSV shows the same period.
  const periodQs = new URLSearchParams();
  for (const k of PERIOD_PARAMS) {
    const v = query[k as keyof typeof query];
    if (typeof v === "string" && v) periodQs.set(k, v);
  }
  const qs = `from=${range.from}&to=${range.to}`;
  const csvQs = (extra: Record<string, string | undefined>) => {
    const next = new URLSearchParams(qs);
    for (const [k, v] of Object.entries(extra)) if (v) next.set(k, v);
    return next.toString();
  };
  const csvLinks =
    view === "operations"
      ? [
          { href: `/api/v1/reports/operations.csv?${qs}`, label: "Operations CSV" },
          { href: `/api/v1/reports/stock.csv?${qs}`, label: "Stock CSV" },
          { href: `/api/v1/reports/production.csv?${qs}`, label: "Production CSV" },
        ]
      : [
          { href: `/api/v1/reports/daily.csv?${qs}`, label: "Daily CSV" },
          {
            href: `/api/v1/reports/defects.csv?${csvQs({ defect: query.defect })}`,
            label: "Defects CSV",
          },
        ];

  const notes = [
    view === "operations" && hasRepairFilters(filters)
      ? `Filtered (defect cards): ${defectFilterText(filters, finalTypes)}`
      : null,
    view === "operations" && filters.supplierId
      ? `Filtered (Supplier quality): ${suppliers.find((x) => x.id === filters.supplierId)?.name ?? "supplier"}`
      : null,
    view === "quality" && query.defect
      ? `Filtered (defects): ${leatherDefects.find((d) => d.key === query.defect)?.label ?? query.defect}`
      : null,
    sortText(sort),
  ].filter((x): x is string => Boolean(x));

  return (
    <>
      <PrintPage />
      <PageHeader
        title="Reports"
        description={
          view === "operations"
            ? "What is happening on the floor, and what needs attention. Never per person."
            : "The checkpoint before cutting: Pass, Reject and the defects. Never per person."
        }
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {csvLinks.map((l) => (
              <Button key={l.href} asChild variant="secondary">
                <a href={l.href} download>
                  <Download aria-hidden />
                  {l.label}
                </a>
              </Button>
            ))}
            <PrintButton label="Print" variant="secondary" />
          </div>
        }
      />

      <ReportTabs current={view} qs={periodQs.toString()} />

      <PrintHeader
        report={view === "operations" ? "Operations" : "Quality"}
        period={`${range.label} · ${range.days} day${range.days === 1 ? "" : "s"}`}
        preparedBy={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
        notes={notes}
        printedAt={now}
      />

      <PeriodPicker range={range} today={manilaToday(now)} fixed={{ view }} />

      <p className="text-sm text-muted-foreground" data-testid="report-range">
        {range.label} · {range.days} day{range.days === 1 ? "" : "s"} · as of{" "}
        {formatManilaDateTime(now)}
      </p>

      {operations && (
        <OperationsView
          report={operations}
          range={range}
          sort={sort}
          filters={filters}
          finalTypes={finalTypes}
          suppliers={suppliers.map((x) => ({ id: x.id, name: x.name }))}
        />
      )}
      {quality && (
        <QualityView
          quality={quality}
          sort={sort}
          defect={query.defect}
          defectChoices={leatherDefects}
        />
      )}

      <ReportFooter />
    </>
  );
}
