import { CircleCheck, CircleX, type LucideIcon } from "lucide-react";

export type VerdictKey = "pass" | "reject";

/**
 * The two verdict series in their fixed stacking and legend order (never re-ordered by value).
 * Colors are the chart steps validated in light and dark (tokens.css → charts, D-025, D-093). A
 * rejected section is reported "for salvage" (A-11).
 */
export const VERDICT_SERIES: { key: VerdictKey; label: string; color: string; Icon: LucideIcon }[] =
  [
    { key: "pass", label: "Pass", color: "var(--chart-pass)", Icon: CircleCheck },
    { key: "reject", label: "Reject (for salvage)", color: "var(--chart-reject)", Icon: CircleX },
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
