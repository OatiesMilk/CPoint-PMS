"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A box that scrolls sideways when its content is wider than it (a wide table in a narrow card or
 * window). Only while it actually overflows does it become a keyboard stop with a name, so a
 * keyboard user can scroll it with the arrow keys (WCAG 2.1.1; axe `scrollable-region-focusable`)
 * and a table that fits adds no extra Tab stop. The page itself never scrolls sideways (D-034).
 * It starts as a stop, so the server's HTML and the first paint are already reachable before the
 * browser has measured it; the measurement then drops the stop when the table fits.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  /** What the region holds, read as "<label>, scrolls sideways". */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("relative w-full max-w-full min-w-0 overflow-x-auto", className)}
      {...(overflowing
        ? { tabIndex: 0, role: "region", "aria-label": `${label}, scrolls sideways` }
        : {})}
    >
      {children}
    </div>
  );
}
