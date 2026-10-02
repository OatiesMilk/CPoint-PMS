"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BATCH_STATUS_LABELS, STAGE_LABELS, STAGE_ORDER, type BatchStatus } from "@/lib/domain";

const STATUSES = Object.keys(BATCH_STATUS_LABELS) as BatchStatus[];

/** Filters live in the URL so they survive reloads and can be shared. Changing one resets to page 1. */
export function BatchFilters({ shoeTypes }: { shoeTypes: { id: string; name: string }[] }) {
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
            placeholder="Batch or roll code"
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
        <Label htmlFor="filter-status">Status</Label>
        <Select
          id="filter-status"
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {BATCH_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-stage">Stage</Label>
        <Select
          id="filter-stage"
          value={params.get("stage") ?? ""}
          onChange={(e) => update("stage", e.target.value)}
        >
          <option value="">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-shoe">Shoe type</Label>
        <Select
          id="filter-shoe"
          value={params.get("shoeTypeId") ?? ""}
          onChange={(e) => update("shoeTypeId", e.target.value)}
        >
          <option value="">All shoe types</option>
          {shoeTypes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
