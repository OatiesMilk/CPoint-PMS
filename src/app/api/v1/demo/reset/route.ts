import { demoController } from "@/server/controllers/demo.controller";

// Demo only (D-101): 404 unless DEMO_LOGIN_TOOLS and SEED_DEMO_USERS are on. Takes about a minute.
export const POST = demoController.reset;
