/** A thin band on every page while the demo tools are on (Phase 28, D-101, A-23). The page says. */
export function DemoBand({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <section
      aria-label="Demo mode"
      data-testid="demo-band"
      className="border-b border-caution/25 bg-caution-soft px-4 py-1.5 text-center text-sm text-foreground print:hidden"
    >
      Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
    </section>
  );
}
