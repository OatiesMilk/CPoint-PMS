/** Rows per page for every paginated table (D-047). Change it here, nowhere else. */
export const PAGE_SIZE = 15;

/** At least one page, so "page 1 of 1" reads right for an empty list. */
export function pageCountFor(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** Keeps a requested page inside 1..pageCount (a stale link to page 9 shows the last page). */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), pageCount);
}

/** The Prisma-style window for a page. */
export function pageWindow(page: number, size: number = PAGE_SIZE): { skip: number; take: number } {
  return { skip: (page - 1) * size, take: size };
}

/** The rows a page shows, for "Showing 16–30 of 42". */
export function shownRange(
  page: number,
  total: number,
  size: number = PAGE_SIZE,
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * size + 1;
  return { from, to: Math.min(total, from + size - 1) };
}

/** One page of an in-memory list (small client-side tables). */
export function pageOf<T>(rows: readonly T[], page: number, size: number = PAGE_SIZE): T[] {
  return rows.slice((page - 1) * size, page * size);
}
