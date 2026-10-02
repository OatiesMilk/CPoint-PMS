// Runs once when the Next.js server starts (not during `next build`).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { bootstrap } = await import("@/server/services/bootstrap.service");
  const { logger } = await import("@/server/lib/logger");
  try {
    await bootstrap();
    logger.info("Bootstrap complete");
  } catch (error) {
    // Don't crash the server: /api/health reports the database problem, and the next start retries.
    logger.error({ err: error }, "Bootstrap failed; the app will start without seeding");
  }
}
