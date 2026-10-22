"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const VERDICTS = [
  ["PASS", "Pass"],
  ["REWORK", "Fixable"],
  ["REJECT", "Reject"],
  ["NEEDS_REVIEW", "Needed review"],
] as const;
const SOURCES = [
  ["SIMULATOR", "Simulator"],
  ["PHONE", "Phone"],
  ["WEBCAM", "Webcam"],
  ["DEDICATED_CAMERA", "Dedicated camera"],
] as const;

/** URL-backed filters, like the batch list. Changing one resets to page 1. */
export function ScanFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [batch, setBatch] = useState(params.get("batch") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex w-56 flex-col gap-1.5">
        <Label htmlFor="filter-batch">Batch</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="filter-batch"
            type="search"
            className="pl-9"
            placeholder="e.g. B-2026-0003"
            value={batch}
            onChange={(e) => {
              setBatch(e.target.value);
              clearTimeout(debounce.current);
              const value = e.target.value.trim();
              debounce.current = setTimeout(() => update("batch", value), 300);
            }}
          />
        </div>
      </div>
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-verdict">Verdict</Label>
        <Select
          id="filter-verdict"
          value={params.get("verdict") ?? ""}
          onChange={(e) => update("verdict", e.target.value)}
        >
          <option value="">All verdicts</option>
          {VERDICTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          id="filter-status"
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">All</option>
          <option value="PENDING_REVIEW">Waiting for review</option>
          <option value="DECIDED">Decided</option>
        </Select>
      </div>
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-source">Source</Label>
        <Select
          id="filter-source"
          value={params.get("source") ?? ""}
          onChange={(e) => update("source", e.target.value)}
        >
          <option value="">All sources</option>
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-(--primary)"
          checked={params.get("override") === "1"}
          onChange={(e) => update("override", e.target.checked ? "1" : "")}
        />
        Overridden only
      </label>
    </div>
  );
}
