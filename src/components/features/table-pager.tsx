import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE, shownRange } from "@/lib/pagination";

/** The suffix for a searched list: "1 supplier that matches", "3 suppliers that match". */
export const MATCHING = [" that matches", " that match"] as const;

type Target =
  /** Server-rendered lists: each page is a URL, so it can be shared and survives a refresh. */
  | { href: (page: number) => string; onPage?: never }
  /** Small lists already loaded in the browser. */
  | { onPage: (page: number) => void; href?: never };

/**
 * The pager under every paginated table (D-047): "Showing 16–30 of 42 batches", Previous, Next.
 * A list that fits on one page shows just its count.
 */
export function TablePager({
  page,
  pageCount,
  total,
  noun,
  suffix = "",
  size = PAGE_SIZE,
  label = "Pagination",
  previousLabel = "Previous",
  nextLabel = "Next",
  ...target
}: {
  page: number;
  pageCount: number;
  total: number;
  /** Singular and plural, e.g. ["batch", "batches"]. */
  noun: readonly [string, string];
  /** Appended to the count; a pair when it agrees with it, e.g. [" that matches", " that match"]. */
  suffix?: string | readonly [string, string];
  size?: number;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
} & Target) {
  if (total === 0) return null;
  const word = total === 1 ? noun[0] : noun[1];
  const tail = typeof suffix === "string" ? suffix : total === 1 ? suffix[0] : suffix[1];
  const count = total.toLocaleString("en-PH");
  const { from, to } = shownRange(page, total, size);

  const step = (to: number, children: React.ReactNode) =>
    target.href ? (
      <Button asChild variant="secondary" size="sm">
        <Link href={target.href(to)}>{children}</Link>
      </Button>
    ) : (
      <Button type="button" variant="secondary" size="sm" onClick={() => target.onPage!(to)}>
        {children}
      </Button>
    );

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
    >
      <span className="tabular-nums">
        {pageCount > 1
          ? `Showing ${from.toLocaleString("en-PH")}–${to.toLocaleString("en-PH")} of ${count} ${word}${tail} · page ${page} of ${pageCount}`
          : `${count} ${word}${tail}`}
      </span>
      {pageCount > 1 && (
        <div className="flex gap-2">
          {page > 1 &&
            step(
              page - 1,
              <>
                <ChevronLeft aria-hidden />
                {previousLabel}
              </>,
            )}
          {page < pageCount &&
            step(
              page + 1,
              <>
                {nextLabel}
                <ChevronRight aria-hidden />
              </>,
            )}
        </div>
      )}
    </nav>
  );
}
