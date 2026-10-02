import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  APP_TIMEZONE: z.string().default("Asia/Manila"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  UPLOADS_DIR: z.string().default("./storage/uploads"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated environment, read lazily so `next build` and `prisma generate` work without a database.
 * Throws a readable error listing every missing or invalid variable.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables (see .env.example):\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
