"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { InventoryCategory } from "@/lib/domain";
import { CATEGORY_LABELS } from "@/lib/inventory-rules";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as InventoryCategory[];

/** Filters live in the URL (shareable, survive reloads). Changing one resets to page 1. */
export function RequestFilters({ items }: { items: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending}>
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-category">Category</Label>
        <Select
          id="filter-category"
          value={params.get("category") ?? ""}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>
      {items.length > 0 && (
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="filter-item">Item</Label>
          <Select
            id="filter-item"
            value={params.get("item") ?? ""}
            onChange={(e) => update("item", e.target.value)}
          >
            <option value="">All items</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="filter-from">Sent from</Label>
        <Input
          id="filter-from"
          type="date"
          value={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
        />
      </div>
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="filter-to">to</Label>
        <Input
          id="filter-to"
          type="date"
          value={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
        />
      </div>
    </div>
  );
}
