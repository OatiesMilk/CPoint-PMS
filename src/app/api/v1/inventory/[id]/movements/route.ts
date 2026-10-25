import { inventoryController } from "@/server/controllers/inventory.controller";

// Read only since Phase 29 (D-102): stock changes through POST /api/v1/inventory/updates.
export const GET = inventoryController.movements;
