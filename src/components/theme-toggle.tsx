"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export const THEME_STORAGE_KEY = "cpoint-theme";

/** Flips data-theme on <html> and remembers it. Icons swap via CSS, so there is no hydration mismatch. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the theme still applies for this page view.
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Switch light or dark theme">
      <Sun className="hidden dark:block" aria-hidden />
      <Moon className="block dark:hidden" aria-hidden />
    </Button>
  );
}
