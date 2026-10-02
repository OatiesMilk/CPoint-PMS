// Display helpers. Storage is UTC; the factory reads Manila time (DESIGN.md → Patterns).
export const APP_TIME_ZONE = "Asia/Manila";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "under 1m", "35m", "3h 12m", "2d 4h". Compact, for tables and timelines. */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return "under 1m";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    const m = Math.floor((ms % HOUR) / MINUTE);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function formatManilaDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Calendar date only. Dates stored as @db.Date are UTC midnight, so format them in UTC. */
export function formatCalendarDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", dateStyle: "medium" }).format(
    new Date(value),
  );
}

/** Today's date in Manila as YYYY-MM-DD (for date inputs and "not in the future" checks). */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

export function manilaYear(now: Date = new Date()): number {
  return Number(manilaToday(now).slice(0, 4));
}
