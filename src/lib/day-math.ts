/** Calendar-day arithmetic on "YYYY-MM-DD" strings, shared by the report ranges and the month weeks. */

export const DAY_MS = 86_400_000;

/** "2026-10-03" + n days, as a calendar date (no time zone involved). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
