// Prisma 7 does not load .env on its own; dotenv covers local dev.
// In Docker the variables come from docker-compose instead.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // react-server condition: lets the seed import server-only modules outside Next.js.
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // process.env (not env()) so `prisma generate` works without a database URL, e.g. in CI.
    url: process.env["DATABASE_URL"],
  },
});
