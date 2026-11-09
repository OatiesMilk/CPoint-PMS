// Runs once when the Next.js server starts (not during `next build`).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { bootstrap } = await import("@/server/services/bootstrap.service");
  const { logger } = await import("@/server/lib/logger");
  try {
    // The demo clock first (D-125), so a demo week seeded now follows it.
    const { syncDemoClock } = await import("@/server/services/demo-clock.service");
    await syncDemoClock();
    await bootstrap({ demoWeekInBackground: true });
    logger.info("Bootstrap complete");
  } catch (error) {
    // Don't crash the server: /api/health reports the database problem, and the next start retries.
    logger.error({ err: error }, "Bootstrap failed; the app will start without seeding");
  }
}
