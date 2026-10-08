/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, who runs the production floor (Operations), and the Quality
 *        Inspector, who needs the inspection numbers (Quality). Desktop, end of shift or all day.
 * What:  Floor Manager: what is happening on the floor in these days and right now, and what is
 *        wrong. Quality Inspector: how the checkpoint before cutting did, and the repair station.
 * Worst: a problem hidden under averages (a stuck batch, an empty shelf), a number read as
 *        something else, or anyone singled out. Every figure says what it counts; everything is
 *        per day, stage, batch, item, supplier or defect type, never per person (D-008, D-033).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Download } from "lucide-react";
import { OperationsView } from "./_components/operations-view";
import { QualityView } from "./_components/quality-view";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import { formatDayLabel, formatManilaDateTime } from "@/lib/format";
import { PRESETS, parseRange } from "@/lib/report-rules";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { operationsReport, repairStation } from "@/server/services/ops-report.service";
import { qualityReport } from "@/server/services/report.service";
import { reportQuerySchema } from "@/server/validators/report.validator";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requirePermission("report:quality");
  await connection();
  const query = reportQuerySchema.parse(await searchParams);
  const range = parseRange(query);
  // The Floor Manager lands on Operations; the Quality Inspector only has Quality.
  const canOperations = can(user.role, "report:production");
  const view = canOperations && query.view !== "quality" ? "operations" : "quality";
  const now = new Date();

  const [operations, quality, repairs] = await Promise.all([
    view === "operations" ? operationsReport(range, now) : null,
    view === "quality" ? qualityReport(range) : null,
    view === "quality" ? repairStation(range, now) : null,
  ]);

  const qs = `from=${range.from}&to=${range.to}`;
  const title =
    range.days === 1
      ? formatDayLabel(range.from)
      : `${formatDayLabel(range.from)} – ${formatDayLabel(range.to)}`;
  const keep = (extra: string) => `/reports?view=${view}&${extra}`;
  const csvLinks =
    view === "operations"
      ? [
          { href: `/api/v1/reports/operations.csv?${qs}`, label: "Operations CSV" },
          { href: `/api/v1/reports/stock.csv?${qs}`, label: "Stock CSV" },
          { href: `/api/v1/reports/stages.csv?${qs}`, label: "Stages CSV" },
        ]
      : [
          { href: `/api/v1/reports/daily.csv?${qs}`, label: "Daily CSV" },
          { href: `/api/v1/reports/defects.csv?${qs}`, label: "Defects CSV" },
        ];

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          view === "operations"
            ? "What is happening on the floor, and what needs attention. Never per person."
            : "The checkpoint before cutting, and the repair station. Never per person."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {csvLinks.map((l) => (
              <Button key={l.href} asChild variant="secondary">
                <a href={l.href} download>
                  <Download aria-hidden />
                  {l.label}
                </a>
              </Button>
            ))}
          </div>
        }
      />

      {canOperations && (
        <nav aria-label="Report" className="flex gap-6 border-b">
          {(
            [
              { id: "operations", label: "Operations" },
              { id: "quality", label: "Quality" },
            ] as const
          ).map((tab) => (
            <Link
              key={tab.id}
              href={`/reports?view=${tab.id}&${qs}`}
              aria-current={view === tab.id ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-1 pb-2 text-lg font-medium",
                view === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Report range" className="flex gap-1 rounded-md border p-1">
          {PRESETS.map((p) => (
            <Link
              key={p.id}
              href={keep(`preset=${p.id}`)}
              aria-current={range.preset === p.id ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium",
                range.preset === p.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex items-end gap-2" aria-label="Custom range">
          <input type="hidden" name="view" value={view} />
          <label className="flex flex-col gap-1 text-sm">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              max={range.to}
              className="h-9 rounded-md border border-input bg-card px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            To
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              className="h-9 rounded-md border border-input bg-card px-3"
            />
          </label>
          <Button type="submit" variant="secondary">
            Show
          </Button>
        </form>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="report-range">
        {title} · {range.days} day{range.days === 1 ? "" : "s"} · as of {formatManilaDateTime(now)}
      </p>

      {operations && <OperationsView report={operations} range={range} />}
      {quality && repairs && <QualityView quality={quality} repairs={repairs} days={range.days} />}
    </>
  );
}
