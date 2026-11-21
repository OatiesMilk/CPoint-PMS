/**
 * Sorting a report table by a column (Phase 35, A-100). The URL carries one sort per page:
 * `?sort=<table>.<column>&dir=asc|desc`. Pure and client-safe. Each table lists the columns it
 * can sort by (a whitelist), so an unknown `sort` is ignored and the table keeps its own order.
 */

export type SortDir = "asc" | "desc";
export type SortState = { table: string; column: string; dir: SortDir };
export type SortKey<T> = (row: T) => number | string | null | undefined;

/** `sort=final-defects.pairs&dir=desc` as a state, or null when it isn't shaped like one. */
export function parseSort(sort: unknown, dir: unknown): SortState | null {
  const match = typeof sort === "string" ? /^([a-z][a-z-]*)\.([a-z][a-z-]*)$/.exec(sort) : null;
  if (!match) return null;
  return { table: match[1], column: match[2], dir: dir === "desc" ? "desc" : "asc" };
}

const text = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function compare(a: number | string, b: number | string): number {
  return typeof a === "number" && typeof b === "number"
    ? a - b
    : text.compare(String(a), String(b));
}

/**
 * The rows ordered by one column: numbers as numbers, text by the alphabet (Roll 9 before Roll 10),
 * empty values last in either direction, equal rows in their original order.
 */
export function sortRows<T>(
  rows: readonly T[],
  keys: Record<string, SortKey<T>>,
  column: string,
  dir: SortDir,
): T[] {
  const key = Object.hasOwn(keys, column) ? keys[column] : undefined;
  if (!key) return [...rows];
  const sign = dir === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: key(row) }))
    .sort((a, b) => {
      const aEmpty = a.value === null || a.value === undefined;
      const bEmpty = b.value === null || b.value === undefined;
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      return sign * compare(a.value!, b.value!) || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** `rows` sorted when the page's sort is on this table and column, otherwise as they came. */
export function sortFor<T>(
  state: SortState | null,
  table: string,
  rows: readonly T[],
  keys: Record<string, SortKey<T>>,
): T[] {
  return state && state.table === table ? sortRows(rows, keys, state.column, state.dir) : [...rows];
}

const words = (s: string) => {
  const spaced = s.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** For the printed header: "Sorted by Pairs found in Final defects, high to low". */
export function sortText(state: SortState | null): string | null {
  if (!state) return null;
  const order = state.dir === "desc" ? "high to low, or Z to A" : "low to high, or A to Z";
  return `Sorted by ${words(state.column).toLowerCase()} in ${words(state.table).toLowerCase()}, ${order}`;
}
