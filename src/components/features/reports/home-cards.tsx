import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BarList } from "@/components/features/charts/bar-list";
import { SplitBar } from "@/components/features/charts/split-bar";
import { VERDICT_SERIES } from "@/components/features/charts/verdict-legend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDayLabel, formatPercent } from "@/lib/format";

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

type Totals = { scanned: number; pass: number; reject: number };

/** FM home: today's sections by final verdict, as counts with a 100% bar. */
export function InspectionSplitCard({ totals }: { totals: Totals }) {
  const decided = totals.pass + totals.reject;
  return (
    <Card data-testid="inspection-split">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Today’s inspection split</CardTitle>
            <CardDescription>
              {totals.scanned === 0
                ? "No sections scanned yet today."
                : `${totals.scanned} sections scanned, by verdict. Rejected ones are for salvage.`}
            </CardDescription>
          </div>
          <CardLink href="/reports?preset=today">Report</CardLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SplitBar counts={totals} />
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2 text-sm">
          {VERDICT_SERIES.map((s) => (
            <div key={s.key}>
              <dt className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.label}
              </dt>
              <dd className="text-xl font-semibold tabular-nums" data-testid={`split-${s.key}`}>
                {totals[s.key]}
              </dd>
              <dd className="text-xs text-muted-foreground tabular-nums">
                {formatPercent(decided > 0 ? totals[s.key] / decided : null)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

type Day = Totals & { day: string };

/** FM home: yesterday next to today, with the way to the full report and CSV. */
export function DailySummaryCard({ yesterday, today }: { yesterday: Day; today: Day }) {
  const rows: { label: string; value: (d: Day) => string }[] = [
    { label: "Scanned", value: (d) => String(d.scanned) },
    { label: "Passed", value: (d) => String(d.pass) },
    { label: "Rejected (for salvage)", value: (d) => String(d.reject) },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily summary</CardTitle>
        <CardDescription>Yesterday and today so far (Manila time).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-normal">
                <span className="sr-only">Measure</span>
              </th>
              <th className="py-1 text-right font-normal">{formatDayLabel(yesterday.day)}</th>
              <th className="py-1 text-right font-normal">Today</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums">{r.value(yesterday)}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{r.value(today)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-4">
          <CardLink href="/reports">Reports</CardLink>
          <a
            href={`/api/v1/reports/daily.csv?preset=14d`}
            download
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Download 14-day CSV
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

type Defect = { key: string; label: string; known: boolean; scans: number };

/** QI home: today's defects by type. */
export function DefectsTodayCard({ defects }: { defects: Defect[] }) {
  return (
    <Card data-testid="defects-today">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Defects by type</CardTitle>
            <CardDescription>Today, by each section’s strongest detection.</CardDescription>
          </div>
          <CardLink href="/reports?preset=today">Report</CardLink>
        </div>
      </CardHeader>
      <CardContent>
        {defects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No defects detected today.</p>
        ) : (
          <BarList
            label="Defects today"
            items={defects.slice(0, 6).map((d) => ({
              id: d.key,
              label: d.known ? d.label : `${d.label} (unknown)`,
              value: d.scans,
              muted: !d.known,
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
