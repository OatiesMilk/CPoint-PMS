"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayLabel } from "@/lib/format";
import { VERDICT_SERIES, VerdictLegend } from "./verdict-legend";

type Day = {
  day: string;
  rolls: number;
  passed: number;
  returned: number;
};

/**
 * Rolls finished at Capture per Manila day, stacked passed and returned to supplier (D-117; dataviz: stacked columns for part-to-whole over
 * time). Fixed series order, 2px surface gaps, rounded data end on the top segment, recessive
 * grid, hover tooltip. The daily table on the same page is its table view.
 */
export function VerdictTrendChart({ days }: { days: Day[] }) {
  const lastWithData = [...days].reverse().find((d) => d.rolls > 0);
  return (
    <figure className="flex flex-col gap-3">
      <VerdictLegend />
      <div
        className="h-64"
        role="img"
        aria-label={`Rolls scanned per day, passed or returned to supplier, ${days.length} days`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={days}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="25%"
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
              width={40}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-grid)", opacity: 0.6 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-2">
                    <p className="mb-1 font-medium">
                      {formatDayLabel(String(label))} · {(payload[0].payload as Day).rolls} rolls
                      scanned
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {VERDICT_SERIES.map((s) => (
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
            {VERDICT_SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="v"
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={24}
                radius={i === VERDICT_SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {lastWithData && (
        <figcaption className="text-sm text-muted-foreground">
          Latest day with rolls scanned: {formatDayLabel(lastWithData.day)}, {lastWithData.rolls}{" "}
          {lastWithData.rolls === 1 ? "roll" : "rolls"} ({lastWithData.passed} passed,{" "}
          {lastWithData.returned} returned to supplier).
        </figcaption>
      )}
    </figure>
  );
}
