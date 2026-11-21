"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/** The page's URL without the params a filter owns (and without the page number). */
function useClearedHref(owns: readonly string[]) {
  const pathname = usePathname();
  const params = useSearchParams();
  const next = new URLSearchParams();
  for (const [k, v] of params) if (!owns.includes(k) && k !== "page") next.set(k, v);
  const query = next.toString();
  return { pathname, params, href: query ? `${pathname}?${query}` : pathname };
}

/**
 * A filter bar that is a plain GET form (Phase 35): the period, the view and the sort ride along
 * as hidden fields, the filters it `owns` are the visible ones. Apply sets them, Clear drops them.
 */
export function FilterForm({
  owns,
  label,
  children,
  active,
}: {
  owns: readonly string[];
  label: string;
  children: ReactNode;
  active: boolean;
}) {
  const { params, href } = useClearedHref(owns);
  return (
    <form method="get" aria-label={label} className="flex flex-wrap items-end gap-3 print:hidden">
      {[...params].map(
        ([k, v]) =>
          !owns.includes(k) &&
          k !== "page" && <input key={`${k}=${v}`} type="hidden" name={k} value={v} />,
      )}
      {children}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
      {active && (
        <Button asChild variant="ghost">
          <Link href={href}>Clear</Link>
        </Button>
      )}
    </form>
  );
}

/** "Filtered: …" on a card whose rows a filter narrows, with Clear. */
export function FilteredNote({ text, owns }: { text: string; owns: readonly string[] }) {
  const { href } = useClearedHref(owns);
  return (
    <p className="text-sm" data-testid="filtered-note">
      <span className="font-medium">Filtered:</span> {text}{" "}
      <Link href={href} className="underline underline-offset-4 print:hidden">
        Clear
      </Link>
    </p>
  );
}
