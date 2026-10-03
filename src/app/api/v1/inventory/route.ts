import { inventoryController } from "@/server/controllers/inventory.controller";

export const GET = inventoryController.index;
export const POST = inventoryController.create;
