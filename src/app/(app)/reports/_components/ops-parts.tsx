import { ArrowDown, ArrowUp, CircleAlert, Info, Minus, OctagonAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KpiTile as SharedKpiTile } from "@/components/features/kpi-tile";
import { CardLink } from "@/components/ui/card-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeChange, type AttentionItem } from "@/lib/ops-rules";

// Building blocks of the Operations report (D-033). Server components: no state, no animation.

/**
 * One headline number with its change against the previous period. The change is words plus an
 * arrow, never colour: whether "up" is good depends on the measure, and we don't judge it here.
 */
export function KpiTile({
  label,
  value,
  sub,
  change,
  compareLabel,
  testid,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Fractional change vs the previous period; undefined hides the comparison. */
  change?: number | null;
  compareLabel?: string;
  testid?: string;
}) {
  const Arrow =
    change == null || Math.round(Math.abs(change) * 100) === 0
      ? Minus
      : change > 0
        ? ArrowUp
        : ArrowDown;
  return (
    <SharedKpiTile label={label} value={value} valueTestId={testid}>
      {change !== undefined && (
        <p className="flex items-start gap-1">
          <Arrow aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="inline-block font-medium text-foreground first-letter:uppercase">
              {change === null ? "No earlier data" : describeChange(change)}
            </span>{" "}
            <span>{compareLabel}</span>
          </span>
        </p>
      )}
      {sub && <p>{sub}</p>}
    </SharedKpiTile>
  );
}

const SEVERITY = {
  critical: { tone: "danger", label: "Act now", Icon: OctagonAlert },
  warning: { tone: "warning", label: "Watch", Icon: CircleAlert },
  info: { tone: "info", label: "For your attention", Icon: Info },
} as const;

/** The few things worth acting on, most urgent first. Each links to where it is handled. */
export function AttentionList({ items, asOf }: { items: AttentionItem[]; asOf: string }) {
  return (
    <Card data-testid="attention">
      <CardHeader>
        <CardTitle>What needs attention</CardTitle>
        <CardDescription>
          Problems found across the line, stock and supply as of {asOf}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing needs attention. No shortage, short day or supplier problem was found.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((item) => {
              const s = SEVERITY[item.severity];
              return (
                <li
                  key={item.id}
                  className="grid grid-cols-1 items-start gap-4 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_1fr_auto]"
                >
                  <Badge tone={s.tone} className="justify-self-start">
                    <s.Icon aria-hidden />
                    {s.label}
                  </Badge>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <CardLink href={item.href}>
                    Open<span className="sr-only">: {item.title}</span>
                  </CardLink>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
