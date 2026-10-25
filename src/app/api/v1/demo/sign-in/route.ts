import { demoController } from "@/server/controllers/demo.controller";

// Demo only (D-101): 404 unless DEMO_LOGIN_TOOLS and SEED_DEMO_USERS are on.
export const POST = demoController.signIn;
