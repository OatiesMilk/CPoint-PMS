/**
 * The app's "now" (D-125). Normally the real time; while the demo tools are on, the real time plus
 * the demo clock's offset, so a demo can be shown at any day and hour. Pure and client-safe: the
 * server sets the offset from the database (`server/lib/demo-clock.ts`), the browser from the page
 * (`DemoClockSync`). Sign-in, sessions and tokens keep the real time.
 */

const KEY = "__cpointDemoClockOffsetMs";
type ClockGlobal = typeof globalThis & { [KEY]?: number };

/** Milliseconds the app's clock runs ahead of (or behind) the real time; 0 is real time. */
export function clockOffsetMs(): number {
  const value = (globalThis as ClockGlobal)[KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Sets the offset for this process or browser tab. */
export function setClockOffsetMs(offsetMs: number): void {
  (globalThis as ClockGlobal)[KEY] = Number.isFinite(offsetMs) ? Math.trunc(offsetMs) : 0;
}

/** The app's current time in milliseconds. */
export function appNowMs(): number {
  return Date.now() + clockOffsetMs();
}

/** The app's current time. Use it wherever a page, a rule or a service asks what time it is. */
export function appNow(): Date {
  return new Date(appNowMs());
}

/** What the demo band shows (D-125): whether the clock is moved, its offset and the app's time. */
export type DemoClockView = { on: boolean; offsetMs: number; now: string };
