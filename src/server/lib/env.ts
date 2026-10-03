import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z
    .string()
    .min(32, "Generate one with: npx auth secret (or openssl rand -base64 32)"),
  APP_TIMEZONE: z.string().default("Asia/Manila"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  UPLOADS_DIR: z.string().default("./storage/uploads"),
  // First System Admin, created on startup only when no active admin exists.
  BOOTSTRAP_ADMIN_EMAIL: optionalString.pipe(z.string().email().optional()),
  BOOTSTRAP_ADMIN_PASSWORD: optionalString.pipe(z.string().min(12).optional()),
  // Demo accounts (one per role) for development, CI and the capstone demo.
  SEED_DEMO_USERS: booleanString,
  // A realistic past week of production for demos (D-026). Needs SEED_DEMO_USERS; runs once.
  SEED_DEMO_WEEK: booleanString,
  DEMO_USER_PASSWORD: optionalString.pipe(z.string().min(8).optional()),
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
