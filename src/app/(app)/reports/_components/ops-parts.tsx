import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CircleAlert,
  Info,
  Minus,
  OctagonAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums" data-testid={testid}>
          {value}
        </CardTitle>
        {change !== undefined && (
          <p className="flex items-start gap-1 text-sm text-muted-foreground">
            <Arrow aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="flex flex-col">
              <span className="font-medium text-foreground first-letter:uppercase">
                {change === null ? "No earlier data" : describeChange(change)}
              </span>
              <span>{compareLabel}</span>
            </span>
          </p>
        )}
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
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
          Problems found across the line, stock, purchasing and supply as of {asOf}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing needs attention. No bottleneck, late batch, shortage or waiting request was
            found.
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
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Open
                    <ArrowRight aria-hidden className="size-4" />
                    <span className="sr-only">: {item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
