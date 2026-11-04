import { CircleCheck, CircleX, type LucideIcon } from "lucide-react";

export type VerdictKey = "passed" | "returned";

/**
 * The two roll outcomes in their fixed stacking and legend order (never re-ordered by value):
 * Scanning passed and Returned to supplier (D-116, D-117). Colors are the chart steps validated in
 * light and dark (tokens.css → charts, D-025).
 */
export const VERDICT_SERIES: { key: VerdictKey; label: string; color: string; Icon: LucideIcon }[] =
  [
    { key: "passed", label: "Scanning passed", color: "var(--chart-pass)", Icon: CircleCheck },
    { key: "returned", label: "Returned to supplier", color: "var(--chart-reject)", Icon: CircleX },
  ];

/** Swatch + icon + label in text colour, so identity never rests on colour alone. */
export function VerdictLegend({ keys }: { keys?: VerdictKey[] }) {
  const series = keys ? VERDICT_SERIES.filter((s) => keys.includes(s.key)) : VERDICT_SERIES;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Legend">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: s.color }} />
          <s.Icon aria-hidden className="size-3.5 text-muted-foreground" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
