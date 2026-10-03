import { inventoryController } from "@/server/controllers/inventory.controller";

export const GET = inventoryController.show;
export const PATCH = inventoryController.update;
