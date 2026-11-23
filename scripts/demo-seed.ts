/**
 * Seeds a realistic past week of production (D-026) into the database in .env, through the real
 * services. Only on a database with no rolls; demo users must exist (start the app once with
 * SEED_DEMO_USERS=true, or run `npm run db:seed`).
 *
 *   npm run demo:seed
 *
 * Seeds at the demo clock's time when it is moved (D-125), as the app does.
 */
import "dotenv/config";
import { seedDemoWeek } from "../src/server/services/demo-seed.service";
import { getPrisma } from "../src/server/lib/prisma";
import { syncDemoClock } from "../src/server/services/demo-clock.service";

syncDemoClock()
  .then(() => seedDemoWeek())
  .then(async (result) => {
    console.log(
      result.seeded
        ? `Seeded ${result.rolls} rolls, ${result.scans} scans and ${result.attendanceDays} days of attendance in ${Math.round(result.ms / 1000)}s.`
        : `Nothing seeded: ${result.reason}.`,
    );
    await getPrisma().$disconnect();
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
