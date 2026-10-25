"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayLabel } from "@/lib/format";

export type ProductionChartDay = {
  day: string;
  pairs: number;
  quota: number | null;
  constructorsPresent: number | null;
};

const SERIES = [
  { key: "pairs", label: "Pairs passed", color: "var(--chart-bar)", mark: "bar" },
  { key: "quota", label: "Daily quota", color: "var(--foreground)", mark: "dash" },
  {
    key: "constructorsPresent",
    label: "Shoe Constructors present (right axis)",
    color: "var(--chart-info)",
    mark: "dot",
  },
] as const;

/**
 * Pairs passed per working day against the quota (D-086, C-41), with the Shoe Constructors present on
 * a second axis, so a short day and a short-handed day line up. The quota is a dashed line and is
 * named in the legend, not told by colour alone. The Recent days table is its table view.
 */
export function ProductionChart({ days }: { days: ProductionChartDay[] }) {
  const below = days.filter((d) => d.quota !== null && d.pairs < d.quota).length;
  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            {s.mark === "bar" ? (
              <span aria-hidden className="size-3 rounded-sm" style={{ background: s.color }} />
            ) : s.mark === "dash" ? (
              <span
                aria-hidden
                className="w-4 border-t-2 border-dashed"
                style={{ borderColor: s.color }}
              />
            ) : (
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
            )}
            {s.label}
          </li>
        ))}
      </ul>
      <div
        className="h-64"
        role="img"
        aria-label={`Pairs passed per day against the daily quota, ${days.length} working days, ${below} below quota`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              yAxisId="pairs"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              yAxisId="people"
              orientation="right"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-grid)", opacity: 0.6 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ProductionChartDay;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-2">
                    <p className="mb-1 font-medium">{formatDayLabel(String(label))}</p>
                    <p className="tabular-nums">
                      {d.pairs} pairs passed{d.quota !== null ? ` of ${d.quota}` : ", no quota"}
                    </p>
                    <p className="text-muted-foreground tabular-nums">
                      {d.constructorsPresent === null
                        ? "Attendance not taken"
                        : `${d.constructorsPresent} Shoe Constructors present`}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              yAxisId="pairs"
              dataKey="pairs"
              name="Pairs passed"
              fill="var(--chart-bar)"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              yAxisId="pairs"
              dataKey="quota"
              name="Daily quota"
              type="stepAfter"
              stroke="var(--foreground)"
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="people"
              dataKey="constructorsPresent"
              name="Shoe Constructors present"
              type="monotone"
              stroke="var(--chart-info)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--chart-info)" }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-sm text-muted-foreground">
        {below === 0
          ? `Every day with a quota met it in these ${days.length} working days.`
          : `${below} of these ${days.length} working days ${below === 1 ? "was" : "were"} below quota.`}
      </figcaption>
    </figure>
  );
}
