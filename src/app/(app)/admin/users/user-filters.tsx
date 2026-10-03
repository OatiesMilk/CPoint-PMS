"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLE_LABELS, type Role } from "@/lib/domain";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function UserFilters() {
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
            placeholder="Name or email"
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
      <div className="flex w-48 flex-col gap-1.5">
        <Label htmlFor="filter-role">Role</Label>
        <Select
          id="filter-role"
          value={params.get("role") ?? ""}
          onChange={(e) => update("role", e.target.value)}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
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
          <option value="active">Active</option>
          <option value="locked">Locked</option>
          <option value="deactivated">Deactivated</option>
        </Select>
      </div>
    </div>
  );
}
