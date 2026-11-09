import type { DemoClockView } from "@/lib/clock";
import { DemoClockControl } from "./demo-clock-control";

/**
 * A thin band on every page while the demo tools are on (Phase 28, D-101, A-23), with the demo
 * clock (D-125): the time the whole app runs at, and a way to move it. The page says.
 */
export function DemoBand({ clock }: { clock: DemoClockView | null }) {
  if (!clock) return null;
  return (
    <section
      aria-label="Demo mode"
      data-testid="demo-band"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-caution/25 bg-caution-soft px-4 py-1.5 text-center text-sm text-foreground print:hidden"
    >
      <span>
        Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
      </span>
      <DemoClockControl initial={clock} />
    </section>
  );
}
