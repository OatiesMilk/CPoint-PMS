import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "./env";

// One client (one connection pool) per process. In dev, reuse it across hot reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}
