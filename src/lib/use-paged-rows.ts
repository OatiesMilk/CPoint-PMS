"use client";

import { useMemo, useState } from "react";
import { PAGE_SIZE, pageCountFor, pageOf } from "./pagination";

/**
 * A find box and pages for a small list already in the browser (D-047). Typing goes back to
 * page 1, and a page past the end (after rows changed) shows the last page instead.
 */
export function usePagedRows<T>(
  rows: readonly T[],
  text: (row: T) => string,
  size = PAGE_SIZE,
  initialQuery = "",
) {
  const [query, setQueryState] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => text(r).toLowerCase().includes(q)) : rows;
  }, [rows, query, text]);

  const pageCount = pageCountFor(matches.length, size);
  const current = Math.min(page, pageCount);

  return {
    query,
    setQuery: (q: string) => {
      setQueryState(q);
      setPage(1);
    },
    page: current,
    setPage,
    pageCount,
    total: matches.length,
    shown: pageOf(matches, current, size),
  };
}
