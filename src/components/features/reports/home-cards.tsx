import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

type Totals = { rolls: number; passed: number; returned: number };

/**
 * FM home: today's rolls at the checkpoint (Phase 28; whole rolls since D-117): rolls scanned, of
 * them returned to supplier, and the rolls still open at Capture.
 */
export function RollsTodayCard({ totals, openRolls }: { totals: Totals; openRolls: number }) {
  const items = [
    { key: "scanned", label: "Rolls scanned", value: totals.rolls, note: "finished today" },
    {
      key: "returned",
      label: "Returned to supplier",
      value: totals.returned,
      note: `${formatPercent(totals.rolls > 0 ? totals.returned / totals.rolls : null)} of scanned`,
    },
    {
      key: "open",
      label: "Rolls still open",
      value: openRolls,
      note: "being captured now",
    },
  ];
  return (
    <Card data-testid="rolls-today">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Rolls today</CardTitle>
            <CardDescription>
              {totals.rolls === 0
                ? "No roll finished at Capture yet today."
                : "The camera check before cutting, today so far."}
            </CardDescription>
          </div>
          <CardLink href="/reports/rolls">Rolls</CardLink>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-3 text-sm">
          {items.map((i) => (
            <div key={i.key}>
              <dt className="text-muted-foreground">{i.label}</dt>
              <dd
                className="text-xl font-semibold tabular-nums"
                data-testid={`rolls-today-${i.key}`}
              >
                {i.value}
              </dd>
              <dd className="text-xs text-muted-foreground tabular-nums">{i.note}</dd>
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
    { label: "Rolls scanned", value: (d) => String(d.rolls) },
    { label: "Scanning passed", value: (d) => String(d.passed) },
    { label: "Returned to supplier", value: (d) => String(d.returned) },
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
