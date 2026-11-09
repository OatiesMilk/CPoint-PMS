/**
 * The demo clock (D-125): while the demo tools are on, the whole app runs at a day and hour the
 * presenter picks, and keeps ticking from there. Stored as an offset from the real time, so every
 * role on every device sees the same time and it survives a restart. With DEMO_LOGIN_TOOLS off the
 * offset is always 0, whatever the database holds. Sign-in, sessions and tokens keep real time.
 */
import { addDays } from "@/lib/report-rules";
import { appNow, clockOffsetMs, setClockOffsetMs, type DemoClockView } from "@/lib/clock";

export type { DemoClockView };
import { manilaToday } from "@/lib/format";
import { Errors } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { runInTransaction } from "@/server/models/db";
import { getDemoClockOffset, saveDemoClockOffset } from "@/server/models/demo-clock.model";
import { recordAudit } from "./audit.service";
import { demoToolsEnabled, demoToolsOff } from "./demo-tools.service";

/** How far from today the demo clock may go: a year either way. */
export const DEMO_CLOCK_RANGE_DAYS = 366;

const LOADED = "__cpointDemoClockLoaded";
type LoadedGlobal = typeof globalThis & { [LOADED]?: boolean };

/**
 * Loads the saved offset into this server process once (the app runs as one process; the value is
 * kept on `globalThis`, so every part of the server shares it). Called by the guard on every
 * request and at start-up. With the demo tools off, the clock is the real time.
 */
export async function syncDemoClock(): Promise<void> {
  const g = globalThis as LoadedGlobal;
  if (!demoToolsEnabled()) {
    setClockOffsetMs(0);
    return;
  }
  if (g[LOADED]) return;
  try {
    setClockOffsetMs(await getDemoClockOffset());
  } catch (error) {
    // No table yet (migrations not run) or no database: real time, and try again next request.
    logger.warn({ err: error }, "Demo clock: could not read the offset; using real time");
    setClockOffsetMs(0);
    return;
  }
  g[LOADED] = true;
}

/** What the band shows: whether the demo clock is moved, and the app's time now. */
export async function demoClockView(): Promise<DemoClockView> {
  await syncDemoClock();
  const offsetMs = clockOffsetMs();
  return { on: offsetMs !== 0, offsetMs, now: appNow().toISOString() };
}

/**
 * Sets the demo clock to `at` (it keeps ticking from there), or back to real time with null.
 * Anyone may, from the band or the login page, while the demo tools are on; the audit log keeps
 * who and when (real time).
 */
export async function setDemoClock(
  at: Date | null,
  actor: { id: string } | null,
  realNow: Date = new Date(),
): Promise<DemoClockView> {
  if (!demoToolsEnabled()) throw demoToolsOff();
  await syncDemoClock();
  if (at) {
    const today = manilaToday(realNow);
    const from = addDays(today, -DEMO_CLOCK_RANGE_DAYS);
    const to = addDays(today, DEMO_CLOCK_RANGE_DAYS);
    const day = manilaToday(at);
    if (day < from || day > to)
      throw Errors.validation([
        {
          path: ["date"],
          message: `Pick a date from ${from} to ${to}: the demo clock goes up to a year either way.`,
        },
      ]);
  }
  const before = clockOffsetMs();
  const offsetMs = at ? at.getTime() - realNow.getTime() : 0;
  await runInTransaction(async (tx) => {
    await saveDemoClockOffset(offsetMs, tx);
    await recordAudit(tx, {
      actor: actor ? { type: "USER", userId: actor.id } : { type: "SYSTEM" },
      action: "demo_clock.set",
      entity: "DemoClock",
      entityId: "1",
      before: { offsetMs: before, at: new Date(realNow.getTime() + before).toISOString() },
      after: { offsetMs, at: at ? at.toISOString() : "real time" },
    });
  });
  setClockOffsetMs(offsetMs);
  (globalThis as LoadedGlobal)[LOADED] = true;
  return { on: offsetMs !== 0, offsetMs, now: appNow().toISOString() };
}
