import { rollController } from "@/server/controllers/roll.controller";

// No POST since Phase 30A (D-104): rolls are added in Inventory and picked at Capture.
export const GET = rollController.index;
