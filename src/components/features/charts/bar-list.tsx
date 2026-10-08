import Link from "next/link";
import { cn } from "@/lib/utils";

export type BarItem = {
  id: string;
  label: string;
  value: number;
  /** Shown at the bar's tip (defaults to the value). */
  valueLabel?: string;
  /** Extra detail for the hover title and screen readers. */
  detail?: string;
  href?: string;
  /** Emphasised bar (e.g. the bottleneck), with a text tag so it's never colour-only. */
  highlight?: string;
  muted?: boolean;
};

/**
 * Horizontal bars for a ranked or ordered list (one hue: identity comes from the row label, not
 * colour). Value at the bar tip, ≤ 24px thick, 4px rounded data end, square at the baseline.
 */
export function BarList({ items, label }: { items: BarItem[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2" aria-label={label}>
      {items.map((item) => {
        const width = `${Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100)}%`;
        const name = item.href ? (
          <Link href={item.href} className="truncate underline-offset-4 hover:underline">
            {item.label}
          </Link>
        ) : (
          <span className="truncate">{item.label}</span>
        );
        return (
          <li
            key={item.id}
            className="grid grid-cols-[9rem_1fr] items-center gap-3 text-sm"
            title={item.detail}
            data-testid="bar-item"
          >
            <span className="flex min-w-0 flex-col">
              {name}
              {item.highlight && (
                <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
                  {item.highlight}
                </span>
              )}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block h-4 rounded-r-sm",
                    item.muted ? "bg-(--chart-bar-muted)" : "bg-(--chart-bar)",
                  )}
                  style={{ width }}
                />
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {item.valueLabel ?? item.value}
              </span>
              {item.detail && <span className="sr-only">{item.detail}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
