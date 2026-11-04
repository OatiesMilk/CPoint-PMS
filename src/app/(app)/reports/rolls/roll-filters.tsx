"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLL_STATUS_LABELS, type RollStatus } from "@/lib/domain";

const STATUSES = Object.keys(ROLL_STATUS_LABELS) as RollStatus[];
const DAYS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/** Filters live in the URL so they survive reloads and can be shared. Changing one resets to page 1. */
export function RollFilters({ suppliers }: { suppliers: { id: string; name: string }[] }) {
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
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending}>
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
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ROLL_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-40">
        <Label htmlFor="filter-days">Added</Label>
        <Select
          id="filter-days"
          value={params.get("days") ?? ""}
          onChange={(e) => update("days", e.target.value)}
        >
          <option value="">Any time</option>
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
