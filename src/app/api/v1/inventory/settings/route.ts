import { stockUpdateController } from "@/server/controllers/stock-update.controller";

export const GET = stockUpdateController.settings;
export const PUT = stockUpdateController.saveSettings;
