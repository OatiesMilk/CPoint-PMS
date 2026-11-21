"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLL_REPORT_STATUSES, ROLL_REPORT_STATUS_LABELS } from "@/lib/roll-rules";

/** Filters live in the URL so they survive reloads and can be shared. Changing one resets to page 1. */
export function RollFilters({
  suppliers,
  items,
  locations,
}: {
  suppliers: { id: string; name: string }[];
  items: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
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
    <div className="flex flex-wrap items-end gap-3 print:hidden" aria-busy={pending}>
      <div className="flex w-full flex-col gap-1.5 sm:w-64">
        <Label htmlFor="filter-q">Find</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="filter-q"
            type="search"
            className="pl-9"
            placeholder="Roll or tag number"
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
      <div className="flex w-full flex-col gap-1.5 sm:w-56">
        <Label htmlFor="filter-supplier">Supplier</Label>
        <Select
          id="filter-supplier"
          value={params.get("supplierId") ?? ""}
          onChange={(e) => update("supplierId", e.target.value)}
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-60">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          id="filter-status"
          value={params.get("status") ?? ""}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.delete("page");
            next.delete("status");
            if (e.target.value) next.set("status", e.target.value);
            startTransition(() =>
              router.replace(`${pathname}?${next.toString()}`, { scroll: false }),
            );
          }}
        >
          <option value="">All statuses</option>
          {ROLL_REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ROLL_REPORT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-56">
        <Label htmlFor="filter-item">Leather item</Label>
        <Select
          id="filter-item"
          value={params.get("itemId") ?? ""}
          onChange={(e) => update("itemId", e.target.value)}
        >
          <option value="">All leather items</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-56">
        <Label htmlFor="filter-location">Location</Label>
        <Select
          id="filter-location"
          value={params.get("locationId") ?? ""}
          onChange={(e) => update("locationId", e.target.value)}
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
