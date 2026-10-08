"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "cpoint:rework:collapsed";
const EVENT = "cpoint:rework:collapsed-change";

// Which columns are collapsed is a per-browser preference. Storage can be missing or blocked, so
// every access is guarded, and the server always renders expanded (no hydration mismatch).
function readCollapsed(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeCollapsed(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Not saved this time; the column still toggles for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// useSyncExternalStore compares snapshots by value, so hand it a string, not a fresh array.
const snapshot = () => readCollapsed().join("|");
const serverSnapshot = () => "";

/**
 * One board column whose body can be folded away. The server renders the cards and passes them in
 * as children; this component only owns open/closed. Collapsed leaves just the header (title and
 * count), so whatever follows in a stacked layout moves up right under it.
 */
export function ReworkColumn({
  id,
  title,
  count,
  icon,
  tone,
  children,
}: {
  id: string;
  title: string;
  count: number;
  icon: ReactNode;
  tone?: string;
  children: ReactNode;
}) {
  const bodyId = useId();
  const collapsed = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
    .split("|")
    .includes(id);

  function toggle() {
    const current = readCollapsed();
    writeCollapsed(collapsed ? current.filter((c) => c !== id) : [...current, id]);
  }

  return (
    <section
      aria-label={title}
      data-collapsed={collapsed}
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-muted/50 p-3"
    >
      <h2 className="font-semibold">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={`${title}, ${count} ${count === 1 ? "section" : "sections"}`}
          className={cn(
            "-m-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md p-1 text-left",
            "transition-[background-color,transform] duration-(--dur-press) ease-out active:scale-[0.97]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
            tone,
          )}
        >
          {icon}
          <span>{title}</span>
          <span className="text-muted-foreground tabular-nums">({count})</span>
          <ChevronDown
            aria-hidden
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground",
              "transition-transform duration-(--dur-fast) ease-out motion-reduce:transition-none",
              collapsed && "-rotate-90",
            )}
          />
        </button>
      </h2>
      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
