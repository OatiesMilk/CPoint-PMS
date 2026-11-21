import { Download } from "lucide-react";
import { Stat } from "@/components/features/kpi-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDayLabel, formatPercent } from "@/lib/format";
import { CardLink } from "@/components/ui/card-link";

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
    <Card data-testid="rolls-today" className="h-full">
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
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
          {items.map((i) => (
            <Stat key={i.key} label={i.label} value={i.value} valueTestId={`rolls-today-${i.key}`}>
              <span className="tabular-nums">{i.note}</span>
            </Stat>
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
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Daily summary</CardTitle>
        <CardDescription>Yesterday and today so far (Manila time).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
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
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-4">
          <CardLink href="/reports">Reports</CardLink>
          <a
            href={`/api/v1/reports/daily.csv?preset=14d`}
            download
            className="-mx-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-accent hover:text-foreground"
          >
            <Download aria-hidden className="size-4" />
            Download 14-day CSV
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
