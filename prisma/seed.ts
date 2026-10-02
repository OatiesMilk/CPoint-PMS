// `npm run db:seed`: same idempotent bootstrap the app runs on startup (reference data,
// demo users when SEED_DEMO_USERS=true, first admin from BOOTSTRAP_ADMIN_*).
import "dotenv/config";
import { bootstrap } from "../src/server/services/bootstrap.service";
import { getPrisma } from "../src/server/lib/prisma";

bootstrap()
  .then(() => console.log("Seed complete."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
