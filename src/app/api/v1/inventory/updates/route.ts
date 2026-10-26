import { stockUpdateController } from "@/server/controllers/stock-update.controller";

export const GET = stockUpdateController.index;
export const POST = stockUpdateController.create;
