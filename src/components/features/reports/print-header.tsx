import { formatManilaDateTime } from "@/lib/format";

/**
 * The top of a printed report (Phase 35), hidden on screen: the company, the report and its period,
 * when it was printed, who prepared it, and the filters and sort in words. "Prepared by" is the
 * signed-in person who prints it, not a figure about anyone (D-008).
 */
export function PrintHeader({
  report,
  period,
  preparedBy,
  notes = [],
  printedAt,
}: {
  report: string;
  period?: string;
  preparedBy: { name: string; roleLabel: string };
  /** Filters and sort in words, one line each. */
  notes?: string[];
  printedAt: Date;
}) {
  return (
    <div className="mb-4 hidden border-b pb-3 print:block" data-testid="print-header">
      <p className="text-sm font-semibold tracking-wide uppercase">CPoint Shoe Store Corporation</p>
      <h2 className="text-2xl font-semibold">Reports · {report}</h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        {period && (
          <>
            <dt className="text-muted-foreground">Period</dt>
            <dd data-testid="print-period">{period}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Printed</dt>
        <dd>{formatManilaDateTime(printedAt)}</dd>
        <dt className="text-muted-foreground">Prepared by</dt>
        <dd data-testid="print-prepared-by">
          {preparedBy.name}, {preparedBy.roleLabel}
        </dd>
        {notes.map((note) => (
          <dd key={note} className="col-span-2">
            {note}
          </dd>
        ))}
      </dl>
    </div>
  );
}

/** A4 portrait with a 12 mm margin for a printed report; only report pages render it. */
export function PrintPage() {
  return <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>;
}
