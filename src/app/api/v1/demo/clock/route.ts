import { demoController } from "@/server/controllers/demo.controller";

// Demo only (D-125): 404 unless DEMO_LOGIN_TOOLS and SEED_DEMO_USERS are on. Moves the demo clock.
export const POST = demoController.clock;
