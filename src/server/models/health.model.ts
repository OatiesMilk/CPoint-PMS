import { getPrisma } from "@/server/lib/prisma";

/** Round-trips a trivial query to prove the database is reachable. */
export async function pingDatabase(): Promise<void> {
  await getPrisma().$queryRaw`SELECT 1`;
}
