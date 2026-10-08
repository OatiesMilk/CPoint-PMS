"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayLabel } from "@/lib/format";

type Day = { day: string; started: number; completed: number };

const SERIES = [
  { key: "started", label: "Started", color: "var(--chart-bar-muted)" },
  { key: "completed", label: "Completed", color: "var(--chart-bar)" },
] as const;

/**
 * Batches started and completed per Manila day (grouped columns: two measures, same unit). When
 * started runs above completed for days, work is piling up. The daily table is its table view.
 */
export function FlowChart({ days }: { days: Day[] }) {
  const started = days.reduce((t, d) => t + d.started, 0);
  const completed = days.reduce((t, d) => t + d.completed, 0);
  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div
        className="h-56"
        role="img"
        aria-label={`Batches started and completed per day, ${days.length} days`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={days}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="25%"
            barGap={2}
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDayLabel}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-grid)", opacity: 0.6 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-2">
                    <p className="mb-1 font-medium">{formatDayLabel(String(label))}</p>
                    <ul className="flex flex-col gap-0.5">
                      {SERIES.map((s) => (
                        <li key={s.key} className="flex items-center justify-between gap-6">
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className="size-2.5 rounded-sm"
                              style={{ background: s.color }}
                            />
                            {s.label}
                          </span>
                          <span className="tabular-nums">{(payload[0].payload as Day)[s.key]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              }
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                maxBarSize={16}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-sm text-muted-foreground">
        {started} batches started and {completed} completed in these {days.length} days
        {started > completed ? `; ${started - completed} more went in than came out.` : "."}
      </figcaption>
    </figure>
  );
}
