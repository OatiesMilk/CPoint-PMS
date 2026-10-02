import { logger } from "@/server/lib/logger";
import { pingDatabase } from "@/server/models/health.model";

export type HealthStatus = {
  status: "ok" | "degraded";
  checks: { app: "up"; database: "up" | "down" };
  version: string;
  uptimeSeconds: number;
  time: string;
};

export type HealthDeps = { pingDatabase: () => Promise<void>; now?: () => Date };

const DB_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Reports app + database health. Never throws: a down database is a "degraded" result, not an error. */
export async function getHealth(deps: HealthDeps = { pingDatabase }): Promise<HealthStatus> {
  let database: "up" | "down" = "up";
  try {
    await withTimeout(deps.pingDatabase(), DB_TIMEOUT_MS);
  } catch (error) {
    database = "down";
    logger.warn({ err: error }, "Health check: database unreachable");
  }
  return {
    status: database === "up" ? "ok" : "degraded",
    checks: { app: "up", database },
    version: process.env.APP_VERSION ?? "dev",
    uptimeSeconds: Math.round(process.uptime()),
    time: (deps.now?.() ?? new Date()).toISOString(),
  };
}
