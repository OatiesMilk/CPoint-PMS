import { inventoryController } from "@/server/controllers/inventory.controller";

export const GET = inventoryController.movements;
export const POST = inventoryController.recordMovement;
