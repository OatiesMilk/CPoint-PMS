import { VERDICT_SERIES, type VerdictKey } from "./verdict-legend";

/**
 * One 100% bar of today's verdict split, with 2px surface gaps between segments. Labels live in
 * the legend/list next to it (segments are too thin for inline text).
 */
export function SplitBar({ counts }: { counts: Record<VerdictKey, number> }) {
  const total = VERDICT_SERIES.reduce((t, s) => t + counts[s.key], 0);
  if (total === 0) return <div className="h-3 rounded-sm bg-muted" aria-hidden />;
  return (
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-sm" aria-hidden>
      {VERDICT_SERIES.filter((s) => counts[s.key] > 0).map((s) => (
        <span key={s.key} style={{ background: s.color, flexGrow: counts[s.key] }} />
      ))}
    </div>
  );
}
