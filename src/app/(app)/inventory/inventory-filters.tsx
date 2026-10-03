"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { InventoryCategory } from "@/lib/domain";
import { CATEGORY_LABELS } from "@/lib/inventory-rules";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as InventoryCategory[];

/** Filters live in the URL so they survive reloads and can be shared. Changing one resets to page 1. */
export function InventoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(debounce.current), []);

  return (
    <div className="flex items-end gap-3" aria-busy={pending}>
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="filter-q">Search</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="filter-q"
            type="search"
            className="pl-9"
            placeholder="Code or name"
            value={q}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              clearTimeout(debounce.current);
              debounce.current = setTimeout(() => update("q", value.trim()), 300);
            }}
          />
        </div>
      </div>
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
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-stock">Stock</Label>
        <Select
          id="filter-stock"
          value={params.get("stock") ?? ""}
          onChange={(e) => update("stock", e.target.value)}
        >
          <option value="">All levels</option>
          <option value="low">Low or out</option>
          <option value="out">Out of stock</option>
        </Select>
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-(--primary)"
          checked={params.get("inactive") === "1"}
          onChange={(e) => update("inactive", e.target.checked ? "1" : "")}
        />
        Show deactivated
      </label>
    </div>
  );
}
