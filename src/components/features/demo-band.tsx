/** A thin band on every page while the demo tools are on (Phase 28, D-101, A-23). The page says. */
export function DemoBand({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <div
      role="note"
      data-testid="demo-band"
      className="bg-caution-soft px-4 py-1 text-center text-sm font-medium text-foreground print:hidden"
    >
      Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
    </div>
  );
}
