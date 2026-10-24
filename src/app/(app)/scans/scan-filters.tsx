"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const VERDICTS = [
  ["PASS", "Pass"],
  ["REJECT", "Reject"],
] as const;
const SOURCES = [
  ["SIMULATOR", "Simulator"],
  ["PHONE", "Phone"],
  ["WEBCAM", "Webcam"],
  ["DEDICATED_CAMERA", "Dedicated camera"],
] as const;

/** URL-backed filters, like the roll list. Changing one resets to page 1. */
export function ScanFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [roll, setRoll] = useState(params.get("roll") ?? "");
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
        <Label htmlFor="filter-roll">Roll</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="filter-roll"
            type="search"
            className="pl-9"
            placeholder="e.g. B-2026-0003"
            value={roll}
            onChange={(e) => {
              setRoll(e.target.value);
              clearTimeout(debounce.current);
              const value = e.target.value.trim();
              debounce.current = setTimeout(() => update("roll", value), 300);
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
    </div>
  );
}
